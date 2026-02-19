# Design Document: Data Management Platform

## Overview

The Data Management Platform is an open-source TypeScript/Node.js-based system that provides enterprise-grade data cataloging, lineage tracking, and governance capabilities. The platform follows a microservices-inspired architecture with clear separation between the API layer, business logic, data access, and storage layers.

The system is built with Next.js 15 and React 19 for the frontend, Express.js on Node.js 22 for high-performance REST APIs, PostgreSQL for metadata storage, graphlib for graph operations, and integrates with OpenLineage for standardized lineage capture. The architecture prioritizes extensibility, allowing integration with various data sources and tools through a well-defined API contract.

### Key Design Principles

1. **Separation of Concerns**: Clear boundaries between API, business logic, and data layers
2. **Extensibility**: Plugin architecture for custom integrations and lineage extractors
3. **Performance**: Efficient graph traversal and search indexing for large-scale metadata
4. **Standards Compliance**: OpenLineage support for interoperability
5. **Security First**: Authentication, authorization, and audit logging at all layers

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Next.js 15 Web UI, CLI Tools, External Systems via API)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Frontend Layer (Next.js 15)                │
│  - React 19 Components                                       │
│  - Server Components & Client Components                     │
│  - API Routes                                                │
│  - Tailwind CSS + MUI 6 Styling                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  API Layer (Express.js/Node.js 22)           │
│  - REST Endpoints                                            │
│  - Authentication Middleware (JWT)                           │
│  - Request Validation (express-validator)                    │
│  - Response Serialization                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Business Logic Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Catalog    │  │   Lineage    │  │  Governance  │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Search    │  │    Quality   │  │    Access    │     │
│  │   Service    │  │   Service    │  │   Control    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│  - Repository Pattern                                        │
│  - ORM (Prisma or TypeORM)                                  │
│  - Graph Operations (graphlib)                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   PostgreSQL         │  │   Graph Store        │        │
│  │   (Metadata)         │  │   (graphlib/JSON)    │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Frontend Layer (Next.js 15 + React 19)**:
- Server-side rendering and static generation for optimal performance
- React 19 components with server and client component patterns
- Tailwind CSS for utility-first styling
- MUI 6 components for complex UI elements (data grids, dialogs, forms)
- API routes for backend integration
- Client-side state management and data fetching

**API Layer (Express.js/Node.js 22)**:
- Exposes REST endpoints for all platform operations
- Handles authentication via JWT tokens (jsonwebtoken library)
- Validates incoming requests using express-validator
- Serializes responses to JSON
- Implements rate limiting (express-rate-limit) and request logging (morgan)

**Business Logic Layer**:
- **Catalog Service**: Manages data asset lifecycle (CRUD operations, versioning)
- **Lineage Service**: Processes lineage events, builds lineage graphs, performs traversals
- **Governance Service**: Executes workflows, manages approvals
- **Search Service**: Indexes metadata, executes search queries, ranks results
- **Quality Service**: Evaluates quality rules, tracks quality metrics
- **Access Control**: Enforces permissions, manages roles

**Data Access Layer**:
- Implements repository pattern for data persistence
- Abstracts database operations from business logic using Prisma or TypeORM
- Manages transactions and connection pooling (pg library for PostgreSQL)
- Provides graph query interface for lineage operations using graphlib

**Storage Layer**:
- PostgreSQL stores structured metadata (assets, schemas, users, workflows)
- Graph representation stored as adjacency lists in PostgreSQL or serialized graphlib graphs
- Full-text search indexes for metadata discovery (PostgreSQL tsvector and pg_trgm)

## Components and Interfaces

### 1. Catalog Service

**Responsibilities**:
- Create, read, update, delete data assets
- Version metadata changes
- Manage schema registration and evolution
- Handle bulk operations

**Key Methods**:
```typescript
class CatalogService {
  async createAsset(assetData: AssetCreate): Promise<Asset>
  async getAsset(assetId: string): Promise<Asset>
  async updateAsset(assetId: string, updates: AssetUpdate): Promise<Asset>
  async deleteAsset(assetId: string): Promise<boolean>
  async listAssets(filters: AssetFilters, pagination: Pagination): Promise<Asset[]>
  async getAssetHistory(assetId: string): Promise<AssetVersion[]>
  async registerSchema(assetId: string, schema: Schema): Promise<SchemaVersion>
  async bulkImport(assets: AssetCreate[]): Promise<BulkImportResult>
}
```

**Dependencies**:
- AssetRepository (data access)
- SchemaValidator (validation using Ajv or Zod)
- VersionManager (versioning)

### 2. Lineage Service

**Responsibilities**:
- Capture lineage events from OpenLineage
- Parse SQL to extract lineage relationships
- Build and maintain lineage graph
- Perform upstream/downstream traversals
- Execute impact analysis

**Key Methods**:
```typescript
class LineageService {
  async ingestLineageEvent(event: OpenLineageEvent): Promise<void>
  async parseSqlLineage(sql: string, dialect: string): Promise<LineageRelationships>
  async getUpstreamLineage(assetId: string, depth: number): Promise<LineageGraph>
  async getDownstreamLineage(assetId: string, depth: number): Promise<LineageGraph>
  async performImpactAnalysis(assetId: string, maxDepth: number): Promise<ImpactAnalysisResult>
  async getLineagePath(sourceId: string, targetId: string): Promise<LineagePath[]>
}
```

