// Test setup file
import { prisma } from '../lib/prisma.js';

// Increase timeout for database operations
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
