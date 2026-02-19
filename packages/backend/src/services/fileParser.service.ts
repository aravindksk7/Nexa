import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import * as jschardet from 'jschardet';
import { prisma } from '../lib/prisma.js';
import { createChildLogger } from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { catalogService } from './catalog.service.js';
import type { FileUpload, ParsedFileResult, InferredColumn, FileType } from '../models/index.js';

const logger = createChildLogger('FileParserService');

const SAMPLE_SIZE = 100;
const TYPE_INFERENCE_SAMPLE = 1000;

export class FileParserService {
  /**
   * Parse a CSV file and infer schema
   */
  async parseCsv(
    fileBuffer: Buffer,
    options: { delimiter?: string; encoding?: string } = {}
  ): Promise<ParsedFileResult> {
    logger.debug('Parsing CSV file');

    // Detect encoding if not provided
    const encoding = options.encoding ?? this.detectEncoding(fileBuffer);

    // Convert buffer to string
    const content = this.decodeBuffer(fileBuffer, encoding);

    // Detect delimiter if not provided
    const delimiter = options.delimiter ?? this.inferDelimiter(content);

    // Parse CSV
    const records = parse(content, {
      delimiter,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      throw new ValidationError('CSV file is empty or has no valid records');
    }

    // Get column names from first record
    const columnNames = Object.keys(records[0]!);

    // Infer column types
    const columns = this.inferColumnTypes(columnNames, records);

    // Get sample data
    const sampleData = records.slice(0, SAMPLE_SIZE);

    return {
      columns,
      rowCount: records.length,
      sampleData,
      encoding,
      delimiter,
    };
  }

  /**
   * Parse an Excel file and infer schemas for all sheets
   */
  async parseExcel(fileBuffer: Buffer): Promise<Record<string, ParsedFileResult>> {
    logger.debug('Parsing Excel file');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const results: Record<string, ParsedFileResult> = {};

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: null,
      });

      if (records.length === 0) {
        results[sheetName] = {
          columns: [],
          rowCount: 0,
          sampleData: [],
          encoding: 'utf-8',
        };
        continue;
      }