**Dependencies**:
- LineageRepository (data access)
- node-sql-parser (SQL parsing)
- graphlib (graph operations)
- @openlineage/client (OpenLineage event parsing)

### 3. Search Service

**Responsibilities**:
- Index metadata for full-text search
- Execute search queries with ranking
- Apply filters and facets
- Suggest alternative search terms

**Key Methods**:
```typescript
class SearchService {
  async indexAsset(asset: Asset): Promise<void>
  async search(query: string, filters: SearchFilters): Promise<SearchResults>
  async suggestTerms(partialQuery: string): Promise<string[]>
  async getFacets(query: string): Promise<Record<string, FacetValue[]>>
}
```

**Dependencies**:
- SearchRepository (data access)
- PostgreSQL full-text search (pg_trgm extension, tsvector)

### 4. Governance Service

**Responsibilities**:
- Define and store workflow templates
- Execute workflow instances
- Manage approval processes
- Track workflow state and history

**Key Methods**:
```typescript
class GovernanceService {
  async createWorkflow(workflowDef: WorkflowDefinition): Promise<Workflow>
  async triggerWorkflow(workflowId: string, context: Record<string, any>): Promise<WorkflowInstance>
  async approveStep(instanceId: string, stepId: string, approver: User): Promise<void>
  async rejectStep(instanceId: string, stepId: string, approver: User, reason: string): Promise<void>
  async getWorkflowStatus(instanceId: string): Promise<WorkflowStatus>
}
```

**Dependencies**:
- WorkflowRepository (data access)
- NotificationService (alerts using nodemailer or similar)

### 5. Quality Service

**Responsibilities**:
- Define and store quality rules
- Execute quality validations
- Track quality metrics over time
- Generate quality alerts

**Key Methods**:
```typescript
class QualityService {
  async createQualityRule(rule: QualityRuleDefinition): Promise<QualityRule>
  async evaluateRule(ruleId: string, assetId: string): Promise<QualityResult>
  async getQualityStatus(assetId: string): Promise<QualityStatus>
  async getQualityHistory(assetId: string, timeRange: TimeRange): Promise<QualityResult[]>
}
```

**Dependencies**:
- QualityRepository (data access)
- NotificationService (alerts)

### 6. Access Control Service

**Responsibilities**:
- Enforce role-based access control
- Manage user permissions
- Audit access attempts
- Validate authorization for operations

**Key Methods**:
```typescript
class AccessControlService {
  async checkPermission(user: User, assetId: string, action: Action): Promise<boolean>
  async grantPermission(assetId: string, userId: string, permissions: Permission[]): Promise<void>
  async revokePermission(assetId: string, userId: string): Promise<void>
  async getUserPermissions(userId: string): Promise<Permission[]>
  async auditAccess(user: User, assetId: string, action: Action, result: boolean): Promise<void>
}
```

**Dependencies**:
- PermissionRepository (data access)
- AuditLogger (logging using winston or pino)

### 7. Authentication Service

**Responsibilities**:
- Authenticate users
- Generate and validate JWT tokens
- Manage sessions
- Enforce password policies

**Key Methods**:
```typescript
class AuthenticationService {
  async authenticate(username: string, password: string): Promise<AuthToken>
  async validateToken(token: string): Promise<User>
  async refreshToken(refreshToken: string): Promise<AuthToken>
  async logout(token: string): Promise<void>
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean>
}
```

**Dependencies**:
- UserRepository (data access)
- PasswordHasher (bcrypt library)
- TokenManager (jsonwebtoken library)

### 8. Data Connector Service

**Responsibilities**:
- Manage data source connections
- Extract metadata from external data sources
- Infer schemas from files (CSV, Excel)
- Provide data preview and profiling capabilities

**Key Methods**:
```typescript
class DataConnectorService {
  async createConnection(connectionConfig: ConnectionConfig): Promise<DataConnection>
  async testConnection(connectionId: string): Promise<ConnectionTestResult>
  async exploreSource(connectionId: string): Promise<SourceSchema>
  async extractMetadata(connectionId: string, incremental: boolean): Promise<MetadataExtractionResult>
  async uploadFile(file: UploadedFile, fileType: FileType): Promise<FileParseResult>
  async inferSchema(fileData: Buffer, fileType: FileType): Promise<InferredSchema>
  async previewData(assetId: string, limit: number): Promise<DataPreview>
  async profileData(assetId: string): Promise<DataProfile>
}
```

**Dependencies**:
- ConnectionRepository (data access)
- Database drivers (pg for PostgreSQL, mysql2, tedious for SQL Server)
- File parsers (csv-parse, xlsx for Excel)
- CatalogService (asset creation)

### 9. File Parser Service

**Responsibilities**:
- Parse CSV files with various delimiters and encodings
- Parse Excel files and extract sheets
- Infer data types from file content
- Handle encoding detection

**Key Methods**:
```typescript
class FileParserService {
  async parseCsv(fileData: Buffer, delimiter: string, encoding: string): Promise<ParsedData>
  async parseExcel(fileData: Buffer): Promise<Record<string, ParsedData>>
  async inferDelimiter(fileData: Buffer): Promise<string>
  async detectEncoding(fileData: Buffer): Promise<string>
  async inferColumnTypes(data: ParsedData): Promise<ColumnType[]>
}
```

**Dependencies**:
- csv-parse (CSV parsing)
- chardet or jschardet (encoding detection)
- xlsx (Excel parsing)

## Data Models

### Core Entities

