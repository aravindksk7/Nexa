import { prisma } from '../src/lib/prisma';

// Increase timeout for database operations
jest.setTimeout(30000);

// Ensure database connection before tests
beforeAll(async () => {
  await prisma.$connect();
});

// Close database connection after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
