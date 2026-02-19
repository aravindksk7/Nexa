import { Router, Request } from 'express';
import { param } from 'express-validator';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileParserService } from '../services/fileParser.service.js';
import { authenticate, asyncHandler, validate, ValidationError } from '../middleware/index.js';
import type { FileType } from '../models/index.js';

export const filesRouter = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// All routes require authentication
filesRouter.use(authenticate);

// POST /api/v1/files/upload - Upload and parse a file
filesRouter.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;

    let fileType: FileType;
    let parseResult;

    if (ext === '.csv' || mimetype === 'text/csv') {
      fileType = 'CSV';
      const { delimiter, encoding } = req.body;
      parseResult = await fileParserService.parseCsv(buffer, { delimiter, encoding });
    } else if (ext === '.xlsx' || ext === '.xls') {
      fileType = 'EXCEL';
      const sheetsResult = await fileParserService.parseExcel(buffer);
      // Return first sheet's result for simplicity
      const firstSheet = Object.keys(sheetsResult)[0];
      parseResult = firstSheet ? sheetsResult[firstSheet]! : { columns: [], rowCount: 0, sampleData: [], encoding: 'utf-8' };
    } else {
      throw new ValidationError('Unsupported file type');
    }

    // Store file metadata
    const fileUpload = await fileParserService.storeFileMetadata(
      filename,
      originalname,
      mimetype,
      size,
      fileType,
      `/uploads/${filename}`, // In production, use actual storage path
      parseResult
    );

    res.status(201).json({
      file: fileUpload,
      parseResult,
    });
  })
);

// GET /api/v1/files/:id - Get file metadata
filesRouter.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Valid file ID is required')]),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../lib/prisma.js');
    const file = await prisma.fileUpload.findUnique({
      where: { id: req.params['id']! },
    });

    if (!file) {
      throw new ValidationError('File not found');
    }

    res.json({ file });
  })
);

// POST /api/v1/files/:id/create-asset - Create an asset from a parsed file
filesRouter.post(
  '/:id/create-asset',
  validate([
    param('id').isUUID().withMessage('Valid file ID is required'),
  ]),
  asyncHandler(async (req, res) => {
    const { assetName } = req.body;
    const { prisma } = await import('../lib/prisma.js');

    // Re-parse the file to get the schema
    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: req.params['id']! },
    });

    if (!fileUpload) {
      throw new ValidationError('File not found');
    }

    // For now, create asset with empty parseResult - in production, re-read the file
    const parseResult = {
      columns: [],
      rowCount: 0,
      sampleData: [],
      encoding: fileUpload.encoding ?? 'utf-8',
    };

    const assetId = await fileParserService.createAssetFromFile(
      req.params['id']!,
      req.user!.id,
      parseResult,
      assetName
    );

    res.status(201).json({ assetId });
  })
);