**Asset**:
```typescript
interface Asset {
  id: string; // UUID
  name: string;
  description: string;
  assetType: AssetType; // TABLE, COLUMN, DATASET, PIPELINE, etc.
  ownerId: string; // UUID
  domain: string;
  tags: string[];
  customProperties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // UUID
  updatedBy: string; // UUID
  version: number;
}
```

**Schema**:
```typescript
interface Schema {
  id: string; // UUID
  assetId: string; // UUID
  version: number;
  schemaFormat: string; // JSON_SCHEMA, AVRO, etc.
  schemaDefinition: Record<string, any>;
  isBreakingChange: boolean;
  createdAt: Date;
  createdBy: string; // UUID
}
```

**LineageEdge**:
```typescript
interface LineageEdge {
  id: string; // UUID
  sourceAssetId: string; // UUID
  targetAssetId: string; // UUID
  transformationType: string; // SQL, SPARK, PYTHON, etc.
  transformationLogic?: string;
  createdAt: Date;
  metadata: Record<string, any>;
}
```

**QualityRule**:
```typescript
interface QualityRule {
  id: string; // UUID
  assetId: string; // UUID
  ruleType: RuleType; // COMPLETENESS, UNIQUENESS, RANGE, CUSTOM
  ruleDefinition: Record<string, any>;
  severity: Severity; // CRITICAL, WARNING, INFO
  enabled: boolean;
  createdAt: Date;
  createdBy: string; // UUID
}
```

**WorkflowInstance**:
```typescript
interface WorkflowInstance {
  id: string; // UUID
  workflowId: string; // UUID
  status: WorkflowStatus; // PENDING, IN_PROGRESS, COMPLETED, FAILED
  currentStep: number;
  context: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  startedBy: string; // UUID
}
```

**User**:
```typescript
interface User {
  id: string; // UUID
  username: string;
  email: string;
  passwordHash: string;
  role: Role; // DATA_STEWARD, DATA_ENGINEER, BUSINESS_ANALYST, ADMIN
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}
```

**DataConnection**:
```typescript
interface DataConnection {
  id: string; // UUID
  name: string;
  connectionType: ConnectionType; // POSTGRESQL, MYSQL, SQLSERVER, ORACLE, FILE
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  passwordEncrypted?: string;
  connectionParams: Record<string, any>;
  createdAt: Date;
  createdBy: string; // UUID
  lastTested?: Date;
  testStatus: ConnectionStatus; // SUCCESS, FAILED, UNTESTED
}
```

**FileUpload**:
```typescript
interface FileUpload {
  id: string; // UUID
  filename: string;
  fileType: FileType; // CSV, EXCEL
  fileSize: number;
  encoding: string;
  delimiter?: string; // For CSV files
  sheetNames?: string[]; // For Excel files
  uploadedAt: Date;
  uploadedBy: string; // UUID
  assetId?: string; // UUID - Linked asset after processing
}
```

**DataProfile**:
```typescript
interface DataProfile {
  id: string; // UUID
  assetId: string; // UUID
  rowCount: number;
  columnProfiles: ColumnProfile[];
  profiledAt: Date;
  profiledBy: string; // UUID
}
```

**ColumnProfile**:
```typescript
interface ColumnProfile {
  columnName: string;
  dataType: string;
  nullCount: number;
  nullPercentage: number;
  distinctCount: number;
  minValue?: any;
  maxValue?: any;
  meanValue?: number;
  stdDev?: number;
  topValues: Array<[any, number]>; // [value, count] tuples
}
```

### Database Schema Design

**PostgreSQL Tables**:
- `assets`: Core asset metadata
- `asset_versions`: Historical versions of asset metadata
- `schemas`: Schema definitions and versions
- `lineage_edges`: Lineage relationships between assets
- `quality_rules`: Quality rule definitions
- `quality_results`: Quality evaluation results
- `workflows`: Workflow definitions
- `workflow_instances`: Workflow execution instances
- `users`: User accounts
- `permissions`: Access control permissions
- `audit_log`: Access and modification audit trail
- `relationships`: Semantic relationships between assets
- `data_connections`: Data source connection configurations
- `file_uploads`: Uploaded file metadata
- `data_profiles`: Data profiling results
- `column_profiles`: Column-level profiling statistics

**Indexes**:
- Full-text search indexes on asset names and descriptions (GIN indexes with tsvector)
- B-tree indexes on foreign keys and frequently queried fields
- Composite indexes for common query patterns (e.g., asset_type + domain)

## Lineage Graph Implementation

### Graph Storage Strategy

The lineage graph is represented as a directed graph where:
- **Nodes**: Data assets (identified by asset_id)
- **Edges**: Lineage relationships with transformation metadata

**Storage Options**:

1. **PostgreSQL Adjacency List** (Recommended for MVP):
   - Store edges in `lineage_edges` table
   - Use recursive CTEs for graph traversal
   - Pros: ACID guarantees, simple backup/restore, SQL queries
   - Cons: Complex queries for deep traversals

2. **graphlib In-Memory Graph**:
   - Load graph from PostgreSQL on startup
   - Perform traversals in memory
   - Periodically sync to PostgreSQL
   - Pros: Fast traversals, rich graph algorithms
   - Cons: Memory overhead, requires synchronization

**MVP Approach**: Use PostgreSQL with recursive CTEs for traversal, with graphlib for complex graph algorithms (e.g., shortest path, cycle detection).

### Lineage Traversal Algorithms

