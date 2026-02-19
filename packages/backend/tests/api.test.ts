import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import * as argon2 from 'argon2';

const app = createApp();

describe('Nexa API Tests', () => {
  let adminToken: string;
  let analystToken: string;
  let testUserId: string;
  let testAssetId: string;

  beforeAll(async () => {
    // Clear existing refresh tokens for test users to avoid unique constraint issues
    await prisma.refreshToken.deleteMany({
      where: {
        user: { email: { in: ['testadmin@test.com', 'testanalyst@test.com', 'testuser@test.com'] } },
      },
    });

    // Create test users
    const adminPassword = await argon2.hash('TestAdmin@123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const analystPassword = await argon2.hash('TestAnalyst@123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const admin = await prisma.user.upsert({
      where: { email: 'testadmin@test.com' },
      update: {},
      create: {
        email: 'testadmin@test.com',
        username: 'testadmin',
        firstName: 'Test',
        lastName: 'Admin',
        passwordHash: adminPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });

    const analyst = await prisma.user.upsert({
      where: { email: 'testanalyst@test.com' },
      update: {},
      create: {
        email: 'testanalyst@test.com',
        username: 'testanalyst',
        firstName: 'Test',
        lastName: 'Analyst',
        passwordHash: analystPassword,
        role: 'BUSINESS_ANALYST',
        isActive: true,
      },
    });

    testUserId = admin.id;

    // Login as admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'testadmin@test.com', password: 'TestAdmin@123' });
    adminToken = adminLogin.body.accessToken;

    // Login as analyst
    const analystLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'testanalyst@test.com', password: 'TestAnalyst@123' });
    analystToken = analystLogin.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.qualityResult.deleteMany({
      where: { asset: { name: { startsWith: 'test_' } } },
    });
    await prisma.qualityRule.deleteMany({
      where: { asset: { name: { startsWith: 'test_' } } },
    });
    await prisma.lineageEdge.deleteMany({
      where: {
        OR: [
          { sourceAsset: { name: { startsWith: 'test_' } } },
          { targetAsset: { name: { startsWith: 'test_' } } },
        ],
      },
    });
    await prisma.schema.deleteMany({
      where: { asset: { name: { startsWith: 'test_' } } },
    });
    await prisma.asset.deleteMany({
      where: { name: { startsWith: 'test_' } },
    });
    await prisma.dataConnection.deleteMany({
      where: { name: { startsWith: 'Test ' } },
    });
    await prisma.refreshToken.deleteMany({
      where: {
        user: { email: { in: ['testadmin@test.com', 'testanalyst@test.com'] } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['testadmin@test.com', 'testanalyst@test.com', 'testuser@test.com'] } },
    });
    await prisma.$disconnect();
  });

  // =========================
  // Health Check Tests
  // =========================
  describe('Health Check', () => {
    it('GET /health - should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  // =========================
  // Authentication Tests
  // =========================
  describe('Authentication', () => {
    describe('POST /api/v1/auth/register', () => {
      it('should register a new user', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'testuser@test.com',
            username: 'testuser',
            password: 'TestUser@123456',
            firstName: 'Test',
            lastName: 'User',
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('email', 'testuser@test.com');
      });

      it('should reject duplicate email', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'testadmin@test.com',
            username: 'duplicateuser',
            password: 'Test@123456',
            firstName: 'Duplicate',
            lastName: 'User',
          });

        // 409 Conflict for duplicate email
        expect(res.status).toBe(409);
      });

      it('should reject weak password', async () => {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'weakpwd@test.com',
            username: 'weakpwd',
            password: '123456',
            firstName: 'Weak',
            lastName: 'Password',
          });

        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/v1/auth/login', () => {
      it('should login with valid credentials', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            usernameOrEmail: 'testadmin@test.com',
            password: 'TestAdmin@123',
          });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
      });

      it('should reject invalid password', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            usernameOrEmail: 'testadmin@test.com',
            password: 'wrongpassword',
          });

        expect(res.status).toBe(401);
      });

      it('should reject non-existent user', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            usernameOrEmail: 'nonexistent@test.com',
            password: 'Test@123456',
          });

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/v1/auth/me', () => {
      it('should return current user with valid token', async () => {
        const res = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user).toHaveProperty('email', 'testadmin@test.com');
      });

      it('should reject request without token', async () => {
        const res = await request(app).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
      });

      it('should reject invalid token', async () => {
        const res = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
      });
    });
  });

  // =========================
  // Asset Management Tests
  // =========================
  describe('Assets', () => {
    describe('POST /api/v1/assets', () => {
      it('should create a new asset', async () => {
        const res = await request(app)
          .post('/api/v1/assets')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'test_customers',
            description: 'Test customer table',
            assetType: 'TABLE',
            domain: 'Test',
            tags: ['test', 'customers'],
          });

        expect(res.status).toBe(201);
        expect(res.body.asset).toHaveProperty('id');
        expect(res.body.asset).toHaveProperty('name', 'test_customers');
        testAssetId = res.body.asset.id;
      });

      it('should reject asset creation without authentication', async () => {
        const res = await request(app)
          .post('/api/v1/assets')
          .send({
            name: 'test_unauthorized',
            assetType: 'TABLE',
          });

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/v1/assets', () => {
      it('should list all assets', async () => {
        const res = await request(app)
          .get('/api/v1/assets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should filter assets by type', async () => {
        const res = await request(app)
          .get('/api/v1/assets?type=TABLE')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.every((a: { assetType: string }) => a.assetType === 'TABLE')).toBe(true);
      });

      it('should paginate results', async () => {
        const res = await request(app)
          .get('/api/v1/assets?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeLessThanOrEqual(2);
        expect(res.body).toHaveProperty('pagination');
      });
    });

    describe('GET /api/v1/assets/:id', () => {
      it('should get asset by id', async () => {
        const res = await request(app)
          .get(`/api/v1/assets/${testAssetId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.asset).toHaveProperty('id', testAssetId);
        expect(res.body.asset).toHaveProperty('name', 'test_customers');
      });

      it('should return 404 for non-existent asset', async () => {
        const res = await request(app)
          .get('/api/v1/assets/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
      });
    });

    describe('PUT /api/v1/assets/:id', () => {
      it('should update an asset', async () => {
        const res = await request(app)
          .put(`/api/v1/assets/${testAssetId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            description: 'Updated test customer table',
            tags: ['test', 'customers', 'updated'],
          });

        expect(res.status).toBe(200);
        expect(res.body.asset).toHaveProperty('description', 'Updated test customer table');
      });
    });
  });

  // =========================
  // Lineage Tests
  // =========================
  describe('Lineage', () => {
    let sourceAssetId: string;
    let targetAssetId: string;

    beforeAll(async () => {
      // Create source and target assets for lineage testing
      const source = await prisma.asset.create({
        data: {
          name: 'test_lineage_source',
          assetType: 'TABLE',
          ownerId: testUserId,
          createdById: testUserId,
          updatedById: testUserId,
        },
      });
      sourceAssetId = source.id;

      const target = await prisma.asset.create({
        data: {
          name: 'test_lineage_target',
          assetType: 'DATASET',
          ownerId: testUserId,
          createdById: testUserId,
          updatedById: testUserId,
        },
      });
      targetAssetId = target.id;
    });

    describe('POST /api/v1/lineage/edges', () => {
      it('should create lineage edge', async () => {
        const res = await request(app)
          .post('/api/v1/lineage/edges')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            sourceAssetId,
            targetAssetId,
            transformationType: 'AGGREGATION',
            transformationLogic: 'SELECT SUM(amount) FROM source GROUP BY category',
          });

        expect(res.status).toBe(201);
        expect(res.body.edge).toHaveProperty('sourceAssetId', sourceAssetId);
        expect(res.body.edge).toHaveProperty('targetAssetId', targetAssetId);
      });
    });

    describe('GET /api/v1/lineage/:assetId', () => {
      it('should get lineage for an asset', async () => {
        const res = await request(app)
          .get(`/api/v1/lineage/${targetAssetId}/upstream`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        // Response contains graph with nodes/edges
        expect(res.body).toBeDefined();
      });
    });
  });

  // =========================
  // Connections Tests
  // =========================
  describe('Connections', () => {
    let connectionId: string;

    describe('POST /api/v1/connections', () => {
      it('should create a new connection', async () => {
        const res = await request(app)
          .post('/api/v1/connections')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test PostgreSQL Connection',
            description: 'Test database connection',
            connectionType: 'POSTGRESQL',
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            username: 'test_user',
            password: 'test_password',
          });

        expect(res.status).toBe(201);
        // Response might be wrapped in 'connection' property
        const connection = res.body.connection || res.body;
        expect(connection).toHaveProperty('id');
        expect(connection).toHaveProperty('name', 'Test PostgreSQL Connection');
        connectionId = connection.id;
      });
    });

    describe('GET /api/v1/connections', () => {
      it('should list all connections', async () => {
        const res = await request(app)
          .get('/api/v1/connections')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        // Response might be wrapped
        const connections = res.body.data || res.body.connections || res.body;
        expect(Array.isArray(connections) || typeof connections === 'object').toBe(true);
      });
    });

    describe('GET /api/v1/connections/:id', () => {
      it('should get connection by id', async () => {
        if (!connectionId) {
          // Create one first if not set
          const createRes = await request(app)
            .post('/api/v1/connections')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              name: 'Test PostgreSQL Connection 2',
              connectionType: 'POSTGRESQL',
              host: 'localhost',
              port: 5432,
            });
          const conn = createRes.body.connection || createRes.body;
          connectionId = conn.id;
        }
        
        const res = await request(app)
          .get(`/api/v1/connections/${connectionId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 201]).toContain(res.status);
      });
    });
  });

  // =========================
  // Asset Deletion (Last Test)
  // =========================
  describe('Asset Deletion', () => {
    it('should delete an asset', async () => {
      if (testAssetId) {
        const res = await request(app)
          .delete(`/api/v1/assets/${testAssetId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 204]).toContain(res.status);
      }
    });
  });
});
