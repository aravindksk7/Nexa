# Nexa Deployment Guide

## Windows Server Deployment

This guide walks through setting up Nexa on a Windows Server machine.

### Prerequisites

- Node.js 22+ (download from https://nodejs.org/)
- npm (comes with Node.js)
- Git (for cloning the repository)
- Docker (optional, for SQL Server container)

### Quick Start

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/aravindksk7/Nexa.git
   cd Nexa
   ```

2. **Install dependencies (this automatically builds):**
   ```powershell
   npm install
   ```
   
   The `postinstall` hook will automatically compile TypeScript for both frontend and backend during installation.

3. **Configure environment variables:**
   
   Create `.env` file in the root directory:
   ```
   # Backend
   DATABASE_URL=postgresql://user:password@localhost:5432/nexa_db
   JWT_SECRET=your-secret-key-here
   NODE_ENV=production
   
   # Frontend
   NEXT_PUBLIC_API_URL=http://your-server:3001/api/v1
   ```

4. **Set up the database:**
   ```powershell
   npm run db:migrate -- --workspace=backend
   npm run db:seed -- --workspace=backend
   ```

5. **Start the application:**
   
   **Backend:**
   ```powershell
   cd packages\backend
   npm start
   ```
   
   **Frontend (in another terminal):**
   ```powershell
   cd packages\frontend
   npm start
   ```

### Using Docker Compose (Optional)

For SQL Server and Postgres containers:

```powershell
npm run docker:up
```

Verify containers are running:
```powershell
docker ps
```

Stop containers:
```powershell
npm run docker:down
```

### Production Deployment

For Windows Server production deployments:

1. **Build the entire application:**
   ```powershell
   npm run build
   ```

2. **Backend service setup:**
   
   Install NSSM (Non-Sucking Service Manager) to run as Windows Service:
   ```powershell
   choco install nssm -y
   ```
   
   Register backend as service:
   ```powershell
   nssm install NexaBackend "D:\tools\Nexa\packages\backend\node_modules\.bin\node.exe" "D:\tools\Nexa\packages\backend\dist\index.js"
   nssm set NexaBackend AppDirectory "D:\tools\Nexa\packages\backend"
   nssm set NexaBackend AppEnvironmentExtra DATABASE_URL=postgresql://...
   nssm start NexaBackend
   ```

3. **Frontend service setup:**
   
   For Next.js production, first build then run:
   ```powershell
   cd packages\frontend
   npm run build
   npm start
   ```
   
   Or register as service:
   ```powershell
   nssm install NexaFrontend "D:\tools\Nexa\packages\frontend\node_modules\.bin\next.exe" "start"
   nssm set NexaFrontend AppDirectory "D:\tools\Nexa\packages\frontend"
   nssm start NexaFrontend
   ```

### Troubleshooting

**"Cannot find module 'dist/index.js'"**
- The build step may have failed. Run: `npm run build --workspace=backend`

**Port 3001 already in use**
- Change the API_PORT environment variable or kill existing process:
  ```powershell
  Get-NetTCPConnection -LocalPort 3001 -State Listen | Stop-Process -Force
  ```

**Database connection errors**
- Verify DATABASE_URL is correct
- Ensure database server is running
- Check firewall rules

**Module not found errors**
- Delete node_modules and package-lock.json, then reinstall:
  ```powershell
  rm -r node_modules, package-lock.json
  npm install
  ```

### Useful Commands

```powershell
# Build all packages
npm run build

# Run backend in development
npm run dev:backend

# Run frontend in development
npm run dev:frontend

# Run all tests
npm run test:all

# Format code
npm run format

# Lint code
npm run lint
```

### Monitoring

Check service logs with NSSM:
```powershell
nssm status NexaBackend
nssm start NexaBackend
nssm stop NexaBackend
nssm restart NexaBackend
```

View application logs at:
- Backend: `packages/backend/logs/`
- Frontend: Check console output

### Support

For issues or questions, open an issue on GitHub: https://github.com/aravindksk7/Nexa/issues