**Upstream Lineage** (find all sources):
```typescript
async function getUpstreamLineage(assetId: string, maxDepth: number): Promise<LineageGraph> {
  // Use breadth-first search from target asset
  // Traverse edges in reverse direction (target -> source)
  // Stop at maxDepth or when no more parents found
  // Return subgraph with all discovered nodes and edges
}
```

**Downstream Lineage** (find all consumers):
```typescript
async function getDownstreamLineage(assetId: string, maxDepth: number): Promise<LineageGraph> {
  // Use breadth-first search from source asset
  // Traverse edges in forward direction (source -> target)
  // Stop at maxDepth or when no more children found
  // Return subgraph with all discovered nodes and edges
}
```

**Impact Analysis**:
```typescript
async function performImpactAnalysis(assetId: string, maxDepth: number): Promise<ImpactAnalysisResult> {
  // Get downstream lineage
  // Group impacted assets by type
  // Calculate dependency paths
  // Return structured impact report
}
```

### SQL Lineage Parsing

Use node-sql-parser to parse SQL and extract column-level lineage:

```typescript
async function parseSqlLineage(sql: string, dialect: string): Promise<LineageRelationships> {
  // Parse SQL using node-sql-parser
  // Extract table references from FROM and JOIN clauses
  // Extract column references and transformations
  // Build lineage edges for table-level and column-level dependencies
  // Return structured lineage relationships
}
```

## Frontend Architecture

### Technology Stack

**Next.js 15**:
- App Router for file-based routing
- Server Components for optimal performance and SEO
- Client Components for interactive UI elements
- API Routes for backend integration
- Server Actions for form handling and mutations

**React 19**:
- Latest React features including improved server components
- Concurrent rendering for better performance
- Enhanced hooks and state management

**Styling**:
- Tailwind CSS for utility-first styling and rapid development
- MUI 6 (Material-UI) for complex components:
  - DataGrid for asset listings and search results
  - Dialog components for modals and forms
  - Form components with validation
  - Charts for data profiling visualizations

**State Management**:
- React Context for global state (user authentication, theme)
- TanStack Query (React Query) for server state management and caching
- Zustand for client-side state (UI preferences, filters)

**Data Visualization**:
- React Flow or Cytoscape.js for lineage graph visualization
- Recharts or Chart.js for data profiling charts
- D3.js for custom visualizations if needed

### Frontend Components

**Core Pages**:
- `/` - Dashboard with recent assets and activity
- `/assets` - Asset catalog with search and filters
- `/assets/[id]` - Asset detail page with metadata, lineage, and quality
- `/lineage/[id]` - Interactive lineage visualization
- `/search` - Advanced search interface
- `/workflows` - Governance workflow management
- `/quality` - Data quality dashboard
- `/admin` - User and permission management

**Reusable Components**:
- `AssetCard` - Display asset summary
- `LineageGraph` - Interactive lineage visualization
- `SearchBar` - Search with autocomplete
- `FilterPanel` - Multi-faceted filtering
- `QualityBadge` - Quality status indicator
- `WorkflowStepper` - Workflow progress visualization
- `DataPreview` - Tabular data preview
- `SchemaViewer` - Schema visualization

### API Integration

**API Client**:
- Axios or Fetch API for HTTP requests
- TanStack Query for data fetching, caching, and synchronization
- Automatic retry logic and error handling
- Request/response interceptors for authentication

**Authentication Flow**:
- JWT tokens stored in httpOnly cookies
- Automatic token refresh
- Protected routes with middleware
- Role-based UI rendering

## API Design

### REST API Endpoints

**Assets**:
- `POST /api/v1/assets` - Create asset
- `GET /api/v1/assets/{asset_id}` - Get asset
- `PUT /api/v1/assets/{asset_id}` - Update asset
- `DELETE /api/v1/assets/{asset_id}` - Delete asset
- `GET /api/v1/assets` - List assets (with filters and pagination)
- `GET /api/v1/assets/{asset_id}/history` - Get asset history
- `POST /api/v1/assets/bulk` - Bulk import assets

**Lineage**:
- `POST /api/v1/lineage/events` - Ingest OpenLineage event
- `POST /api/v1/lineage/sql` - Parse SQL for lineage
- `GET /api/v1/lineage/{asset_id}/upstream` - Get upstream lineage
- `GET /api/v1/lineage/{asset_id}/downstream` - Get downstream lineage
- `GET /api/v1/lineage/{asset_id}/impact` - Perform impact analysis

**Search**:
- `GET /api/v1/search` - Search assets
- `GET /api/v1/search/suggest` - Get search suggestions
- `GET /api/v1/search/facets` - Get search facets

**Schemas**:
- `POST /api/v1/assets/{asset_id}/schemas` - Register schema
- `GET /api/v1/assets/{asset_id}/schemas` - List schema versions
- `GET /api/v1/assets/{asset_id}/schemas/{version}` - Get specific schema version

**Quality**:
- `POST /api/v1/quality/rules` - Create quality rule
- `POST /api/v1/quality/rules/{rule_id}/evaluate` - Evaluate quality rule
- `GET /api/v1/assets/{asset_id}/quality` - Get quality status

**Governance**:
- `POST /api/v1/workflows` - Create workflow
- `POST /api/v1/workflows/{workflow_id}/trigger` - Trigger workflow
- `POST /api/v1/workflows/instances/{instance_id}/approve` - Approve workflow step
- `GET /api/v1/workflows/instances/{instance_id}` - Get workflow status

**Authentication**:
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token

