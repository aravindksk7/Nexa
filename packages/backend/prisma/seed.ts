import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users
  const adminPassword = await argon2.hash('Admin@123456', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const analystPassword = await argon2.hash('Analyst@123456', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexa.io' },
    update: {},
    create: {
      email: 'admin@nexa.io',
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@nexa.io' },
    update: {},
    create: {
      email: 'analyst@nexa.io',
      username: 'analyst',
      firstName: 'Data',
      lastName: 'Analyst',
      passwordHash: analystPassword,
      role: 'BUSINESS_ANALYST',
      isActive: true,
    },
  });

  console.log('✅ Created users:', { admin: admin.email, analyst: analyst.email });

  // Create test assets
  const customersTable = await prisma.asset.upsert({
    where: { id: 'customers-table-001' },
    update: {},
    create: {
      id: 'customers-table-001',
      name: 'customers',
      assetType: 'TABLE',
      description: 'Customer master data containing contact information and demographics',
      domain: 'Sales',
      tags: ['pii', 'master-data', 'gdpr'],
      ownerId: admin.id,
      createdById: admin.id,
      updatedById: admin.id,
      customProperties: {
        qualifiedName: 'postgresql.production.public.customers',
        rowCount: 125000,
        sizeBytes: 52428800,
        lastRefreshed: new Date().toISOString(),
      },
    },
  });

  const ordersTable = await prisma.asset.upsert({
    where: { id: 'orders-table-001' },
    update: {},
    create: {
      id: 'orders-table-001',
      name: 'orders',
      assetType: 'TABLE',
      description: 'Sales order transactions with customer and product references',
      domain: 'Sales',
      tags: ['transactional', 'financial'],
      ownerId: admin.id,
      createdById: admin.id,
      updatedById: admin.id,
      customProperties: {
        qualifiedName: 'postgresql.production.public.orders',
        rowCount: 850000,
        sizeBytes: 209715200,
        lastRefreshed: new Date().toISOString(),
      },
    },
  });

  const productsTable = await prisma.asset.upsert({
    where: { id: 'products-table-001' },
    update: {},
    create: {
      id: 'products-table-001',
      name: 'products',
      assetType: 'TABLE',
      description: 'Product catalog with pricing and inventory data',
      domain: 'Products',
      tags: ['master-data', 'catalog'],
      ownerId: analyst.id,
      createdById: analyst.id,
      updatedById: analyst.id,
      customProperties: {
        qualifiedName: 'postgresql.production.public.products',
        rowCount: 5000,
        sizeBytes: 2097152,
        lastRefreshed: new Date().toISOString(),
      },
    },
  });

  const dailyRevenueView = await prisma.asset.upsert({
    where: { id: 'daily-revenue-view-001' },
    update: {},
    create: {
      id: 'daily-revenue-view-001',
      name: 'daily_revenue',
      assetType: 'DATASET',
      description: 'Daily aggregated revenue metrics by product category',
      domain: 'Finance',
      tags: ['kpi', 'financial', 'analytics'],
      ownerId: analyst.id,
      createdById: analyst.id,
      updatedById: analyst.id,
      customProperties: {
        qualifiedName: 'postgresql.production.analytics.daily_revenue',
        definition: 'SELECT date, category, SUM(amount) as revenue FROM orders o JOIN products p ON o.product_id = p.id GROUP BY date, category',
      },
    },
  });

  const salesDashboard = await prisma.asset.upsert({
    where: { id: 'sales-dashboard-001' },
    update: {},
    create: {
      id: 'sales-dashboard-001',
      name: 'Sales Performance Dashboard',
      assetType: 'DASHBOARD',
      description: 'Executive dashboard showing key sales metrics and trends',
      domain: 'Sales',
      tags: ['executive', 'kpi', 'reporting'],
      ownerId: analyst.id,
      createdById: analyst.id,
      updatedById: analyst.id,
      customProperties: {
        qualifiedName: 'looker.sales_performance_dashboard',
        url: 'https://looker.company.com/dashboards/123',
        refreshSchedule: 'hourly',
      },
    },
  });

  console.log('✅ Created assets:', {
    customers: customersTable.name,
    orders: ordersTable.name,
    products: productsTable.name,
    dailyRevenue: dailyRevenueView.name,
    dashboard: salesDashboard.name,
  });

  // Create schemas for tables
  await prisma.schema.createMany({
    data: [
      {
        assetId: customersTable.id,
        version: 1,
        schemaFormat: 'SQL',
        schemaDefinition: {
          columns: [
            { name: 'id', dataType: 'UUID', nullable: false, isPrimaryKey: true },
            { name: 'email', dataType: 'VARCHAR(255)', nullable: false, isUnique: true, tags: ['pii'] },
            { name: 'first_name', dataType: 'VARCHAR(100)', nullable: false, tags: ['pii'] },
            { name: 'last_name', dataType: 'VARCHAR(100)', nullable: false, tags: ['pii'] },
            { name: 'phone', dataType: 'VARCHAR(20)', nullable: true, tags: ['pii'] },
            { name: 'created_at', dataType: 'TIMESTAMP', nullable: false },
            { name: 'updated_at', dataType: 'TIMESTAMP', nullable: false },
          ],
        },
        createdById: admin.id,
      },
      {
        assetId: ordersTable.id,
        version: 1,
        schemaFormat: 'SQL',
        schemaDefinition: {
          columns: [
            { name: 'id', dataType: 'UUID', nullable: false, isPrimaryKey: true },
            { name: 'customer_id', dataType: 'UUID', nullable: false, isForeignKey: true },
            { name: 'product_id', dataType: 'UUID', nullable: false, isForeignKey: true },
            { name: 'quantity', dataType: 'INTEGER', nullable: false },
            { name: 'unit_price', dataType: 'DECIMAL(10,2)', nullable: false },
            { name: 'total_amount', dataType: 'DECIMAL(10,2)', nullable: false },
            { name: 'order_date', dataType: 'DATE', nullable: false },
            { name: 'status', dataType: 'VARCHAR(20)', nullable: false },
          ],
        },
        createdById: admin.id,
      },
      {
        assetId: productsTable.id,
        version: 1,
        schemaFormat: 'SQL',
        schemaDefinition: {
          columns: [
            { name: 'id', dataType: 'UUID', nullable: false, isPrimaryKey: true },
            { name: 'sku', dataType: 'VARCHAR(50)', nullable: false, isUnique: true },
            { name: 'name', dataType: 'VARCHAR(200)', nullable: false },
            { name: 'category', dataType: 'VARCHAR(100)', nullable: false },
            { name: 'price', dataType: 'DECIMAL(10,2)', nullable: false },
            { name: 'stock_quantity', dataType: 'INTEGER', nullable: false },
          ],
        },
        createdById: analyst.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created schemas for tables');

  // Create lineage edges
  await prisma.lineageEdge.createMany({
    data: [
      {
        sourceAssetId: customersTable.id,
        targetAssetId: dailyRevenueView.id,
        transformationType: 'JOIN',
        transformationLogic: 'JOIN customers c ON o.customer_id = c.id',
        metadata: { transformation: 'JOIN and aggregation' },
      },
      {
        sourceAssetId: ordersTable.id,
        targetAssetId: dailyRevenueView.id,
        transformationType: 'AGGREGATION',
        transformationLogic: 'SELECT SUM(amount) FROM orders GROUP BY date, category',
        metadata: { transformation: 'JOIN and aggregation' },
      },
      {
        sourceAssetId: productsTable.id,
        targetAssetId: dailyRevenueView.id,
        transformationType: 'JOIN',
        transformationLogic: 'JOIN products p ON o.product_id = p.id',
        metadata: { transformation: 'JOIN for category' },
      },
      {
        sourceAssetId: dailyRevenueView.id,
        targetAssetId: salesDashboard.id,
        transformationType: 'VISUALIZATION',
        transformationLogic: 'Direct data source for dashboard',
        metadata: { usage: 'Visualization source' },
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created lineage edges');

  // Create a data connection
  const connection = await prisma.dataConnection.upsert({
    where: { id: 'prod-pg-connection-001' },
    update: {},
    create: {
      id: 'prod-pg-connection-001',
      name: 'Production PostgreSQL',
      description: 'Main production database for analytics',
      connectionType: 'POSTGRESQL',
      host: 'prod-db.company.internal',
      port: 5432,
      database: 'production',
      username: 'readonly_user',
      encryptedPassword: 'encrypted_placeholder',
      isActive: true,
      lastTestedAt: new Date(),
      lastTestSuccess: true,
    },
  });

  console.log('✅ Created data connection:', connection.name);

  // Create quality rules
  await prisma.qualityRule.createMany({
    data: [
      {
        name: 'Email Format Validation',
        description: 'Validates that email addresses match RFC 5322 format',
        ruleType: 'PATTERN',
        ruleDefinition: {
          field: 'email',
          pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
        },
        severity: 'CRITICAL',
        assetId: customersTable.id,
        createdById: admin.id,
        enabled: true,
      },
      {
        name: 'Order Amount Positive',
        description: 'Ensures all order amounts are positive values',
        ruleType: 'RANGE',
        ruleDefinition: {
          field: 'total_amount',
          min: 0,
          exclusive: true,
        },
        severity: 'CRITICAL',
        assetId: ordersTable.id,
        createdById: admin.id,
        enabled: true,
      },
      {
        name: 'Stock Quantity Non-Negative',
        description: 'Validates stock quantities are not negative',
        ruleType: 'RANGE',
        ruleDefinition: {
          field: 'stock_quantity',
          min: 0,
          exclusive: false,
        },
        severity: 'WARNING',
        assetId: productsTable.id,
        createdById: analyst.id,
        enabled: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created quality rules');

  // Create quality results
  const qualityRules = await prisma.qualityRule.findMany();
  for (const rule of qualityRules) {
    const passed = Math.random() > 0.1;
    await prisma.qualityResult.create({
      data: {
        ruleId: rule.id,
        assetId: rule.assetId,
        passed,
        resultData: {
          totalRecords: Math.floor(Math.random() * 100000) + 1000,
          passedRecords: Math.floor(Math.random() * 99000) + 1000,
          failedRecords: passed ? 0 : Math.floor(Math.random() * 100),
          executionTimeMs: Math.floor(Math.random() * 5000) + 500,
        },
      },
    });
  }

  console.log('✅ Created quality results');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('   Admin: admin@nexa.io / Admin@123456');
  console.log('   Analyst: analyst@nexa.io / Analyst@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
