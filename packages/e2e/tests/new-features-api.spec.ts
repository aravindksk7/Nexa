import { test, expect } from '@playwright/test';

/**
 * New Features API E2E Tests
 *
 * Tests cover (via API):
 * - Workflow CRUD operations
 * - Notification CRUD operations
 * - Quality Rules CRUD operations
 */

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001/api/v1';
const ADMIN = { usernameOrEmail: 'admin@dataplatform.com', password: 'Admin@123456' };

let authToken: string;
let assetId: string;

test.describe('Workflows API', () => {
  test.beforeAll(async ({ request }) => {
    // Login to get auth token
    const response = await request.post(`${BASE_URL}/auth/login`, {
      data: ADMIN,
    });

    if (response.ok()) {
      const body = await response.json();
      authToken = body.accessToken;
    }
  });

  test('should list workflows via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    const response = await request.get(`${BASE_URL}/workflows`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('workflows');
    expect(Array.isArray(body.workflows)).toBeTruthy();
  });

  test('should create a workflow via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    const response = await request.post(`${BASE_URL}/workflows`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'E2E Test Workflow',
        description: 'Created by e2e test',
        definition: {
          steps: [{ name: 'Review', type: 'APPROVAL' }],
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('workflow');
    expect(body.workflow.name).toBe('E2E Test Workflow');
  });

  test('should list workflow instances via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    const response = await request.get(`${BASE_URL}/workflows/instances/list`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('instances');
    expect(Array.isArray(body.instances)).toBeTruthy();
  });
});

test.describe('Notifications API', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/login`, {
      data: ADMIN,
    });

    if (response.ok()) {
      const body = await response.json();
      authToken = body.accessToken;
    }
  });

  test('should list notifications via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    const response = await request.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('notifications');
    expect(Array.isArray(body.notifications)).toBeTruthy();
  });

  test('should return unread count via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    const response = await request.get(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('count');
    expect(typeof body.count).toBe('number');
  });

  test('should create a notification via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    // Get the user ID first
    const meRes = await request.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const userId = meRes.ok() ? (await meRes.json()).user?.id : undefined;
    test.skip(!userId, 'User ID required');

    const response = await request.post(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        userId,
        type: 'SYSTEM',
        title: 'E2E Test Notification',
        message: 'Created by e2e test',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('notification');
    expect(body.notification.title).toBe('E2E Test Notification');
  });
});

test.describe('Quality Rules API', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/login`, {
      data: ADMIN,
    });

    if (response.ok()) {
      const body = await response.json();
      authToken = body.accessToken;
    }

    // Get an asset ID for rules tests
    if (authToken) {
      const assetsRes = await request.get(`${BASE_URL}/assets?page=1&limit=1`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (assetsRes.ok()) {
        const assetsBody = await assetsRes.json();
        assetId = assetsBody.data?.[0]?.id;
      }
    }
  });

  test('should return quality overview via API', async ({ request }) => {
    test.skip(!authToken, 'Auth token required');

    const response = await request.get(`${BASE_URL}/quality/overview`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('overallScore');
    expect(body).toHaveProperty('totalRules');
    expect(body).toHaveProperty('passedRules');
    expect(body).toHaveProperty('failedRules');
  });

  test('should create quality rule with COMPLETENESS type', async ({ request }) => {
    test.skip(!authToken || !assetId, 'Auth token and asset ID required');

    const response = await request.post(`${BASE_URL}/quality/rules`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'E2E Completeness Rule',
        description: 'Created by e2e test',
        ruleType: 'COMPLETENESS',
        severity: 'WARNING',
        assetId: assetId,
        ruleDefinition: { threshold: 90 },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('rule');
    expect(body.rule.ruleType).toBe('COMPLETENESS');
    expect(body.rule.severity).toBe('WARNING');
  });
});
