import { Router } from 'express';
import { body } from 'express-validator';
import { authenticationService } from '../services/authentication.service.js';
import { authenticate, asyncHandler, validate } from '../middleware/index.js';
import { LoginSchema, CreateUserSchema } from '../models/index.js';

export const authRouter = Router();

// POST /api/v1/auth/register
authRouter.post(
  '/register',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const data = CreateUserSchema.parse(req.body);
    const user = await authenticationService.register(data);
    res.status(201).json({ user });
  })
);

// POST /api/v1/auth/login
authRouter.post(
  '/login',
  validate([
    body('usernameOrEmail').notEmpty().withMessage('Username or email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  asyncHandler(async (req, res) => {
    const data = LoginSchema.parse(req.body);
    const tokens = await authenticationService.login(data);
    res.json(tokens);
  })
);

// POST /api/v1/auth/logout
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken as string;
    if (refreshToken) {
      await authenticationService.logout(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  })
);

// POST /api/v1/auth/refresh
authRouter.post(
  '/refresh',
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ]),
  asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken as string;
    const tokens = await authenticationService.refreshToken(refreshToken);
    res.json(tokens);
  })
);

// GET /api/v1/auth/me
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

// POST /api/v1/auth/change-password
authRouter.post(
  '/change-password',
  authenticate,
  validate([
    body('oldPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    await authenticationService.changePassword(req.user!.id, oldPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  })
);