**Data Connectors**:
- `POST /api/v1/connections` - Create data source connection
- `GET /api/v1/connections` - List connections
- `GET /api/v1/connections/{connection_id}` - Get connection details
- `PUT /api/v1/connections/{connection_id}` - Update connection
- `DELETE /api/v1/connections/{connection_id}` - Delete connection
- `POST /api/v1/connections/{connection_id}/test` - Test connection
- `GET /api/v1/connections/{connection_id}/explore` - Explore source schema
- `POST /api/v1/connections/{connection_id}/extract` - Extract metadata

**File Operations**:
- `POST /api/v1/files/upload` - Upload CSV or Excel file
- `GET /api/v1/files/{file_id}` - Get file metadata
- `POST /api/v1/files/{file_id}/parse` - Parse and infer schema
- `GET /api/v1/assets/{asset_id}/preview` - Preview data
- `GET /api/v1/assets/{asset_id}/profile` - Get data profile
- `POST /api/v1/assets/{asset_id}/profile` - Generate data profile

### Request/Response Formats

All API requests and responses use JSON format. Responses follow a consistent structure:

**Success Response**:
```json
{
  "status": "success",
  "data": { ... },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "uuid"
  }
}
```

**Error Response**:
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid asset type",
    "details": [...]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "uuid"
  }
}
```

### Authentication Flow

1. Client sends credentials to `/api/v1/auth/login`
2. Server validates credentials and returns JWT access token and refresh token
3. Client includes access token in `Authorization: Bearer <token>` header for subsequent requests
4. Server validates token on each request using middleware
5. When access token expires, client uses refresh token to get new access token
6. On logout, server invalidates tokens

## OpenLineage Integration

### Event Processing

The platform accepts OpenLineage events via the `/api/v1/lineage/events` endpoint. Events follow the OpenLineage specification:

```json
{
  "eventType": "COMPLETE",
  "eventTime": "2024-01-15T10:30:00Z",
  "run": {
    "runId": "uuid",
    "facets": {}
  },
  "job": {
    "namespace": "my_namespace",
    "name": "my_job",
    "facets": {}
  },
  "inputs": [
    {
      "namespace": "my_namespace",
      "name": "input_dataset",
      "facets": {}
    }
  ],
  "outputs": [
    {
      "namespace": "my_namespace",
      "name": "output_dataset",
      "facets": {}
    }
  ]
}
```

**Processing Steps**:
1. Validate event against OpenLineage schema
2. Extract input and output datasets
3. Create or update asset entries for datasets
4. Create lineage edges from inputs to outputs
5. Store transformation metadata from job facets
6. Update lineage graph

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Asset Creation Uniqueness

*For any* valid data asset metadata submitted to the Metadata_Catalog, creating the asset should assign a unique identifier that can be used to retrieve the exact same asset metadata.

**Validates: Requirements 1.1**

### Property 2: Search Result Relevance

*For any* search query and indexed assets, all returned results should contain the search terms in at least one searchable field (name, description, column names, or tags).

**Validates: Requirements 1.2, 5.1**

### Property 3: Metadata Retrieval Completeness

*For any* data asset stored in the catalog, retrieving the asset should return all originally submitted metadata fields including schema, ownership, tags, and custom properties.

**Validates: Requirements 1.3**

### Property 4: Metadata Versioning on Updates

*For any* existing data asset, when metadata is updated, the version number should increment and the previous version should remain accessible in the history.

**Validates: Requirements 1.5, 12.1, 12.2**

### Property 5: Lineage Capture Completeness

*For any* data transformation event, the Lineage_Engine should capture and store all source asset IDs, target asset IDs, and transformation metadata.

**Validates: Requirements 2.1**

### Property 6: Lineage Storage Integrity

*For any* valid lineage metadata submitted via the API, after storage, retrieving the lineage should return equivalent source-target relationships.

**Validates: Requirements 2.2**

### Property 7: SQL Lineage Extraction Accuracy

*For any* valid SQL query, parsing should extract all table references from FROM and JOIN clauses as lineage relationships.

**Validates: Requirements 2.3**

### Property 8: Bidirectional Lineage Retrieval

*For any* data asset with lineage relationships, requesting lineage should return both upstream (sources) and downstream (targets) dependencies.

**Validates: Requirements 2.4**

### Property 9: OpenLineage Event Processing

*For any* valid OpenLineage event, processing should create lineage edges from all input datasets to all output datasets.

**Validates: Requirements 2.5**

### Property 10: Lineage Graph Completeness

*For any* data asset in a lineage graph, the visualization should include all directly connected nodes (both upstream and downstream).

**Validates: Requirements 3.1**

### Property 11: Node Type Distinction

*For any* lineage graph containing different asset types, the visualization output should include type information for each node allowing visual distinction.

**Validates: Requirements 3.2**

### Property 12: DAG Structure Validation

*For any* lineage graph generated by the platform, the graph structure should be a directed acyclic graph (no cycles).

**Validates: Requirements 3.4**

### Property 13: Node Metadata Availability

*For any* node in a lineage visualization, requesting details for that node should return the complete asset metadata.

**Validates: Requirements 3.5**

### Property 14: Downstream Impact Identification

*For any* data asset, impact analysis should identify all assets reachable by following downstream lineage edges within the specified depth limit.

**Validates: Requirements 4.1**

### Property 15: Impact Analysis Depth Limiting

*For any* data asset and configured depth N, impact analysis should not return assets that require more than N edge traversals to reach.

**Validates: Requirements 4.2**

### Property 16: Impact Analysis Result Completeness

*For any* impact analysis result, each impacted asset should include its name, type, and at least one dependency path from the source asset.

**Validates: Requirements 4.3**

### Property 17: Impact Count Accuracy

*For any* impact analysis result, the total count of impacted assets by type should equal the number of unique assets in the result set when grouped by type.

**Validates: Requirements 4.5**

### Property 18: Search Filter Correctness

*For any* search query with filters applied, all returned assets should match every specified filter criterion.

**Validates: Requirements 5.3**

### Property 19: Multi-Field Filter Support

*For any* combination of filters (asset type, owner, domain, quality status), the search should correctly apply all filters and return only matching assets.

**Validates: Requirements 5.4**

### Property 20: Workflow Definition Validation

*For any* valid workflow definition submitted by a Data_Steward, the platform should store it and make it available for triggering.

**Validates: Requirements 6.1**

### Property 21: Workflow Step Sequencing

*For any* workflow with defined step order, execution should process steps in the exact sequence specified in the workflow definition.

**Validates: Requirements 6.2**

### Property 22: Workflow Audit Logging

*For any* workflow execution, all state transitions and actions should be recorded in the audit log with timestamps and user information.

**Validates: Requirements 6.4, 8.4**

### Property 23: Workflow Completion State Update

*For any* workflow that completes successfully, all affected data assets should have their governance status updated to reflect the workflow outcome.

**Validates: Requirements 6.5**

### Property 24: Quality Rule Storage

*For any* valid data quality rule definition, the platform should store it associated with the correct data asset and make it available for evaluation.

**Validates: Requirements 7.1**

### Property 25: Quality Rule Execution Recording

*For any* quality rule evaluation, the platform should record the result (pass/fail), timestamp, and any validation details.

**Validates: Requirements 7.2, 7.5**

### Property 26: Quality Rule Type Support

*For any* quality rule of type completeness, uniqueness, or range validation, the platform should correctly evaluate the rule against the data asset.

**Validates: Requirements 7.3**

### Property 27: Quality Failure Handling

*For any* quality rule that fails evaluation, the platform should update the asset's quality status and generate an alert notification.

**Validates: Requirements 7.4**

### Property 28: Permission Enforcement

*For any* user attempting to access a data asset, the platform should grant access if and only if the user has appropriate permissions for the requested action.

**Validates: Requirements 8.1, 8.3**

### Property 29: Role-Based Access Control

*For any* user with a predefined role (Data_Steward, Data_Engineer, Business_Analyst), the platform should enforce the permissions associated with that role.

**Validates: Requirements 8.2**

### Property 30: Unauthorized Access Error Handling

*For any* user lacking permission to access an asset, the platform should return an authorization error without including asset metadata in the response.

**Validates: Requirements 8.5**

### Property 31: API Authentication

*For any* API request with valid authentication credentials (API key or OAuth token), the platform should authenticate the client and process the request.

**Validates: Requirements 9.3**

### Property 32: API Response Format

*For any* API request, the response should be valid JSON with appropriate HTTP status codes (2xx for success, 4xx for client errors, 5xx for server errors).

**Validates: Requirements 9.4**

### Property 33: API Validation Error Details

*For any* API request that fails validation, the error response should include specific details about which fields or values caused the validation failure.

**Validates: Requirements 9.5**

### Property 34: Schema Validation and Storage

*For any* valid schema definition (JSON Schema or Avro format) submitted for a data asset, the platform should validate the structure and store it with a version number.

**Validates: Requirements 10.1, 10.2**

### Property 35: Schema Versioning

*For any* schema update to an existing data asset, the platform should create a new version while maintaining all previous versions accessible.

**Validates: Requirements 10.3**

### Property 36: Schema Version Retrieval

*For any* data asset with multiple schema versions, requesting the schema without specifying a version should return the latest version, while specifying a version should return that exact version.

**Validates: Requirements 10.4**

### Property 37: Breaking Change Detection

*For any* two consecutive schema versions, the platform should correctly identify breaking changes such as removed fields, type changes, or added required fields.

**Validates: Requirements 10.5**

### Property 38: Authentication Token Generation

*For any* user submitting valid credentials, the platform should authenticate the user and return a valid session token that can be used for subsequent requests.

**Validates: Requirements 11.1**

### Property 39: Password Security

*For any* user password stored in the system, the stored value should be a cryptographic hash, never the plaintext password.

**Validates: Requirements 11.2**

### Property 40: Token Expiration Enforcement

*For any* expired session token, the platform should reject requests using that token and require re-authentication.

**Validates: Requirements 11.3**

### Property 41: Password Complexity Validation

*For any* password submitted during user creation or password change, the platform should enforce minimum length and character diversity requirements.

**Validates: Requirements 11.4**

### Property 42: Token Invalidation on Logout

*For any* user logout action, the session token should be immediately invalidated and rejected for all subsequent requests.

**Validates: Requirements 11.5**

### Property 43: Version History Ordering

*For any* data asset with multiple versions, requesting the history should return all versions ordered by timestamp in descending order (newest first).

**Validates: Requirements 12.3**

### Property 44: Version Comparison

*For any* two versions of the same data asset, the platform should identify and return all fields that differ between the versions.

**Validates: Requirements 12.4**

### Property 45: Version Restoration Creates New Version

*For any* historical version restoration, the platform should create a new version with the historical content rather than overwriting the current version.

**Validates: Requirements 12.5**

### Property 46: Bulk Import Atomic Validation

*For any* bulk import submission, if any entry fails validation, the platform should reject the entire import without processing any entries.

**Validates: Requirements 13.1**

### Property 47: Bulk Operation Type Support

*For any* bulk operation type (create, update, delete), the platform should correctly process all valid entries of that operation type.

**Validates: Requirements 13.2**

### Property 48: Bulk Operation Error Reporting

*For any* bulk operation with some invalid entries, the platform should report all validation errors while still processing all valid entries.

**Validates: Requirements 13.4**

### Property 49: Relationship Validation

*For any* relationship creation between two data assets, the platform should verify both assets exist before storing the relationship.

**Validates: Requirements 14.1**

### Property 50: Relationship Type Support

*For any* relationship of type "derived_from", "related_to", or "replaces", the platform should correctly store and retrieve the relationship with its type.

**Validates: Requirements 14.2**

### Property 51: Relationship Query Completeness

*For any* data asset with relationships, querying relationships should return all connected assets with their relationship types.

**Validates: Requirements 14.3**

### Property 52: Circular Relationship Prevention

*For any* attempt to create a relationship that would form a cycle in the relationship graph, the platform should reject the relationship creation.

**Validates: Requirements 14.4**

### Property 53: Cascading Relationship Updates

*For any* data asset deletion, all relationships involving that asset should be removed or updated to maintain referential integrity.

**Validates: Requirements 14.5**

### Property 54: Event-Driven Notifications

*For any* event that triggers notifications (quality rule failure, workflow action required), the platform should queue or send notifications to all configured recipients.

**Validates: Requirements 15.1, 15.3**

### Property 55: Notification Preference Enforcement

*For any* user with configured notification preferences, the platform should only send notifications for event types the user has enabled.

**Validates: Requirements 15.4**

### Property 56: Notification Batching

*For any* sequence of multiple notification events within a short time window, the platform should batch them into a single notification to prevent overwhelming users.

**Validates: Requirements 15.5**

### Property 57: Data Connection Validation

*For any* data source connection configuration with valid credentials, testing the connection should successfully connect and return a success status.

**Validates: Requirements 16.2**

### Property 58: Schema Exploration Completeness

*For any* connected data source, exploring the source should retrieve and return all databases, tables, and columns accessible with the provided credentials.

**Validates: Requirements 16.3**

### Property 59: Metadata Extraction Asset Creation

*For any* metadata extracted from a connected data source, the platform should create or update corresponding data asset entries in the catalog.

**Validates: Requirements 16.5**

### Property 60: CSV Schema Inference

*For any* valid CSV file uploaded, the platform should parse the file and infer a schema including all column names and data types.

**Validates: Requirements 17.1**

### Property 61: Excel Multi-Sheet Parsing

*For any* valid Excel file uploaded, the platform should parse all sheets and infer schemas for each sheet independently.

**Validates: Requirements 17.2**

### Property 62: CSV Delimiter Support

*For any* CSV file with delimiters (comma, semicolon, tab, pipe), the platform should correctly parse the file using the appropriate delimiter.

**Validates: Requirements 17.3**

### Property 63: File Encoding Handling

*For any* file with common encodings (UTF-8, UTF-16, ISO-8859-1), the platform should correctly decode and parse the file content.

**Validates: Requirements 17.4**

### Property 64: File Parse Asset Creation

*For any* successfully parsed file, the platform should create a data asset entry with the inferred schema and file metadata.

**Validates: Requirements 17.5**

### Property 65: Data Preview Row Limiting

*For any* data asset with a preview request, the platform should return at most the requested number of rows (default 100).

**Validates: Requirements 18.1**

### Property 66: Basic Profiling Statistics

*For any* data asset profiled, the platform should calculate and return row count, null count, and distinct value count for each column.

**Validates: Requirements 18.2**

### Property 67: Numeric Column Profiling

*For any* numeric column in a profiled data asset, the platform should calculate min, max, mean, and standard deviation.

**Validates: Requirements 18.3**

### Property 68: String Column Profiling

*For any* string column in a profiled data asset, the platform should identify and return the most frequent values with their counts.

**Validates: Requirements 18.4**

### Property 69: Profile Result Caching

*For any* data asset profiled multiple times without changes, subsequent profile requests should return cached results without recomputation.

**Validates: Requirements 18.5**

### Property 70: Connection Credential Encryption

*For any* data source connection created, the platform should store credentials in encrypted form, never in plaintext.

**Validates: Requirements 19.1**

### Property 71: Connection CRUD Operations

*For any* data source connection, the platform should support create, read, update, and delete operations maintaining referential integrity.

**Validates: Requirements 19.2**

### Property 72: Connection Test Error Reporting

*For any* connection test that fails, the platform should return detailed error messages indicating the specific failure reason.

**Validates: Requirements 19.3**

### Property 73: Connection Asset Tracking

*For any* data source connection, the platform should track and return all data assets that were extracted from that connection.

**Validates: Requirements 19.4**

### Property 74: Connection Deletion Asset Handling

*For any* data source connection deletion, the platform should handle associated data assets according to user preference (preserve or remove).

**Validates: Requirements 19.5**

## Error Handling

### Error Categories

The platform implements structured error handling across all layers:

1. **Validation Errors** (HTTP 400):
   - Invalid input data format
   - Missing required fields
   - Schema validation failures
   - Business rule violations

2. **Authentication Errors** (HTTP 401):
   - Invalid credentials
   - Expired tokens
   - Missing authentication headers

3. **Authorization Errors** (HTTP 403):
   - Insufficient permissions
   - Role-based access denials
   - Resource access restrictions

4. **Not Found Errors** (HTTP 404):
   - Asset does not exist
   - Endpoint not found
   - Version not found

5. **Conflict Errors** (HTTP 409):
   - Duplicate asset names
   - Circular relationship attempts
   - Concurrent modification conflicts

6. **Server Errors** (HTTP 500):
   - Database connection failures
   - Unexpected exceptions
   - External service failures

### Error Response Structure

All errors follow a consistent JSON structure:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "field_name",
        "issue": "specific problem",
        "value": "invalid_value"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "uuid",
    "trace_id": "uuid"
  }
}
```

