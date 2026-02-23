# Nexa

An open-source Data Management Platform built with TypeScript/Node.js, providing enterprise-grade data cataloging, lineage tracking, and governance capabilities.

## Features

- **Metadata Catalog**: Asset CRUD, metadata versioning, schema history, preview and profiling
- **Lineage (Asset + Column + Business)**: OpenLineage ingestion, SQL parsing, upstream/downstream traversal, impact analysis
- **Lineage Visualization**: D3-based interactive graph with direction/depth controls and business overlays
- **Business Glossary**: Domains, terms, semantic mappings, and derived business-term lineage
- **Data Quality**: Rules, evaluations, quality history, and quality overview metrics
- **Connections**: PostgreSQL/MySQL/SQL Server connections, schema exploration, metadata extraction, sync history
- **Data Sampler**: Live table sampling (`FIRST_N` / `RANDOM_N`) with SQL preview + CSV export in UI
- **Governance Workflows**: Workflow definition, triggering, and instance step approvals/rejections
- **SSO Admin**: OAuth2/SAML/LDAP configuration management, test, enable/disable
- **Search & Discovery**: Full-text and global search across assets
- **Dashboard**: Aggregated platform KPIs (`/api/v1/dashboard/overview`) with quality summaries

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- MUI 6 (Material-UI)
- TanStack Query

### Backend
- Node.js 22
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL

### Libraries
- graphlib (graph operations)
- node-sql-parser (SQL lineage extraction)
- @openlineage/client (OpenLineage integration)

## Getting Started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- npm 10+

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aravindksk7/Nexa.git
   cd Nexa
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Start the database:
   ```bash
   docker-compose up -d
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Run database migrations:
   ```bash
   npm run db:migrate
   ```

6. Start development servers:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000` and the API at `http://localhost:3001/api/v1`.

## Documentation

- User Guide: `docs/USER_GUIDE.md`
- Product Roadmap: `docs/ROADMAP.md`
- Comprehensive Test Report: `COMPREHENSIVE_TEST_REPORT.md`

## API Modules

Primary REST modules (all under `/api/v1`):

- `/auth`
- `/assets`
- `/lineage`
- `/lineage/columns`
- `/glossary`
- `/connections`
- `/quality`
- `/workflows`
- `/sso`
- `/dashboard`
- `/search`
- `/files`
- `/relationships`
- `/notifications`

## Project Structure

```
nexa/
├── packages/
│   ├── backend/           # Express.js API server
│   │   ├── src/
│   │   │   ├── config/    # Configuration
│   │   │   ├── middleware/# Express middleware
│   │   │   ├── models/    # Data models
│   │   │   ├── repositories/ # Data access layer
│   │   │   ├── routes/    # API routes
│   │   │   ├── services/  # Business logic
│   │   │   └── utils/     # Utilities
│   │   └── prisma/        # Database schema
│   └── frontend/          # Next.js application
│       ├── src/
│       │   ├── app/       # App Router pages
│       │   ├── components/# React components
│       │   ├── hooks/     # Custom hooks
│       │   ├── lib/       # Utilities
│       │   └── types/     # TypeScript types
├── docker-compose.yml
└── package.json
```

## License

MIT
