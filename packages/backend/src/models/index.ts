import { z } from 'zod';

// =====================
// User Types
// =====================

export const RoleEnum = z.enum(['ADMIN', 'DATA_STEWARD', 'DATA_ENGINEER', 'BUSINESS_ANALYST']);
export type Role = z.infer<typeof RoleEnum>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: RoleEnum,
  isActive: z.boolean(),
  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: RoleEnum.optional(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const LoginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// =====================
// Asset Types
// =====================

export const AssetTypeEnum = z.enum([
  'TABLE',
  'COLUMN',
  'DATABASE',
  'SCHEMA',
  'DATASET',
  'PIPELINE',
  'DASHBOARD',
  'REPORT',
  'FILE',
  'API',
  'OTHER',
]);
export type AssetType = z.infer<typeof AssetTypeEnum>;

export const QualityStatusEnum = z.enum(['UNKNOWN', 'HEALTHY', 'WARNING', 'CRITICAL']);
export type QualityStatus = z.infer<typeof QualityStatusEnum>;

export const AssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  assetType: AssetTypeEnum,
  ownerId: z.string().uuid(),
  domain: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customProperties: z.record(z.any()).optional(),
  qualityStatus: QualityStatusEnum,
  version: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdById: z.string().uuid(),
  updatedById: z.string().uuid(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  assetType: AssetTypeEnum,
  ownerId: z.string().uuid().optional(),
  domain: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customProperties: z.record(z.any()).optional(),
});

export type CreateAsset = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = CreateAssetSchema.partial();
export type UpdateAsset = z.infer<typeof UpdateAssetSchema>;

// =====================
// Schema Types
// =====================

export const SchemaFormatEnum = z.enum(['JSON_SCHEMA', 'AVRO', 'PARQUET', 'SQL', 'CUSTOM']);
export type SchemaFormat = z.infer<typeof SchemaFormatEnum>;

export const SchemaSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  version: z.number().int().positive(),
  schemaFormat: SchemaFormatEnum,
  schemaDefinition: z.record(z.any()),
  isBreakingChange: z.boolean(),
  breakingDetails: z.record(z.any()).optional(),
  createdAt: z.date(),
  createdById: z.string().uuid(),
});

export type Schema = z.infer<typeof SchemaSchema>;

export const CreateSchemaSchema = z.object({
  schemaFormat: SchemaFormatEnum,
  schemaDefinition: z.record(z.any()),
});

export type CreateSchema = z.infer<typeof CreateSchemaSchema>;

// =====================
// Lineage Types
// =====================

export const LineageEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceAssetId: z.string().uuid(),
  targetAssetId: z.string().uuid(),
  transformationType: z.string(),
  transformationLogic: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
});

export type LineageEdge = z.infer<typeof LineageEdgeSchema>;

export const CreateLineageEdgeSchema = z.object({
  sourceAssetId: z.string().uuid(),
  targetAssetId: z.string().uuid(),
  transformationType: z.string(),
  transformationLogic: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateLineageEdge = z.infer<typeof CreateLineageEdgeSchema>;

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageGraphEdge[];
}

export interface LineageNode {
  id: string;
  name: string;
  assetType: AssetType;
  depth: number;
}

export interface LineageGraphEdge {
  source: string;
  target: string;
  transformationType: string;
}

export interface ImpactAnalysisResult {
  sourceAsset: Pick<Asset, 'id' | 'name' | 'assetType'>;
  impactedAssets: ImpactedAsset[];
  totalCount: number;
  countByType: Record<AssetType, number>;
}

export interface ImpactedAsset {
  id: string;
  name: string;
  assetType: AssetType;
  depth: number;
  path: string[];
}

// =====================
// Column Lineage Types
// =====================

export const ColumnTransformationTypeEnum = z.enum([
  'DIRECT',
  'DERIVED',
  'AGGREGATED',
  'FILTERED',
  'JOINED',
  'CASE',
  'COALESCED',
]);
export type ColumnTransformationType = z.infer<typeof ColumnTransformationTypeEnum>;

export const ColumnLineageEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceAssetId: z.string().uuid(),
  sourceColumn: z.string(),
  targetAssetId: z.string().uuid(),
  targetColumn: z.string(),
  transformationType: ColumnTransformationTypeEnum,
  transformationExpression: z.string().optional(),
  lineageEdgeId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
});

