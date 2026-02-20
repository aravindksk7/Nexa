# Nexa — User Guide

> **Nexa** is an open-source Data Management Platform for metadata cataloging, data lineage tracking, data quality monitoring, and governance. This guide covers every feature available in the application and how to use it.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Default Credentials](#default-credentials)
2. [Authentication](#2-authentication)
   - [Register](#register)
   - [Login](#login)
   - [Log Out](#log-out)
3. [Dashboard](#3-dashboard)
4. [Data Catalog](#4-data-catalog)
   - [Browsing Assets](#browsing-assets)
   - [Creating an Asset](#creating-an-asset)
   - [Editing an Asset](#editing-an-asset)
   - [Deleting an Asset](#deleting-an-asset)
   - [Asset Detail Page](#asset-detail-page)
   - [Data Preview](#data-preview)
   - [Data Profiling](#data-profiling)
   - [Metadata Versioning](#metadata-versioning)
5. [Data Lineage](#5-data-lineage)
   - [Asset Lineage](#asset-lineage)
   - [Column Lineage](#column-lineage)
   - [Impact Analysis](#impact-analysis)
   - [Business Terms Overlay](#business-terms-overlay)
   - [Graph Controls](#graph-controls)
6. [Business Glossary](#6-business-glossary)
   - [Business Domains](#business-domains)
   - [Business Terms](#business-terms)
   - [Semantic Mapping](#semantic-mapping)
7. [Connections](#7-connections)
   - [Adding a Connection](#adding-a-connection)
   - [Testing a Connection](#testing-a-connection)
   - [Schema Exploration](#schema-exploration)
   - [Data Sampler](#data-sampler)
   - [Metadata Extraction](#metadata-extraction)
8. [File Upload](#8-file-upload)
   - [Uploading a File](#uploading-a-file)
   - [Creating an Asset from a File](#creating-an-asset-from-a-file)
9. [Search & Discovery](#9-search--discovery)
   - [Full-Text Search](#full-text-search)
   - [Faceted Filtering](#faceted-filtering)
   - [Global Search (App Bar)](#global-search-app-bar)
10. [Data Quality](#10-data-quality)
    - [Quality Rules](#quality-rules)
    - [Rule Evaluation](#rule-evaluation)
    - [Quality Status & History](#quality-status--history)
11. [Asset Relationships](#11-asset-relationships)
12. [Settings](#12-settings)
    - [Profile](#profile)
    - [Security (Change Password)](#security-change-password)
    - [Notifications](#notifications)
    - [Appearance](#appearance)
13. [Workflows](#13-workflows)
14. [SSO (Admin)](#14-sso-admin)
15. [API Reference (Summary)](#15-api-reference-summary)
16. [Environment Configuration](#16-environment-configuration)
17. [Troubleshooting & FAQ](#17-troubleshooting--faq)

---

## 1. Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | 22+     |
| npm         | 10+     |
| Docker & Docker Compose | Latest |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/aravindksk7/Nexa.git
cd Nexa

# 2. Copy the example environment file and edit as needed
cp .env.example .env

# 3. Start PostgreSQL and Redis with Docker
docker-compose up -d

# 4. Install all dependencies (monorepo workspaces)
npm install

# 5. Run database migrations
npm run db:migrate

# 6. Generate the Prisma client
npm run db:generate

# 7. (Optional) Seed the database with sample data
npx prisma db seed --schema packages/backend/prisma/schema.prisma

# 8. Start both backend and frontend in development mode
npm run dev
```

After startup:

| Service  | URL                           |
|----------|-------------------------------|
| Frontend | http://localhost:3000          |
| API      | http://localhost:3001/api/v1   |

### Default Credentials

If you seeded the database, the following account is available:

| Field    | Value                    |
|----------|--------------------------|
| Email    | admin@dataplatform.com   |
| Password | Admin@123456             |

---

## 2. Authentication

### Register

1. Navigate to **http://localhost:3000/register**.
2. Fill in:
   - **Full Name** — your display name (first and last name).
   - **Email** — must be a valid, unique email address.
   - **Password** — minimum 6 characters; confirmed by re-typing.
3. Click **Sign Up**.
4. On success you are redirected to the **Dashboard**.

### Login

1. Navigate to **http://localhost:3000/login**.
2. Enter your **Email** and **Password**.
3. Click **Sign In**.
4. A JWT access token (1 h) and refresh token (7 d) are stored automatically. The refresh token keeps you logged in without re-entering credentials.

### Log Out

- Click your **avatar** in the top-right corner of the application bar.
- Select **Logout** from the dropdown menu.
- Your tokens are revoked and you are redirected to the login page.

---

## 3. Dashboard

The Dashboard is the landing page after login. It provides:

| Card             | Description                                                |
|------------------|------------------------------------------------------------|
| **Total Assets** | Number of cataloged data assets.                           |
| **Lineage Edges**| Total lineage connections tracked in the platform.         |
| **Recent Uploads** | Files uploaded in the recent period.                     |
| **Quality Score**| Overall data quality percentage across all monitored assets.|

Below the summary cards:

- **Recent Assets** (table) — the most recently created or updated assets with name, type, owner, and last-updated timestamp. Click a row to navigate to the asset detail page.
- **Quality Overview** (chart) — a full-width stacked quality-status bar with overall score summary.
- **Recent Quality Failures** — recent failed validations surfaced for quick triage.

---

## 4. Data Catalog

Navigate to **Data Catalog** in the left sidebar.

### Browsing Assets

- The catalog displays a **paginated table** of all data assets.
- Use the **Search** box at the top to filter assets by name.
- Columns shown: **Name**, **Type** (e.g., TABLE, VIEW, DATASET), **Domain**, **Owner**, **Last Updated**.
- Use the pagination controls at the bottom to page through results (10, 25, or 50 rows per page).

### Creating an Asset

1. Click the **+ New Asset** button in the top-right corner.
2. A dialog appears with the following fields:
   - **Name** (required) — a unique name for the asset.
   - **Type** — one of: `TABLE`, `VIEW`, `DATASET`, `TOPIC`, `DASHBOARD`, `REPORT`, `API`, `FILE`.
   - **Description** — optional free-text description.
   - **Domain** — optional business domain (e.g., Sales, Marketing).
3. Click **Create**.
4. The new asset appears in the catalog table.

### Editing an Asset

- Click the **⋮** (three-dot) menu on any asset row.
- Select **Edit**.
- You are taken to the asset edit page where you can modify name, description, type, domain, tags, and custom properties.
- Click **Save** to persist changes. A new version is recorded automatically (see Metadata Versioning).

### Deleting an Asset

- Click the **⋮** menu on any asset row → **Delete**.
- Confirm the deletion in the prompt.
- The asset and its associated schemas, lineage edges, and quality rules are removed.

### Asset Detail Page

Click any asset name to open its detail page (`/catalog/{id}`). The page includes:

- **Breadcrumbs** — navigate back to the catalog.
- **Header** — asset name, type chip, and action buttons (Edit, Delete, View Lineage).
- **Side Panel** — metadata including owner, domain, tags, quality status, version number, created and updated timestamps.
- **Three Tabs** described below.

#### Overview Tab

Displays the asset description, custom properties, and a summary of its schemas.

#### Data Preview

- Shows a **tabular preview** of the asset's data (up to 50 rows).
- Columns and rows are rendered in a scrollable table.
- Useful for quick data validation without leaving the platform.

#### Data Profiling

- Displays statistical profiling of each column in the asset:
  - **Data Type**, **Null Count / %**, **Distinct Count**
  - **Min**, **Max**, **Mean**, **Std Dev** (for numeric columns)
  - **Top Values** distribution
- A **row count** and **column count** summary is shown at the top.
- The profile is computed on demand and cached.

### Metadata Versioning

Every change to an asset's metadata (name, description, type, domain, tags, custom properties) is tracked as a new **version**.

- **Version History** — accessible from the asset detail page; lists every version with timestamp, change type (CREATED, UPDATED, RESTORED), and who made the change.
- **Compare Versions** — select any two versions and view a side-by-side diff of what changed.
- **Restore Version** — revert the asset to a previous version. A new version entry of type `RESTORED` is created so the action is fully auditable.

---

## 5. Data Lineage

Navigate to **Lineage** in the left sidebar.

The Lineage page provides an interactive **D3.js force-directed graph** showing live data flow between assets, columns, and business terms.

### Asset Lineage

1. **Select an asset** using the search/autocomplete field at the top.
2. Choose **Upstream**, **Downstream**, or **Both** and set **Depth**.
3. The graph renders nodes (assets) and directed edges (data flow) from live backend lineage APIs.
3. Nodes are **color-coded by type** (TABLE, VIEW, DASHBOARD, etc.) and labeled with the asset name.

### Column Lineage

1. Switch to the **Column Lineage** tab.
2. Select a source asset and then a specific column.
3. The graph shows column-level data flow including:
   - **Transformation Type** (DIRECT, DERIVED, AGGREGATED, FILTERED, JOINED)
   - **Transformation Expression** (e.g., the SQL expression)
   - **Confidence Score** (0–1)
4. Column options are loaded from live asset schema/profile metadata.

### Impact Analysis

1. **Right-click** a node in the graph (or use the node context menu).
2. Select **Show Impact**.
3. An **Impact Analysis drawer** opens on the right, showing:
   - All downstream assets that would be affected if this asset changes.
   - **Depth** — how many hops away the impact reaches.
   - **Path** — the exact chain from source to each impacted asset.
   - **Count by Type** — summary of impacted asset types.

### Business Terms Overlay

- Toggle the **Show Business Terms** switch in the controls.
- Nodes that have mapped business terms display term badges.
- Click a node to open a **Terms Drawer** listing all associated business terms with definitions and domain info.

### Graph Controls

| Control | Action |
|---------|--------|
| **Direction Toggle** | Switch between Upstream, Downstream, or Both directions. |
| **Depth** | Control how many hops deep the lineage graph extends. |
| **Zoom In / Out** | Magnify or reduce the graph view. |
| **Center** | Re-center the graph to fit all nodes. |
| **Fullscreen** | Toggle fullscreen mode for the graph. |
| **Drag** | Click and drag nodes to rearrange the layout. |
| **Pan** | Click and drag on the background to pan. |
| **Scroll** | Mouse wheel to zoom. |

---

## 6. Business Glossary

Navigate to **Glossary** in the left sidebar.

The glossary helps you define and maintain a shared **business vocabulary** with formal definitions and map terms to physical data assets.

### Business Domains

Switch to the **Domains** tab.

- **View all domains** in a table showing name, description, number of terms, and number of sub-domains.
- **Create a domain**: click **+ Add Domain**, enter a name and optional description. You can select a **parent domain** to create a hierarchy.
- **Edit a domain**: click the edit icon on a domain row.
- **Delete a domain**: click the delete icon (only possible if the domain has no terms).

### Business Terms

Switch to the **Business Terms** tab (default).

- **View all terms** in a paginated table with columns: Name, Definition, Domain, Status, Mappings count.
- **Search** terms using the search box.
- **Create a term**: click **+ Add Term**, fill in:
  - **Name** — the business term (e.g., "Customer Lifetime Value").
  - **Definition** — a clear, formal definition.
  - **Domain** — select the business domain this term belongs to.
  - **Status** — `ACTIVE`, `DRAFT`, or `DEPRECATED`.
- **Edit a term**: click the edit icon on a term row.
- **Deprecate a term**: click the archive icon to change status to `DEPRECATED`. Deprecated terms remain visible but are marked as no longer active.
- **Delete a term**: click the delete icon.

### Semantic Mapping

Semantic mapping links a **business term** to a physical data asset (and optionally a specific column).

1. Click the **link** icon (🔗) on any business term row.
2. A **mapping dialog** opens:
   - **Asset** — search and select a data asset from the catalog.
   - **Column Name** — optionally specify which column the term maps to.
3. Click **Create Mapping**.
4. The mapping count on the term increases. Mappings also appear in the Lineage graph when the Business Terms overlay is enabled.

---

## 7. Connections

Navigate to **Connections** in the left sidebar.

Connections allow Nexa to connect to external databases, explore their schemas, and extract metadata into the catalog.

### Adding a Connection

1. Click **+ New Connection**.
2. Fill in the connection form:
   - **Name** — a friendly name for this connection (e.g., "Production Postgres").
   - **Type** — `PostgreSQL` 🐘, `MySQL` 🐬, or `SQL Server` 📊.
   - **Host** — hostname or IP address.
   - **Port** — default ports: PostgreSQL 5432, MySQL 3306, SQL Server 1433.
   - **Database** — the database name to connect to.
   - **Username** / **Password** — credentials.
3. (Optional) Click **Test Connection** before saving to verify connectivity.
4. Click **Create**.
5. The connection card appears in the grid.

### Testing a Connection

- On the connection creation/edit dialog, click **Test Connection**.
- A success or error message appears immediately.
- Connection cards also show a status chip: **Connected** (green), **Error** (red), or **Pending** (gray).

### Schema Exploration

1. Click the **⋮** menu on a connection card → **Explore Schema**.
2. A dialog opens with an interactive **tree view** of the database structure:
   ```
   📁 Database
     📁 public (schema)
       📄 customers (TABLE)
         ├─ id (uuid, PK)
         ├─ name (varchar)
         ├─ email (varchar, NULLABLE)
         └─ created_at (timestamp)
       📄 orders (TABLE)
         └─ ...
   ```
3. Each table/view shows its columns with data type, nullability, and primary/foreign key indicators.

### Data Sampler

The schema explorer supports table sampling for fast inspection before metadata extraction.

1. In **Explore Schema**, select a table.
2. Choose:
   - **Sample Mode**: `FIRST_N` or `RANDOM_N`
   - **Limit**: number of rows (bounded by API validation)
3. Click **Preview Sample** to fetch data from `/api/v1/connections/:id/sample`.
4. Use:
   - **Copy SQL** — copy generated SQL preview to clipboard
   - **Export CSV** — download sampled rows as a CSV file

### Metadata Extraction

- Click the **⋮** menu → **Extract Metadata** (or the sync icon).
- Nexa reads the database schema and automatically creates catalog assets for every table and view discovered.
- Existing assets are updated; new ones are created.

---

## 8. File Upload

Navigate to **File Upload** in the left sidebar.

### Uploading a File

1. **Drag and drop** a file into the upload zone, or **click to browse**.
2. Supported formats: **CSV**, **XLSX**, **XLS** (max 100 MB).
3. Click **Upload & Parse**.
4. Nexa parses the file and displays:
   - **Detected columns** with inferred data types (STRING, INTEGER, NUMBER, BOOLEAN, DATE) and nullability.
   - **Row count** and sample data preview.

### Creating an Asset from a File

1. After a successful upload, click **Create Asset**.
2. Enter a name for the new catalog asset.
3. Nexa creates the asset in the Data Catalog with the file's schema attached.
4. The file metadata (original name, size, type) is linked to the asset for reference.

---

## 9. Search & Discovery

### Full-Text Search

Navigate to **Search** in the left sidebar.

1. Type your query in the search box (e.g., "customer", "sales_dashboard").
2. Results appear in real-time with a **300 ms debounce** to avoid excessive API calls.
3. Each result shows:
   - **Asset name** (highlighted for relevance).
   - **Type** chip (color-coded).
   - **Description** snippet.
   - **Domain** and **Tags**.
   - **Relevance score**.
   - **Last updated** timestamp.
4. Click any result to navigate to the asset detail page.

### Faceted Filtering

The left sidebar on the Search page provides filters:

- **Asset Types** — multi-select dropdown (TABLE, VIEW, DATASET, TOPIC, DASHBOARD, REPORT, API, FILE).
- **Domains** — filter by business domain.
- **Tags** — filter by tags.

Facet counts update dynamically based on the current query.

### Global Search (App Bar)

A **global search** is available in the application bar at the top of every page:

1. Click the search icon or start typing in the app bar search field.
2. An **autocomplete dropdown** shows matching results as you type.
3. Select a result to navigate directly to its detail page.
4. Press Enter or click "View all results" to go to the full Search page.

---

## 10. Data Quality

Data Quality is managed through the API and reflected in the UI.

### Quality Rules

Quality rules define expectations for your data assets. The available rule types are:

| Rule Type        | Description                                    | Example                           |
|------------------|------------------------------------------------|-----------------------------------|
| `NOT_NULL`       | Column must not contain null values.           | `email` is not null               |
| `UNIQUE`         | Column values must be unique.                  | `customer_id` is unique           |
| `RANGE`          | Numeric column falls within a min–max range.   | `age` between 0 and 150          |
| `REGEX`          | Column matches a regular expression pattern.   | `email` matches `.*@.*\..*`      |
| `CUSTOM_SQL`     | Custom SQL expression evaluates to true.       | `SELECT COUNT(*) WHERE ...`      |
| `REFERENTIAL`    | Values exist in a reference table/column.      | `status` in `status_codes.code`  |

**To create a rule**, use the API:

```
POST /api/v1/quality/rules
{
  "assetId": "<asset-id>",
  "name": "Customer email not null",
  "ruleType": "NOT_NULL",
  "column": "email",
  "severity": "HIGH"
}
```

### Rule Evaluation

- **Evaluate all rules** for an asset: `POST /api/v1/quality/evaluate/{assetId}`
- The platform runs each rule and records pass/fail results with details.

### Quality Status & History

- Each asset has a **quality status** (HEALTHY, WARNING, CRITICAL, UNKNOWN) visible on the asset detail page and the catalog table.
- **Quality History**: `GET /api/v1/quality/assets/{assetId}/history` returns a timeline of all evaluations to track quality trends over time.
- The **Dashboard** aggregates quality scores into the Quality Overview panel.

---

## 11. Asset Relationships

Asset Relationships define how assets relate to each other beyond lineage (e.g., "Dashboard X **uses** Table Y", "Dataset A **is derived from** Dataset B").

**Relationship types**: `DEPENDS_ON`, `DERIVED_FROM`, `USES`, `FEEDS`, `RELATED_TO`.

**To create a relationship**, use the API:

```
POST /api/v1/relationships
{
  "sourceAssetId": "<source-id>",
  "targetAssetId": "<target-id>",
  "relationshipType": "USES",
  "description": "Dashboard uses this table for reporting"
}
```

**Query relationships**:

- `GET /api/v1/relationships/source/{assetId}` — assets that this asset depends on.
- `GET /api/v1/relationships/target/{assetId}` — assets that depend on this asset.
- `GET /api/v1/relationships/summary/{assetId}` — summary of all relationships.

---

## 12. Settings

Navigate to **Settings** via the user menu (avatar → Settings) or the sidebar.

### Profile

- Update your **First Name** and **Last Name**.
- View your email address and role.
- Click **Save Changes** to persist.

### Security (Change Password)

1. Enter your **Current Password**.
2. Enter a **New Password** and confirm it.
3. Click **Change Password**.

### Notifications

Configure notification preferences (UI settings; email delivery requires SMTP configuration):

- **Email Notifications** — toggle on/off.
- **Push Notifications** — toggle on/off.
- **Weekly Digest** — receive a weekly summary of platform activity.

### Appearance

- **Dark Mode** — toggle dark/light theme.
- **Compact View** — reduce spacing for more information density.

---

## 13. Workflows

Navigate to **Workflows** in the left sidebar.

Use this module to define governance workflows and execute approval/review steps.

- Create and list workflow definitions
- Trigger workflow instances with context
- Track instance status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`)
- Approve/reject workflow steps
- Cancel in-progress instances

## 14. SSO (Admin)

Admin users can configure SSO providers via backend APIs.

- Supported providers: `oauth2`, `saml`, `ldap`
- Configuration lifecycle: create, update, test, enable, disable, delete
- Endpoint family: `/api/v1/sso/*`

> Note: SSO routes are restricted to `ADMIN` role.

## 15. API Reference (Summary)

All API endpoints are prefixed with `/api/v1`. Authentication is required for all endpoints except registration and login; include the JWT token as `Authorization: Bearer <token>`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create a new account |
| POST | `/auth/login` | Sign in and receive tokens |
| POST | `/auth/logout` | Revoke tokens |
| POST | `/auth/refresh` | Refresh the access token |
| GET | `/auth/me` | Get the current user |
| PUT | `/auth/profile` | Update profile (firstName, lastName) |
| POST | `/auth/change-password` | Change password |

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List assets (paginated, search, filter) |
| POST | `/assets` | Create a new asset |
| GET | `/assets/:id` | Get asset details |
| PUT | `/assets/:id` | Update an asset |
| DELETE | `/assets/:id` | Delete an asset |
| GET | `/assets/:id/history` | Get version history |
| GET | `/assets/:id/versions/compare` | Compare two versions |
| POST | `/assets/:id/versions/:version/restore` | Restore to a version |
| GET | `/assets/:id/schemas` | List schemas for an asset |
| POST | `/assets/:id/schemas` | Create a schema version |
| GET | `/assets/:id/preview` | Preview asset data |
| GET | `/assets/:id/profile` | Get data profile |

### Lineage

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lineage/events` | Ingest an OpenLineage event |
| POST | `/lineage/sql` | Extract lineage from SQL |
| POST | `/lineage/edges` | Create a lineage edge |
| GET | `/lineage/edges/:id` | Get lineage edge by id |
| PUT | `/lineage/edges/:id` | Update lineage edge |
| DELETE | `/lineage/edges/:id` | Delete a lineage edge |
| GET | `/lineage/:id/upstream` | Get upstream lineage |
| GET | `/lineage/:id/downstream` | Get downstream lineage |
| GET | `/lineage/:id/impact` | Impact analysis |

### Column Lineage

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lineage/columns` | Create column lineage edge |
| GET | `/lineage/columns/:id` | Get column lineage edge by id |
| PUT | `/lineage/columns/:id` | Update column lineage edge |
| DELETE | `/lineage/columns/:id` | Delete column lineage edge |
| GET | `/lineage/columns/asset/:assetId` | List column lineage for an asset |
| GET | `/lineage/columns/:assetId/:column/upstream` | Upstream column lineage |
| GET | `/lineage/columns/:assetId/:column/downstream` | Downstream column lineage |
| GET | `/lineage/columns/:assetId/:column/impact` | Column impact analysis |
| POST | `/lineage/columns/parse-sql` | Parse SQL for column lineage |

### Business Glossary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/glossary/domains` | List domains |
| GET | `/glossary/domains/hierarchy` | Get domain hierarchy |
| GET | `/glossary/domains/:id` | Get domain details |
| POST | `/glossary/domains` | Create domain |
| PUT | `/glossary/domains/:id` | Update domain |
| DELETE | `/glossary/domains/:id` | Delete domain |
| GET | `/glossary/terms` | List terms |
| GET | `/glossary/terms/:id` | Get term details |
| POST | `/glossary/terms` | Create term |
| PUT | `/glossary/terms/:id` | Update term |
| POST | `/glossary/terms/:id/deprecate` | Deprecate term |
| DELETE | `/glossary/terms/:id` | Delete term |
| GET | `/glossary/terms/:id/assets` | Get mapped assets for a term |
| POST | `/glossary/mappings` | Create semantic mapping |
| GET | `/glossary/mappings/term/:termId` | Get mappings by term |
| GET | `/glossary/mappings/asset/:assetId` | Get mappings by asset |
| DELETE | `/glossary/mappings/:id` | Delete mapping |
| GET | `/glossary/business-lineage/:termId` | Get business lineage graph |

### Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/connections` | List all connections |
| POST | `/connections` | Create a connection |
| GET | `/connections/:id` | Get connection details |
| PUT | `/connections/:id` | Update a connection |
| DELETE | `/connections/:id` | Delete a connection |
| POST | `/connections/:id/test` | Test a saved connection |
| GET | `/connections/:id/explore` | Explore database schema |
| GET | `/connections/:id/sample` | Sample table rows (`FIRST_N`/`RANDOM_N`) |
| POST | `/connections/:id/extract` | Extract metadata into catalog |
| GET | `/connections/:id/schema-history` | Schema exploration history |
| GET | `/connections/:id/sync-history` | Sync history |
| GET | `/connections/:id/sync-info` | Latest sync/exploration summary |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/overview` | Aggregate dashboard stats |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflows` | List workflows |
| POST | `/workflows` | Create workflow |
| GET | `/workflows/:id` | Get workflow |
| POST | `/workflows/:id/trigger` | Trigger workflow instance |
| GET | `/workflows/instances/list` | List workflow instances |
| GET | `/workflows/instances/:instanceId` | Get workflow instance |
| POST | `/workflows/instances/:instanceId/steps/:stepId/approve` | Approve workflow step |
| POST | `/workflows/instances/:instanceId/steps/:stepId/reject` | Reject workflow step |
| POST | `/workflows/instances/:instanceId/cancel` | Cancel workflow instance |

### SSO (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sso` | List SSO configurations |
| GET | `/sso/:id` | Get SSO configuration |
| POST | `/sso` | Create SSO configuration |
| PUT | `/sso/:id` | Update SSO configuration |
| DELETE | `/sso/:id` | Delete SSO configuration |
| POST | `/sso/:id/test` | Test SSO configuration |
| POST | `/sso/:id/enable` | Enable configuration |
| POST | `/sso/:id/disable` | Disable configuration |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/files/upload` | Upload and parse a file |
| GET | `/files/:id` | Get file metadata |
| POST | `/files/:id/create-asset` | Create a catalog asset from file |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Full-text search with facets |
| GET | `/search/suggest` | Autocomplete suggestions |
| POST | `/search/reindex` | Rebuild search indexes |

### Data Quality

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/quality/rules` | List quality rules |
| POST | `/quality/rules` | Create a quality rule |
| GET | `/quality/rules/:id` | Get rule details |
| PUT | `/quality/rules/:id` | Update a rule |
| DELETE | `/quality/rules/:id` | Delete a rule |
| POST | `/quality/evaluate/:assetId` | Evaluate rules for an asset |
| GET | `/quality/assets/:assetId/status` | Get quality status |
| GET | `/quality/assets/:assetId/history` | Get quality history |

### Relationships

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/relationships` | List relationships |
| POST | `/relationships` | Create a relationship |
| GET | `/relationships/:id` | Get relationship details |
| PUT | `/relationships/:id` | Update a relationship |
| DELETE | `/relationships/:id` | Delete a relationship |
| GET | `/relationships/source/:assetId` | Get outgoing relationships |
| GET | `/relationships/target/:assetId` | Get incoming relationships |
| GET | `/relationships/summary/:assetId` | Relationship summary |

---

## 16. Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `dmp_user` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `dmp_password` | PostgreSQL password |
| `POSTGRES_DB` | `data_management_platform` | Database name |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `DATABASE_URL` | (composed from above) | Full Prisma connection URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_URL` | `redis://localhost:6379` | Full Redis URL |
| `JWT_SECRET` | — | Secret for signing access tokens (**change in production**) |
| `JWT_EXPIRES_IN` | `1h` | Access token lifetime |
| `JWT_REFRESH_SECRET` | — | Secret for signing refresh tokens (**change in production**) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `API_PORT` | `3001` | Backend server port |
| `API_HOST` | `localhost` | Backend server host |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | API URL used by the frontend |
| `LOG_LEVEL` | `debug` | Logging level (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | `development` | Environment mode |
| `SMTP_HOST` | — | SMTP server for email notifications |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | `noreply@example.com` | Sender email address |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Rate limiting time window |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

### Docker Services

The `docker-compose.yml` starts two containers:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `dmp-postgres` | `postgres:16-alpine` | 5432 | Primary database |
| `dmp-redis` | `redis:7-alpine` | 6379 | Caching and sessions |

Both containers include health checks and persistent volumes.

---

## 17. Troubleshooting & FAQ

### The application is not loading / shows a blank page

- Make sure both the backend (`npm run dev:backend`) and frontend (`npm run dev:frontend`) servers are running.
- Verify the `NEXT_PUBLIC_API_URL` in `.env` matches the backend's actual address.

### Database connection refused

- Verify Docker containers are running: `docker-compose ps`.
- Make sure the `DATABASE_URL` in `.env` matches the Docker configuration.
- Run `docker-compose up -d` to start the containers if they are stopped.

### "Unauthorized" errors on every API call

- Your JWT token may have expired. Log out and log in again.
- Ensure `JWT_SECRET` in `.env` matches what the backend is using.

### Prisma migration errors

- Run `npm run db:generate` after pulling new code.
- If the database schema is out of sync: `npx prisma migrate reset --schema packages/backend/prisma/schema.prisma` (caution: this drops all data).

### File upload fails

- Make sure the file is CSV, XLSX, or XLS and under 100 MB.
- Large files may require increasing Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`.

### Connections fail to test

- Verify that the target database is reachable from the machine running Nexa.
- Check that the port, host, username, and password are correct.
- For PostgreSQL, ensure `pg_hba.conf` allows connections from your IP.

### How do I run end-to-end tests?

```bash
# Run in headless mode
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Open the Playwright test UI
npm run test:e2e:ui

# View the HTML report
npm run test:e2e:report
```

### How do I reset the database?

```bash
npx prisma migrate reset --schema packages/backend/prisma/schema.prisma
```

This drops all tables, re-runs migrations, and optionally re-seeds data.

---

## User Roles

Nexa supports four roles with different permission levels:

| Role | Description |
|------|-------------|
| `ADMIN` | Full access to all features, user management, and configuration. |
| `DATA_STEWARD` | Manage the glossary, quality rules, and governance workflows. |
| `DATA_ENGINEER` | Manage connections, lineage, and technical metadata. |
| `BUSINESS_ANALYST` | Browse the catalog, search, and view lineage and quality reports. |

---

*Nexa is an open-source project. Contributions and feedback are welcome at [https://github.com/aravindksk7/Nexa](https://github.com/aravindksk7/Nexa).*
