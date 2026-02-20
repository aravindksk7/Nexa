import { prisma } from '../lib/prisma.js';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('SSOService');

export class SSOService {
  /**
   * Get all SSO configurations
   */
  async getConfigurations() {
    try {
      const configs = await prisma.sSOConfiguration.findMany({
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          clientId: true,
          discoveryUrl: true,
          ldapServer: true,
          ldapPort: true,
          ldapBaseDN: true,
          samlMetadataUrl: true,
          testResult: true,
          lastTestedAt: true,
          createdAt: true,
          updatedAt: true,
          // Never return secrets in list
        },
      });

      return configs;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single SSO configuration by ID
   */
  async getConfigurationById(id: string) {
    try {
      const config = await prisma.sSOConfiguration.findUnique({
        where: { id },
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          clientId: true,
          discoveryUrl: true,
          ldapServer: true,
          ldapPort: true,
          ldapBaseDN: true,
          ldapBindDN: true,
          ldapUserFilter: true,
          samlMetadataUrl: true,
          customConfig: true,
          testResult: true,
          lastTestedAt: true,
          createdAt: true,
          updatedAt: true,
          // Never return secrets
        },
      });

      if (!config) {
        throw new NotFoundError(`SSO configuration with ID ${id} not found`);
      }

      return config;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new SSO configuration
   */
  async createConfiguration(data: {
    provider: string;
    name: string;
    clientId?: string;
    clientSecret?: string;
    discoveryUrl?: string;
    ldapServer?: string;
    ldapPort?: number;
    ldapBaseDN?: string;
    ldapBindDN?: string;
    ldapBindPassword?: string;
    ldapUserFilter?: string;
    samlMetadataUrl?: string;
    samlCert?: string;
    samlPrivateKey?: string;
    customConfig?: Record<string, any>;
  }) {
    try {
      // Check if configuration with same provider and name already exists
      const existing = await prisma.sSOConfiguration.findUnique({
        where: {
          provider_name: {
            provider: data.provider,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new ConflictError(`SSO configuration '${data.name}' for provider '${data.provider}' already exists`);
      }

      // Validate provider type
      if (!['oauth2', 'saml', 'ldap'].includes(data.provider.toLowerCase())) {
        throw new ValidationError('Provider must be one of: oauth2, saml, ldap');
      }

      const config = await prisma.sSOConfiguration.create({
        data: {
          provider: data.provider.toLowerCase(),
          name: data.name,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          discoveryUrl: data.discoveryUrl,
          ldapServer: data.ldapServer,
          ldapPort: data.ldapPort,
          ldapBaseDN: data.ldapBaseDN,
          ldapBindDN: data.ldapBindDN,
          ldapBindPassword: data.ldapBindPassword,
          ldapUserFilter: data.ldapUserFilter || '(uid={0})',
          samlMetadataUrl: data.samlMetadataUrl,
          samlCert: data.samlCert,
          samlPrivateKey: data.samlPrivateKey,
          customConfig: data.customConfig,
        },
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          clientId: true,
          discoveryUrl: true,
          ldapServer: true,
          ldapPort: true,
          ldapBaseDN: true,
          ldapUserFilter: true,
          samlMetadataUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return config;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an SSO configuration
   */
  async updateConfiguration(
    id: string,
    data: {
      name?: string;
      enabled?: boolean;
      clientId?: string;
      clientSecret?: string;
      discoveryUrl?: string;
      ldapServer?: string;
      ldapPort?: number;
      ldapBaseDN?: string;
      ldapBindDN?: string;
      ldapBindPassword?: string;
      ldapUserFilter?: string;
      samlMetadataUrl?: string;
      samlCert?: string;
      samlPrivateKey?: string;
      customConfig?: Record<string, any>;
    }
  ) {
    try {
      // Check if configuration exists
      const existing = await prisma.sSOConfiguration.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError(`SSO configuration with ID ${id} not found`);
      }

      const config = await prisma.sSOConfiguration.update({
        where: { id },
        data: {
          ...data,
        },
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          clientId: true,
          discoveryUrl: true,
          ldapServer: true,
          ldapPort: true,
          ldapBaseDN: true,
          ldapUserFilter: true,
          samlMetadataUrl: true,
          testResult: true,
          lastTestedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return config;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete an SSO configuration
   */
  async deleteConfiguration(id: string) {
    try {
      const existing = await prisma.sSOConfiguration.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError(`SSO configuration with ID ${id} not found`);
      }

      await prisma.sSOConfiguration.delete({
        where: { id },
      });

      return { success: true, message: 'SSO configuration deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test SSO configuration connection
   * This is a basic implementation - real testing would involve actual OAuth2/SAML/LDAP connections
   */
  async testConfiguration(id: string) {
    try {
      const config = await prisma.sSOConfiguration.findUnique({
        where: { id },
      });

      if (!config) {
        throw new NotFoundError(`SSO configuration with ID ${id} not found`);
      }

      let testResult: any = {
        success: false,
        message: 'Configuration validation in progress',
        timestamp: new Date().toISOString(),
      };

      // Perform basic validation based on provider type
      switch (config.provider.toLowerCase()) {
        case 'oauth2':
          if (!config.clientId || !config.discoveryUrl) {
            testResult.success = false;
            testResult.message = 'OAuth2 configuration requires clientId and discoveryUrl';
          } else {
            testResult.success = true;
            testResult.message = 'OAuth2 configuration is valid';
          }
          break;

        case 'saml':
          if (!config.samlMetadataUrl) {
            testResult.success = false;
            testResult.message = 'SAML configuration requires samlMetadataUrl';
          } else {
            testResult.success = true;
            testResult.message = 'SAML configuration is valid';
          }
          break;

        case 'ldap':
          if (!config.ldapServer || !config.ldapPort || !config.ldapBaseDN) {
            testResult.success = false;
            testResult.message = 'LDAP configuration requires ldapServer, ldapPort, and ldapBaseDN';
          } else {
            testResult.success = true;
            testResult.message = 'LDAP configuration is valid (actual connection test not implemented)';
          }
          break;

        default:
          testResult.success = false;
          testResult.message = 'Unknown provider type';
      }

      // Update test result and timestamp
      await prisma.sSOConfiguration.update({
        where: { id },
        data: {
          testResult: testResult,
          lastTestedAt: new Date(),
        },
      });

      return testResult;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Enable an SSO configuration
   */
  async enableConfiguration(id: string) {
    try {
      const config = await prisma.sSOConfiguration.update({
        where: { id },
        data: { enabled: true },
        select: {
          id: true,
          name: true,
          provider: true,
          enabled: true,
        },
      });

      return config;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disable an SSO configuration
   */
  async disableConfiguration(id: string) {
    try {
      const config = await prisma.sSOConfiguration.update({
        where: { id },
        data: { enabled: false },
        select: {
          id: true,
          name: true,
          provider: true,
          enabled: true,
        },
      });

      return config;
    } catch (error) {
      throw error;
    }
  }
}

export const ssoService = new SSOService();
