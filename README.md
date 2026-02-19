# Nexa

An open-source Data Management Platform built with TypeScript/Node.js, providing enterprise-grade data cataloging, lineage tracking, and governance capabilities.

## Features

- **Metadata Catalog**: Register and catalog data assets with comprehensive metadata management
- **Data Lineage**: Track data flow from source systems through transformations
- **Lineage Visualization**: Interactive graph visualization of data dependencies
- **Impact Analysis**: Assess downstream effects of changes to data assets
- **Search & Discovery**: Full-text search across all metadata
- **Data Quality**: Define and monitor data quality rules
- **Governance Workflows**: Define and execute governance processes
- **Data Connectors**: Connect to PostgreSQL, MySQL, SQL Server, and more
- **File Support**: Upload and parse CSV and Excel files

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

The frontend will be available at `http://localhost:3000` and the API at `http://localhost:3001`.

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
