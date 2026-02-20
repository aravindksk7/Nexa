import { Router } from 'express';
import { body } from 'express-validator';
import { authenticationService } from '../services/authentication.service.js';
import { authenticate, authorize, asyncHandler, validate } from '../middleware/index.js';
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

// GET /api/v1/auth/users - List all users
authRouter.get(
  '/users',
  authenticate,
  asyncHandler(async (req, res) => {
    const users = await authenticationService.listUsers();
    res.json({ data: users });
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

// PUT /api/v1/auth/profile
authRouter.put(
  '/profile',
  authenticate,
  validate([
    body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('firstName').optional().isLength({ max: 100 }).withMessage('First name must be at most 100 characters'),
    body('lastName').optional().isLength({ max: 100 }).withMessage('Last name must be at most 100 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const { username, firstName, lastName } = req.body;
    const user = await authenticationService.updateProfile(req.user!.id, { username, firstName, lastName });
    res.json({ user });
  })
);

// === ADMIN ONLY ROUTES ===

// GET /api/v1/auth/admin/users/:id - Get a specific user (Admin only)
authRouter.get(
  '/admin/users/:id',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const user = await authenticationService.getUserById(req.params['id']!);
    res.json({ user });
  })
);

// PUT /api/v1/auth/admin/users/:id - Update a user (Admin only)
authRouter.put(
  '/admin/users/:id',
  authenticate,
  authorize('ADMIN'),
  validate([
    body('firstName').optional().isLength({ max: 100 }).withMessage('First name must be at most 100 characters'),
    body('lastName').optional().isLength({ max: 100 }).withMessage('Last name must be at most 100 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, username } = req.body;
    const user = await authenticationService.updateUser(req.params['id']!, {
      firstName,
      lastName,
      email,
      username,
    });
    res.json({ user });
  })
);

// PUT /api/v1/auth/admin/users/:id/role - Change user role (Admin only)
authRouter.put(
  '/admin/users/:id/role',
  authenticate,
  authorize('ADMIN'),
  validate([
    body('role').notEmpty().isIn(['ADMIN', 'DATA_STEWARD', 'DATA_ANALYST', 'BUSINESS_ANALYST']).withMessage('Valid role is required'),
  ]),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const user = await authenticationService.changeUserRole(req.params['id']!, role);
    res.json({ user });
  })
);

// DELETE /api/v1/auth/admin/users/:id - Deactivate a user (Admin only)
authRouter.delete(
  '/admin/users/:id',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const user = await authenticationService.deactivateUser(req.params['id']!);
    res.json({ user, message: 'User deactivated successfully' });
  })
);

// POST /api/v1/auth/admin/users/:id/reactivate - Reactivate a user (Admin only)
authRouter.post(
  '/admin/users/:id/reactivate',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const user = await authenticationService.reactivateUser(req.params['id']!);
    res.json({ user, message: 'User reactivated successfully' });
  })
);

export default authRouter;