export type ColumnLineageEdge = z.infer<typeof ColumnLineageEdgeSchema>;

export const CreateColumnLineageEdgeSchema = z.object({
  sourceAssetId: z.string().uuid(),
  sourceColumn: z.string().min(1),
  targetAssetId: z.string().uuid(),
  targetColumn: z.string().min(1),
  transformationType: ColumnTransformationTypeEnum,
  transformationExpression: z.string().optional(),
  lineageEdgeId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  metadata: z.record(z.any()).optional(),
});

export type CreateColumnLineageEdge = z.infer<typeof CreateColumnLineageEdgeSchema>;

export interface ColumnLineageGraph {
  nodes: ColumnLineageNode[];
  edges: ColumnLineageGraphEdge[];
}

export interface ColumnLineageNode {
  assetId: string;
  assetName: string;
  column: string;
  assetType: AssetType;
  depth: number;
}

export interface ColumnLineageGraphEdge {
  sourceAssetId: string;
  sourceColumn: string;
  targetAssetId: string;
  targetColumn: string;
  transformationType: ColumnTransformationType;
  transformationExpression?: string;
}

export interface ColumnImpactAnalysisResult {
  sourceAsset: Pick<Asset, 'id' | 'name' | 'assetType'>;
  sourceColumn: string;
  impactedColumns: ImpactedColumn[];
  totalCount: number;
}

export interface ImpactedColumn {
  assetId: string;
  assetName: string;
  column: string;
  assetType: AssetType;
  depth: number;
  path: string[];
}

// =====================
// Business Glossary Types
// =====================

export const BusinessTermStatusEnum = z.enum(['DRAFT', 'APPROVED', 'DEPRECATED']);
export type BusinessTermStatus = z.infer<typeof BusinessTermStatusEnum>;

export const MappingTypeEnum = z.enum(['EXACT', 'CONTAINS', 'DERIVES', 'RELATED']);
export type MappingType = z.infer<typeof MappingTypeEnum>;

export const BusinessDomainSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BusinessDomain = z.infer<typeof BusinessDomainSchema>;

export const CreateBusinessDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  parentId: z.string().uuid().optional(),
});

export type CreateBusinessDomain = z.infer<typeof CreateBusinessDomainSchema>;

export const BusinessTermSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  definition: z.string(),
  domainId: z.string().uuid(),
  ownerId: z.string().uuid(),
  status: BusinessTermStatusEnum,
  synonyms: z.array(z.string()).default([]),
  relatedTerms: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BusinessTerm = z.infer<typeof BusinessTermSchema>;

export const CreateBusinessTermSchema = z.object({
  name: z.string().min(1).max(100),
  definition: z.string().min(1).max(2000),
  domainId: z.string().uuid(),
  ownerId: z.string().uuid().optional(), // Defaults to current user
  status: BusinessTermStatusEnum.default('DRAFT'),
  synonyms: z.array(z.string()).default([]),
  relatedTerms: z.array(z.string()).default([]),
});

export type CreateBusinessTerm = z.infer<typeof CreateBusinessTermSchema>;

export const UpdateBusinessTermSchema = CreateBusinessTermSchema.partial();
export type UpdateBusinessTerm = z.infer<typeof UpdateBusinessTermSchema>;

