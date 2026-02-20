import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { createChildLogger } from '../utils/logger.js';
import { UnauthorizedError, ValidationError, ConflictError, NotFoundError } from '../middleware/errorHandler.js';
import type { User, CreateUser, LoginInput, Role } from '../models/index.js';

const logger = createChildLogger('AuthenticationService');

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/;

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
}

export interface LoginResponse extends AuthToken {
  user: User;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export class AuthenticationService {
  /**
   * Register a new user
   */
  async register(data: CreateUser): Promise<User> {
    logger.debug({ email: data.email }, 'Registering new user');

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      throw new ConflictError('User with this email or username already exists');
    }

    // Validate password complexity
    this.validatePasswordComplexity(data.password);

    // Hash password using Argon2id (recommended for password hashing)
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ?? 'BUSINESS_ANALYST',
      },
    });

    logger.info({ userId: user.id }, 'User registered successfully');

    return this.sanitizeUser(user);
  }

  /**
   * Authenticate user and generate tokens
   */
  async login(input: LoginInput): Promise<LoginResponse> {
    logger.debug({ usernameOrEmail: input.usernameOrEmail }, 'Login attempt');

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.usernameOrEmail }, { username: input.usernameOrEmail }],
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await argon2.verify(user.passwordHash, input.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    logger.info({ userId: user.id }, 'User logged in successfully');

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Validate and decode access token
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedError('User not found or inactive');
      }

      return this.sanitizeUser(user);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;

      // Check if refresh token exists and is not revoked
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: payload.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!storedToken || !storedToken.user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Revoke old refresh token
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      // Generate new tokens
      const tokens = await this.generateTokens(storedToken.user);

      logger.debug({ userId: payload.userId }, 'Token refreshed');

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user and invalidate refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });

    logger.debug('User logged out');
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify old password
    const isValidPassword = await argon2.verify(user.passwordHash, oldPassword);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid current password');
    }

    // Validate new password complexity
    this.validatePasswordComplexity(newPassword);

    // Hash and update password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    logger.info({ userId }, 'Password changed successfully');

    return true;
  }

  /**
   * Validate password complexity
   */
  private validatePasswordComplexity(password: string): void {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      throw new ValidationError(
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      );
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: { id: string; email: string; role: string }
  ): Promise<AuthToken> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    // Store refresh token (upsert to handle duplicate tokens from rapid logins)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.upsert({
      where: { token: refreshToken },
      update: { expiresAt },
      create: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: { username?: string; firstName?: string; lastName?: string }
  ): Promise<User> {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check username uniqueness if being updated
    if (updates.username && updates.username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: updates.username },
      });
      if (usernameExists) {
        throw new ConflictError('Username is already taken');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    return this.sanitizeUser(updatedUser);
  }

  /**
   * List all users
   */
  async listUsers(): Promise<User[]> {
    logger.debug('Listing all users');

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { username: 'asc' },
    });

    return users.map((user: any) => this.sanitizeUser(user));
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User> {
    logger.debug({ userId }, 'Getting user by ID');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Update user (Admin only)
   */
  async updateUser(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      username?: string;
    }
  ): Promise<User> {
    logger.debug({ userId, data }, 'Updating user');

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Check for email/username conflicts
    if (data.email || data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            data.email ? { email: data.email } : undefined,
            data.username ? { username: data.username } : undefined,
          ].filter(Boolean),
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new ConflictError('Email or username already in use');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        username: data.username,
      },
    });

    logger.info({ userId }, 'User updated successfully');
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Change user role (Admin only)
   */
  async changeUserRole(userId: string, newRole: Role): Promise<User> {
    logger.debug({ userId, newRole }, 'Changing user role');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    logger.info({ userId, newRole }, 'User role changed successfully');
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Deactivate user (Admin only)
   */
  async deactivateUser(userId: string): Promise<User> {
    logger.debug({ userId }, 'Deactivating user');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    logger.info({ userId }, 'User deactivated successfully');
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Reactivate user (Admin only)
   */
  async reactivateUser(userId: string): Promise<User> {
    logger.debug({ userId }, 'Reactivating user');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    logger.info({ userId }, 'User reactivated successfully');
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      role: user.role as Role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const authenticationService = new AuthenticationService();