      const columnNames = Object.keys(records[0]!);
      const stringRecords = records.map(r =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k, v?.toString() ?? ''])
        )
      );

      const columns = this.inferColumnTypes(columnNames, stringRecords);
      const sampleData = records.slice(0, SAMPLE_SIZE);

      results[sheetName] = {
        columns,
        rowCount: records.length,
        sampleData: sampleData as Record<string, unknown>[],
        encoding: 'utf-8',
      };
    }

    return results;
  }

  /**
   * Store file metadata in database
   */
  async storeFileMetadata(
    filename: string,
    originalName: string,
    mimeType: string,
    size: number,
    fileType: FileType,
    storagePath: string,
    parseResult: ParsedFileResult
  ): Promise<FileUpload> {
    const fileUpload = await prisma.fileUpload.create({
      data: {
        filename,
        originalName,
        mimeType,
        size,
        fileType,
        storagePath,
        encoding: parseResult.encoding,
        delimiter: parseResult.delimiter,
      },
    });

    return this.mapFileUpload(fileUpload);
  }

  /**
   * Create an asset from a parsed file
   */
  async createAssetFromFile(
    fileUploadId: string,
    userId: string,
    parseResult: ParsedFileResult,
    assetName?: string
  ): Promise<string> {
    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: fileUploadId },
    });

    if (!fileUpload) {
      throw new NotFoundError('FileUpload', fileUploadId);
    }

    // Create asset
    const asset = await catalogService.createAsset(
      {
        name: assetName ?? fileUpload.originalName,
        description: `Uploaded file: ${fileUpload.originalName}`,
        assetType: 'FILE',
        tags: [fileUpload.fileType.toLowerCase()],
      },
      userId
    );

    // Register schema
    await catalogService.registerSchema(
      asset.id,
      {
        schemaFormat: 'JSON_SCHEMA',
        schemaDefinition: {
          type: 'object',
          properties: parseResult.columns.reduce(
            (acc, col) => ({
              ...acc,
              [col.name]: {
                type: col.inferredType,
                nullable: col.nullable,
              },
            }),
            {}
          ),
        },
      },
      userId
    );

    // Link file to asset
    await prisma.fileUpload.update({
      where: { id: fileUploadId },
      data: {
        assetId: asset.id,
        parsedAt: new Date(),
      },
    });

    logger.info({ fileUploadId, assetId: asset.id }, 'Asset created from file');

    return asset.id;
  }

  /**
   * Detect file encoding
   */
  detectEncoding(buffer: Buffer): string {
    const result = jschardet.detect(buffer);
    return result?.encoding ?? 'utf-8';
  }

  /**
   * Infer CSV delimiter from content
   */
  inferDelimiter(content: string): string {
    const firstLines = content.split('\n').slice(0, 5).join('\n');

    const delimiters = [',', ';', '\t', '|'];
    const counts: Record<string, number> = {};

    for (const delimiter of delimiters) {
      counts[delimiter] = (firstLines.match(new RegExp(delimiter === '|' ? '\\|' : delimiter, 'g')) ?? []).length;
    }

    // Return delimiter with highest count
    let maxDelimiter = ',';
    let maxCount = 0;

    for (const [delimiter, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxDelimiter = delimiter;
      }
    }

    return maxDelimiter;
  }

  /**
   * Decode buffer to string with specified encoding
   */
  private decodeBuffer(buffer: Buffer, encoding: string): string {
    const normalizedEncoding = encoding.toLowerCase().replace('-', '');

    try {
      if (normalizedEncoding === 'utf8' || normalizedEncoding === 'utf-8') {
        return buffer.toString('utf8');
      }
      if (normalizedEncoding === 'utf16le' || normalizedEncoding === 'utf16') {
        return buffer.toString('utf16le');
      }
      if (normalizedEncoding === 'latin1' || normalizedEncoding === 'iso88591') {
        return buffer.toString('latin1');
      }
      if (normalizedEncoding === 'ascii') {
        return buffer.toString('ascii');
      }

      // Default to utf8
      return buffer.toString('utf8');
    } catch {
      return buffer.toString('utf8');
    }
  }

  /**
   * Infer column types from data
   */
  private inferColumnTypes(
    columnNames: string[],
    records: Record<string, string>[]
  ): InferredColumn[] {
    const sampleRecords = records.slice(0, TYPE_INFERENCE_SAMPLE);

    return columnNames.map(name => {
      const values = sampleRecords.map(r => r[name] ?? '').filter(v => v !== '');
      const sampleValues = values.slice(0, 5);

      let inferredType = 'string';
      let nullable = values.length < sampleRecords.length;

      if (values.length === 0) {
        return { name, inferredType: 'string', nullable: true, sampleValues: [] };
      }

      // Check if all values are integers
      if (values.every(v => /^-?\d+$/.test(v.trim()))) {
        inferredType = 'integer';
      }
      // Check if all values are numbers
      else if (values.every(v => /^-?\d*\.?\d+$/.test(v.trim()))) {
        inferredType = 'number';
      }
      // Check if all values are booleans
      else if (
        values.every(v =>
          ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase().trim())
        )
      ) {
        inferredType = 'boolean';
      }
      // Check if all values are dates
      else if (values.every(v => !isNaN(Date.parse(v)))) {
        inferredType = 'date';
      }

      return { name, inferredType, nullable, sampleValues };
    });
  }

  /**
   * Map Prisma FileUpload to domain model
   */
  private mapFileUpload(file: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    fileType: string;
    encoding: string | null;
    delimiter: string | null;
    storagePath: string;
    assetId: string | null;
    parsedAt: Date | null;
    createdAt: Date;
  }): FileUpload {
    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      fileType: file.fileType as FileType,
      encoding: file.encoding ?? undefined,
      delimiter: file.delimiter ?? undefined,
      storagePath: file.storagePath,
      assetId: file.assetId ?? undefined,
      parsedAt: file.parsedAt ?? undefined,
      createdAt: file.createdAt,
    };
  }
}

export const fileParserService = new FileParserService();