export const SemanticMappingSchema = z.object({
  id: z.string().uuid(),
  businessTermId: z.string().uuid(),
  assetId: z.string().uuid(),
  columnName: z.string().optional(),
  mappingType: MappingTypeEnum,
  confidence: z.number().min(0).max(1).default(1.0),
  description: z.string().optional(),
  createdById: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SemanticMapping = z.infer<typeof SemanticMappingSchema>;

export const CreateSemanticMappingSchema = z.object({
  businessTermId: z.string().uuid(),
  assetId: z.string().uuid(),
  columnName: z.string().optional(),
  mappingType: MappingTypeEnum.default('EXACT'),
  confidence: z.number().min(0).max(1).default(1.0),
  description: z.string().max(500).optional(),
});

export type CreateSemanticMapping = z.infer<typeof CreateSemanticMappingSchema>;

export interface BusinessTermWithMappings extends BusinessTerm {
  domain?: BusinessDomain;
  mappings?: SemanticMapping[];
  owner?: { id: string; username: string; email: string };
}

export interface AssetWithBusinessTerms {
  assetId: string;
  assetName: string;
  terms: Array<{
    term: BusinessTerm;
    mapping: SemanticMapping;
  }>;
}

// =====================
// Connection Types
// =====================

export const ConnectionTypeEnum = z.enum([
  'POSTGRESQL',
  'MYSQL',
  'SQLSERVER',
  'ORACLE',
  'SNOWFLAKE',
  'BIGQUERY',
  'REDSHIFT',
]);
export type ConnectionType = z.infer<typeof ConnectionTypeEnum>;

export const DataConnectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  connectionType: ConnectionTypeEnum,
  host: z.string(),
  port: z.number().int().positive(),
  database: z.string().optional(),
  username: z.string().optional(),
  isActive: z.boolean(),
  lastTestedAt: z.date().optional(),
  lastTestSuccess: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DataConnection = z.infer<typeof DataConnectionSchema>;

export const CreateConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  connectionType: ConnectionTypeEnum,
  host: z.string(),
  port: z.number().int().positive(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  additionalConfig: z.record(z.any()).optional(),
});

export type CreateConnection = z.infer<typeof CreateConnectionSchema>;

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  error?: string;
}

export interface SourceSchema {
  databases: DatabaseSchema[];
}

export interface DatabaseSchema {
  name: string;
  tables: TableSchema[];
}

export interface TableSchema {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

// =====================
// File Types
// =====================

export const FileTypeEnum = z.enum(['CSV', 'EXCEL', 'JSON', 'PARQUET']);
export type FileType = z.infer<typeof FileTypeEnum>;

export const FileUploadSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  fileType: FileTypeEnum,
  encoding: z.string().optional(),
  delimiter: z.string().optional(),
  storagePath: z.string(),
  assetId: z.string().uuid().optional(),
  parsedAt: z.date().optional(),
  createdAt: z.date(),
});

export type FileUpload = z.infer<typeof FileUploadSchema>;

export interface ParsedFileResult {
  columns: InferredColumn[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
  encoding: string;
  delimiter?: string;
}

export interface InferredColumn {
  name: string;
  inferredType: string;
  nullable: boolean;
  sampleValues: string[];
}

// =====================
// Quality Types
// =====================

export const RuleTypeEnum = z.enum([
  'COMPLETENESS',
  'UNIQUENESS',
  'RANGE',
  'PATTERN',
  'REFERENTIAL',
  'CUSTOM',
]);
export type RuleType = z.infer<typeof RuleTypeEnum>;

export const SeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export type Severity = z.infer<typeof SeverityEnum>;

export const QualityRuleSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  ruleType: RuleTypeEnum,
  ruleDefinition: z.record(z.any()),
  severity: SeverityEnum,
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdById: z.string().uuid(),
});

export type QualityRule = z.infer<typeof QualityRuleSchema>;

// =====================
// Pagination and Filtering
// =====================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const AssetFiltersSchema = z.object({
  assetType: AssetTypeEnum.optional(),
  ownerId: z.string().uuid().optional(),
  domain: z.string().optional(),
  tags: z.array(z.string()).optional(),
  qualityStatus: QualityStatusEnum.optional(),
  search: z.string().optional(),
});

export type AssetFilters = z.infer<typeof AssetFiltersSchema>;

// =====================
// OpenLineage Types
// =====================

export interface OpenLineageEvent {
  eventType: 'START' | 'COMPLETE' | 'FAIL';
  eventTime: string;
  run: {
    runId: string;
  };
  job: {
    namespace: string;
    name: string;
  };
  inputs?: OpenLineageDataset[];
  outputs?: OpenLineageDataset[];
}

export interface OpenLineageDataset {
  namespace: string;
  name: string;
  facets?: Record<string, unknown>;
}