### Error Handling Strategies

**Graceful Degradation**:
- If search indexing fails, fall back to database queries
- If lineage visualization is too complex, offer simplified view
- If external notifications fail, log errors and retry

**Transaction Management**:
- Use database transactions for multi-step operations
- Rollback on any failure in bulk operations (when atomic validation is required)
- Implement idempotency for API operations

**Retry Logic**:
- Implement exponential backoff for transient failures
- Retry database connection failures
- Retry external API calls with circuit breaker pattern

**Logging and Monitoring**:
- Log all errors with full context (user, request, stack trace)
- Track error rates and patterns
- Alert on critical error thresholds

## Testing Strategy

The platform employs a comprehensive testing approach combining unit tests, property-based tests, and integration tests to ensure correctness and reliability.

### Unit Testing

Unit tests focus on specific examples, edge cases, and error conditions:

**Catalog Service**:
- Test asset creation with various metadata combinations
- Test asset retrieval for non-existent IDs (404 errors)
- Test bulk import with empty input
- Test schema validation with malformed schemas

**Lineage Service**:
- Test SQL parsing with various SQL dialects
- Test lineage traversal with empty graphs
- Test impact analysis with assets having no dependencies
- Test cycle detection in lineage graphs

**Search Service**:
- Test search with empty query strings
- Test search with special characters
- Test filtering with no matching results
- Test pagination edge cases

