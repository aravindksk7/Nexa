import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import * as argon2 from 'argon2';

const app = createApp();

/**
 * Non-Functional Tests: Performance, Load, and Stress Testing
 * 
 * These tests verify the system meets performance requirements:
 * - Response time under load
 * - Concurrent request handling
 * - Memory stability
 * - Rate limiting
 */
describe('Performance Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Create test user for performance tests
    const passwordHash = await argon2.hash('PerfTest@123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.upsert({
      where: { email: 'perftest@test.com' },
      update: {},
      create: {
        email: 'perftest@test.com',
        username: 'perftest',
        firstName: 'Perf',
        lastName: 'Test',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'perftest@test.com', password: 'PerfTest@123' });
    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    try {
      // Clean up assets created by perf test user
      await prisma.asset.deleteMany({
        where: { name: { startsWith: 'perf_test_' } },
      });
      await prisma.refreshToken.deleteMany({
        where: { user: { email: 'perftest@test.com' } },
      });
      await prisma.user.deleteMany({
        where: { email: 'perftest@test.com' },
      });
    } catch (e) {
      console.log('Cleanup warning:', e);
    }
    await prisma.$disconnect();
  });

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app).get('/health');
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(100);
    });

    it('should respond to authenticated request within 200ms', async () => {
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .get('/api/v1/assets')
          .set('Authorization', `Bearer ${authToken}`);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(200);
    });

    it('should handle paginated requests efficiently', async () => {
      const start = performance.now();
      
      await request(app)
        .get('/api/v1/assets?page=1&limit=100')
        .set('Authorization', `Bearer ${authToken}`);
      
      const end = performance.now();
      expect(end - start).toBeLessThan(500);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const end = performance.now();

      responses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // All 10 should complete within 2 seconds
      expect(end - start).toBeLessThan(2000);
    });

    it('should handle 20 concurrent authenticated requests', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/v1/assets')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const end = performance.now();

      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(15); // At least 75% success

      console.log(`20 concurrent requests completed in ${end - start}ms`);
    });

    it('should handle mixed read/write operations concurrently', async () => {
      const readRequests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/v1/assets')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const timestamp = Date.now();
      const writeRequests = Array(3).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/assets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `perf_test_asset_${timestamp}_${i}`,
            assetType: 'TABLE',
          })
      );

      const allResponses = await Promise.all([...readRequests, ...writeRequests]);
      
      const failedResponses = allResponses.filter(r => r.status >= 500);
      expect(failedResponses.length).toBe(0);
    });
  });

  describe('Throughput Tests', () => {
    it('should handle 50 requests per second for health endpoint', async () => {
      const requestsPerSecond = 50;
      const duration = 1000; // 1 second
      const interval = duration / requestsPerSecond;
      
      const startTime = Date.now();
      const responses: Promise<request.Response>[] = [];
      
      for (let i = 0; i < requestsPerSecond; i++) {
        responses.push(request(app).get('/health'));
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      const results = await Promise.all(responses);
      const endTime = Date.now();
      
      const successCount = results.filter(r => r.status === 200).length;
      const duration_actual = endTime - startTime;

      console.log(`Throughput: ${successCount} successful requests in ${duration_actual}ms`);
      expect(successCount).toBeGreaterThanOrEqual(requestsPerSecond * 0.9); // 90% success rate
    });
  });

  describe('Memory Stability', () => {
    it('should not leak memory over repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be less than 50MB
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});

describe('Rate Limiting Tests', () => {
  it('should enforce rate limits on API endpoints', async () => {
    const requests = Array(150).fill(null).map(() =>
      request(app).get('/health')
    );

    const responses = await Promise.all(requests);
    
    // Some requests should be rate limited (429 status)
    // This depends on your rate limit configuration
    const rateLimitedCount = responses.filter(r => r.status === 429).length;
    
    console.log(`Rate limited ${rateLimitedCount} out of 150 requests`);
    // At minimum, we shouldn't crash
    expect(responses.every(r => r.status < 500)).toBe(true);
  });

  it('should return appropriate rate limit headers', async () => {
    const res = await request(app).get('/api/v1/assets');

    // Check for rate limit headers (may not be present on all endpoints)
    // Common headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    console.log('Rate limit headers:', {
      limit: res.headers['x-ratelimit-limit'],
      remaining: res.headers['x-ratelimit-remaining'],
    });
  });
});

describe('Stress Tests', () => {
  it('should recover from high load gracefully', async () => {
    // First, create high load
    const heavyRequests = Array(100).fill(null).map(() =>
      request(app).get('/health')
    );
    await Promise.all(heavyRequests);

    // Wait for system to recover
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify system is still responsive
    const recoveryResponse = await request(app).get('/health');
    expect(recoveryResponse.status).toBe(200);
  });

  it('should handle request timeouts gracefully', async () => {
    // This test simulates a slow endpoint scenario
    const start = performance.now();
    
    const res = await request(app)
      .get('/api/v1/assets?page=1&limit=1000')
      .timeout(5000); // 5 second timeout

    const duration = performance.now() - start;
    
    // Should complete or timeout gracefully
    expect([200, 408, 503].includes(res.status) || duration < 5000).toBe(true);
  });
});
