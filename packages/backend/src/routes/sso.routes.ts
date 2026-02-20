import { Router, Request, Response } from 'express';
import { authenticate, authorize, asyncHandler } from '../middleware/index.js';
import { body, validationResult } from 'express-validator';
import { ssoService } from '../services/sso.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/sso - Get all SSO configurations
router.get(
  '/',
  authorize('ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const configurations = await ssoService.getConfigurations();
    res.json({ configurations });
  })
);

// GET /api/v1/sso/:id - Get a specific SSO configuration
router.get(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }
    const configuration = await ssoService.getConfigurationById(id);
    res.json(configuration);
  })
);

// POST /api/v1/sso - Create a new SSO configuration
router.post(
  '/',
  authorize('ADMIN'),
  [
    body('provider').notEmpty().withMessage('Provider is required').isIn(['oauth2', 'saml', 'ldap']).withMessage('Provider must be oauth2, saml, or ldap'),
    body('name').notEmpty().trim().withMessage('Name is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { provider, name, clientId, clientSecret, discoveryUrl, ldapServer, ldapPort, ldapBaseDN, ldapBindDN, ldapBindPassword, ldapUserFilter, samlMetadataUrl, samlCert, samlPrivateKey, customConfig } = req.body;

    const createData: any = { provider, name };
    if (clientId !== undefined) createData.clientId = clientId;
    if (clientSecret !== undefined) createData.clientSecret = clientSecret;
    if (discoveryUrl !== undefined) createData.discoveryUrl = discoveryUrl;
    if (ldapServer !== undefined) createData.ldapServer = ldapServer;
    if (ldapPort !== undefined) createData.ldapPort = parseInt(ldapPort);
    if (ldapBaseDN !== undefined) createData.ldapBaseDN = ldapBaseDN;
    if (ldapBindDN !== undefined) createData.ldapBindDN = ldapBindDN;
    if (ldapBindPassword !== undefined) createData.ldapBindPassword = ldapBindPassword;
    if (ldapUserFilter !== undefined) createData.ldapUserFilter = ldapUserFilter;
    if (samlMetadataUrl !== undefined) createData.samlMetadataUrl = samlMetadataUrl;
    if (samlCert !== undefined) createData.samlCert = samlCert;
    if (samlPrivateKey !== undefined) createData.samlPrivateKey = samlPrivateKey;
    if (customConfig !== undefined) createData.customConfig = customConfig;

    const configuration = await ssoService.createConfiguration(createData);

    res.status(201).json(configuration);
  })
);

// PUT /api/v1/sso/:id - Update an SSO configuration
router.put(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }
    const { name, enabled, clientId, clientSecret, discoveryUrl, ldapServer, ldapPort, ldapBaseDN, ldapBindDN, ldapBindPassword, ldapUserFilter, samlMetadataUrl, samlCert, samlPrivateKey, customConfig } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (clientSecret !== undefined) updateData.clientSecret = clientSecret;
    if (discoveryUrl !== undefined) updateData.discoveryUrl = discoveryUrl;
    if (ldapServer !== undefined) updateData.ldapServer = ldapServer;
    if (ldapPort !== undefined) updateData.ldapPort = parseInt(ldapPort);
    if (ldapBaseDN !== undefined) updateData.ldapBaseDN = ldapBaseDN;
    if (ldapBindDN !== undefined) updateData.ldapBindDN = ldapBindDN;
    if (ldapBindPassword !== undefined) updateData.ldapBindPassword = ldapBindPassword;
    if (ldapUserFilter !== undefined) updateData.ldapUserFilter = ldapUserFilter;
    if (samlMetadataUrl !== undefined) updateData.samlMetadataUrl = samlMetadataUrl;
    if (samlCert !== undefined) updateData.samlCert = samlCert;
    if (samlPrivateKey !== undefined) updateData.samlPrivateKey = samlPrivateKey;
    if (customConfig !== undefined) updateData.customConfig = customConfig;

    const configuration = await ssoService.updateConfiguration(id, updateData);

    res.json(configuration);
  })
);

// DELETE /api/v1/sso/:id - Delete an SSO configuration
router.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }
    await ssoService.deleteConfiguration(id);
    res.status(204).send();
  })
);

// POST /api/v1/sso/:id/test - Test SSO configuration
router.post(
  '/:id/test',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }
    const testResult = await ssoService.testConfiguration(id);
    res.json(testResult);
  })
);

// POST /api/v1/sso/:id/enable - Enable SSO configuration
router.post(
  '/:id/enable',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }
    const configuration = await ssoService.enableConfiguration(id);
    res.json(configuration);
  })
);

// POST /api/v1/sso/:id/disable - Disable SSO configuration
router.post(
  '/:id/disable',
  authorize('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'ID is required' });
      return;
    }
    const configuration = await ssoService.disableConfiguration(id);
    res.json(configuration);
  })
);

export default router;