**Quality Service**:
- Test quality rule evaluation with edge case data
- Test completeness rules with null values
- Test range validation with boundary values

**Access Control**:
- Test permission checks for non-existent users
- Test role assignment and revocation
- Test audit logging for failed access attempts

**Data Connectors**:
- Test connection creation with various database types
- Test connection testing with invalid credentials
- Test schema exploration with empty databases
- Test file upload with corrupted files
- Test CSV parsing with malformed data
- Test Excel parsing with empty sheets
- Test encoding detection with mixed encodings

**Data Profiling**:
- Test profiling with empty datasets
- Test numeric profiling with null values
- Test string profiling with special characters
- Test profile caching behavior

### Property-Based Testing

Property-based tests verify universal properties across randomly generated inputs. Each test should run a minimum of 100 iterations.

**Configuration**: Use fast-check (TypeScript/JavaScript) for property-based testing with the following configuration:
```typescript
import fc from 'fast-check';

describe('Feature: data-management-platform, Property 1: Asset Creation Uniqueness', () => {
  it('should assign unique IDs to all created assets', async () => {
    await fc.assert(
      fc.asyncProperty(validAssetMetadata(), async (assetData) => {
        const asset1 = await catalogService.createAsset(assetData);
        const asset2 = await catalogService.createAsset(assetData);
        expect(asset1.id).not.toBe(asset2.id);
        const retrieved = await catalogService.getAsset(asset1.id);
        expect(retrieved).toEqual(asset1);
      }),
      { numRuns: 100 }
    );
  });
});
```

