import { AuthenticationService } from '../../src/services/authentication.service';
import { prisma } from '../../src/lib/prisma';

// Mock argon2 module
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2,
}));

import * as argon2 from 'argon2';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  
  beforeEach(() => {
    authService = new AuthenticationService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecureP@ss123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user with valid data', async () => {
      const mockUser = {
        id: 'user-123',
        ...validUserData,
        passwordHash: 'hashed-password',
        role: 'BUSINESS_ANALYST',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.register(validUserData);

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', validUserData.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictError when email already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: validUserData.email,
      });

      await expect(authService.register(validUserData)).rejects.toThrow(
        'User with this email or username already exists'
      );
    });

    it('should throw ValidationError for weak password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const weakPasswordData = { ...validUserData, password: 'weak' };
      await expect(authService.register(weakPasswordData)).rejects.toThrow();
    });

    it('should throw ValidationError for password without uppercase', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const noUppercase = { ...validUserData, password: 'lowercase@123' };
      await expect(authService.register(noUppercase)).rejects.toThrow();
    });

    it('should throw ValidationError for password without special char', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const noSpecial = { ...validUserData, password: 'NoSpecial123' };
      await expect(authService.register(noSpecial)).rejects.toThrow();
    });

    it('should throw ValidationError for password shorter than 8 characters', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const shortPassword = { ...validUserData, password: 'Sh@rt1' };
      await expect(authService.register(shortPassword)).rejects.toThrow();
    });
  });

  describe('login', () => {
    const hashedPassword = 'argon2-hashed-password';
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      firstName: 'Test',
      lastName: 'User',
    };

    beforeEach(() => {
      // Reset argon2 verify to return true
      (argon2.verify as jest.Mock).mockResolvedValue(true);
    });

    it('should login with valid email credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.upsert as jest.Mock).mockResolvedValue({ token: 'refresh-token' });

      const result = await authService.login({
        usernameOrEmail: 'test@example.com',
        password: 'SecureP@ss123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tokenType', 'Bearer');
    });

    it('should login with valid username credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.upsert as jest.Mock).mockResolvedValue({ token: 'refresh-token' });

      const result = await authService.login({
        usernameOrEmail: 'testuser',
        password: 'SecureP@ss123',
      });

      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedError for non-existent user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login({ usernameOrEmail: 'nonexistent@test.com', password: 'Pass@123' })
      ).rejects.toThrow();
    });

    it('should throw UnauthorizedError for invalid password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({ usernameOrEmail: 'test@example.com', password: 'WrongPass@123' })
      ).rejects.toThrow();
    });

    it('should throw UnauthorizedError for inactive user', async () => {
      // Service filters by isActive: true, so inactive user won't be found
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login({ usernameOrEmail: 'test@example.com', password: 'SecureP@ss123' })
      ).rejects.toThrow();
    });
  });

  describe('password validation rules', () => {
    it('should accept password with all required characters', () => {
      const service = new AuthenticationService();
      // Password has lowercase, uppercase, digit, and special char
      expect(() =>
        (service as any).validatePasswordComplexity('ValidP@ss123')
      ).not.toThrow();
    });

    it('should reject password without digits', () => {
      const service = new AuthenticationService();
      expect(() =>
        (service as any).validatePasswordComplexity('NoDigits@Here')
      ).toThrow();
    });
  });
});