**Test Tagging**: Each property test must reference its design document property using the comment format shown above.

**Generator Strategies**:
- Define fast-check arbitraries for generating valid assets, schemas, lineage events
- Include edge cases in generators (empty strings, maximum lengths, special characters)
- Generate realistic data distributions

**Key Property Tests**:
- Asset creation uniqueness (Property 1)
- Search result relevance (Property 2)
- Metadata round-trip (Property 3)
- Lineage bidirectional traversal (Property 8)
- Permission enforcement (Property 28)
- Schema versioning (Property 35)
- Token expiration (Property 40)
- Circular relationship prevention (Property 52)
- CSV schema inference (Property 60)
- Connection credential encryption (Property 70)
- Data preview row limiting (Property 65)

### Integration Testing

Integration tests verify interactions between components:

**API Integration**:
- Test complete workflows through REST API
- Test authentication and authorization flows
- Test OpenLineage event ingestion end-to-end

**Database Integration**:
- Test transaction rollback scenarios
- Test concurrent access and locking
- Test query performance with large datasets

**External System Integration**:
- Test OpenLineage client integration
- Test notification delivery (email, alerts using nodemailer)
- Test node-sql-parser with various SQL dialects
- Test database connector integration (PostgreSQL via pg, MySQL via mysql2, SQL Server via tedious)
- Test file parser integration (csv-parse, xlsx)
- Test encoding detection (jschardet)

### Performance Testing

**Load Testing**:
- Test API throughput with concurrent requests
- Test search performance with millions of assets
- Test lineage traversal with deep graphs (1000+ nodes)

**Scalability Testing**:
- Test bulk import with 10,000+ assets
- Test impact analysis with complex lineage graphs
- Test concurrent workflow executions

### Test Coverage Goals

- Unit test coverage: >80% of business logic code
- Property test coverage: All 74 correctness properties implemented
- Integration test coverage: All major user workflows
- API test coverage: All endpoints with success and error cases

