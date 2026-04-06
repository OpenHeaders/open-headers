import type { Environment, EnvironmentVariable } from '@openheaders/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('@/renderer/utils/error-handling/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const EnvironmentVariableManager = (
  await import('../../../../src/renderer/services/environment/EnvironmentVariableManager')
).default;

// ---------------------------------------------------------------------------
// Enterprise-realistic factory
// ---------------------------------------------------------------------------

function makeEnv(id: string, name: string, variables: Record<string, EnvironmentVariable>): Environment {
  return { id, name, variables, createdAt: '2025-11-15T09:30:00.000Z' };
}

function makeEnterpriseEnvs(): Environment[] {
  return [
    makeEnv('env-default', 'Default', {
      OAUTH2_CLIENT_ID: {
        value: 'oidc-client-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        isSensitive: false,
        updatedAt: '2025-11-15T09:30:00.000Z',
      },
      OAUTH2_CLIENT_SECRET: {
        value: 'ohk_live_4eC39HqLyjWDarjtT1zdp7dc',
        isSensitive: true,
        updatedAt: '2025-11-15T09:30:00.000Z',
      },
      API_GATEWAY_URL: {
        value: 'https://gateway.openheaders.io:8443/v2',
        isSensitive: false,
        updatedAt: '2025-11-15T09:30:00.000Z',
      },
      DATABASE_CONNECTION_STRING: {
        value: 'postgresql://admin:P@ss=w0rd&special@db.openheaders.internal:5432/production?sslmode=require',
        isSensitive: true,
        updatedAt: '2026-01-20T14:45:12.345Z',
      },
    }),
    makeEnv('env-staging', 'Staging — EU Region', {
      OAUTH2_CLIENT_ID: {
        value: 'oidc-client-staging-b2c3d4e5-f6a7-8901-bcde-f12345678901',
        isSensitive: false,
        updatedAt: '2025-12-01T08:00:00.000Z',
      },
      API_GATEWAY_URL: {
        value: 'https://staging-eu.openheaders.io:8443/v2',
        isSensitive: false,
        updatedAt: '2025-12-01T08:00:00.000Z',
      },
    }),
    makeEnv('env-prod', 'Production', {
      OAUTH2_CLIENT_ID: {
        value: 'oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012',
        isSensitive: false,
        updatedAt: '2026-01-10T16:30:00.000Z',
      },
      OAUTH2_CLIENT_SECRET: {
        value: 'sk_prod_9hF60KrOalZGdumwW4cgt0hi',
        isSensitive: true,
        updatedAt: '2026-01-10T16:30:00.000Z',
      },
      REDIS_URL: {
        value: 'rediss://default:r3d!s_p@ss@redis.openheaders.io:6380/0',
        isSensitive: true,
        updatedAt: '2026-01-10T16:30:00.000Z',
      },
    }),
    makeEnv('env-qa', 'QA — Empty', {}),
  ];
}

describe('EnvironmentVariableManager', () => {
  let manager: InstanceType<typeof EnvironmentVariableManager>;

  beforeEach(() => {
    manager = new EnvironmentVariableManager();
  });

  // ========================================================================
  // getAllVariables
  // ========================================================================
  describe('getAllVariables', () => {
    it('returns all variable values for enterprise Default environment', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.getAllVariables(envs, 'env-default');
      expect(result).toEqual({
        OAUTH2_CLIENT_ID: 'oidc-client-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        OAUTH2_CLIENT_SECRET: 'ohk_live_4eC39HqLyjWDarjtT1zdp7dc',
        API_GATEWAY_URL: 'https://gateway.openheaders.io:8443/v2',
        DATABASE_CONNECTION_STRING:
          'postgresql://admin:P@ss=w0rd&special@db.openheaders.internal:5432/production?sslmode=require',
      });
    });

    it('returns variables from Production with special chars in values', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.getAllVariables(envs, 'env-prod');
      expect(result).toEqual({
        OAUTH2_CLIENT_ID: 'oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012',
        OAUTH2_CLIENT_SECRET: 'sk_prod_9hF60KrOalZGdumwW4cgt0hi',
        REDIS_URL: 'rediss://default:r3d!s_p@ss@redis.openheaders.io:6380/0',
      });
    });

    it('returns empty object for non-existent environment', () => {
      const result = manager.getAllVariables([], 'non-existent');
      expect(result).toEqual({});
    });

    it('returns empty object when activeEnvironmentId is null', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.getAllVariables(envs, null);
      expect(result).toEqual({});
    });

    it('returns empty object for empty environment', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.getAllVariables(envs, 'env-qa');
      expect(result).toEqual({});
    });

    it('handles environment name with special characters (em dash, spaces)', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.getAllVariables(envs, 'env-staging');
      expect(result).toEqual({
        OAUTH2_CLIENT_ID: 'oidc-client-staging-b2c3d4e5-f6a7-8901-bcde-f12345678901',
        API_GATEWAY_URL: 'https://staging-eu.openheaders.io:8443/v2',
      });
    });
  });

  // ========================================================================
  // getVariableCount
  // ========================================================================
  describe('getVariableCount', () => {
    it('returns correct count for populated environment', () => {
      const envs = makeEnterpriseEnvs();
      expect(manager.getVariableCount(envs, 'env-default')).toBe(4);
      expect(manager.getVariableCount(envs, 'env-prod')).toBe(3);
      expect(manager.getVariableCount(envs, 'env-staging')).toBe(2);
    });

    it('returns 0 for empty environment', () => {
      const envs = makeEnterpriseEnvs();
      expect(manager.getVariableCount(envs, 'env-qa')).toBe(0);
    });

    it('returns 0 for non-existent environment', () => {
      expect(manager.getVariableCount([], 'missing')).toBe(0);
    });
  });

  // ========================================================================
  // exportEnvironment
  // ========================================================================
  describe('exportEnvironment', () => {
    it('exports as JSON by default with full variable details', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.exportEnvironment(envs, 'env-prod');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({
        OAUTH2_CLIENT_ID: {
          value: 'oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012',
          isSensitive: false,
          updatedAt: '2026-01-10T16:30:00.000Z',
        },
        OAUTH2_CLIENT_SECRET: {
          value: 'sk_prod_9hF60KrOalZGdumwW4cgt0hi',
          isSensitive: true,
          updatedAt: '2026-01-10T16:30:00.000Z',
        },
        REDIS_URL: {
          value: 'rediss://default:r3d!s_p@ss@redis.openheaders.io:6380/0',
          isSensitive: true,
          updatedAt: '2026-01-10T16:30:00.000Z',
        },
      });
    });

    it('exports as .env format preserving special characters', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.exportEnvironment(envs, 'env-default', 'env');
      const lines = result.split('\n');
      expect(lines).toContain('OAUTH2_CLIENT_ID=oidc-client-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(lines).toContain('API_GATEWAY_URL=https://gateway.openheaders.io:8443/v2');
      expect(lines).toHaveLength(4);
    });

    it('exports as shell format with quoted values', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.exportEnvironment(envs, 'env-staging', 'shell');
      expect(result).toContain('export OAUTH2_CLIENT_ID="oidc-client-staging-b2c3d4e5-f6a7-8901-bcde-f12345678901"');
      expect(result).toContain('export API_GATEWAY_URL="https://staging-eu.openheaders.io:8443/v2"');
    });

    it('throws on non-existent environment', () => {
      expect(() => manager.exportEnvironment([], 'missing')).toThrow('does not exist');
    });

    it('throws on unsupported format', () => {
      const envs = makeEnterpriseEnvs();
      expect(() => manager.exportEnvironment(envs, 'env-default', 'xml')).toThrow('Unsupported export format');
    });

    it('handles empty environment export as empty string', () => {
      const envs = makeEnterpriseEnvs();
      const result = manager.exportEnvironment(envs, 'env-qa', 'env');
      expect(result).toBe('');
    });
  });

  // ========================================================================
  // importEnvironment
  // ========================================================================
  describe('importEnvironment', () => {
    it('imports JSON with full variable objects preserving all fields', () => {
      const data = JSON.stringify({
        OAUTH2_TOKEN: {
          value: 'Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig',
          isSensitive: true,
          updatedAt: '2026-01-15T10:00:00.000Z',
        },
        ENDPOINT: { value: 'https://api.openheaders.io/v2', isSensitive: false },
      });
      const result = manager.importEnvironment(data, 'json');
      expect(result.OAUTH2_TOKEN).toEqual({
        value: 'Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig',
        isSensitive: true,
        updatedAt: '2026-01-15T10:00:00.000Z',
      });
      expect(result.ENDPOINT.isSensitive).toBe(false);
    });

    it('imports .env format with special characters', () => {
      const data = [
        '# OpenHeaders production config',
        'DATABASE_URL=postgresql://admin:P@ss=w0rd&special@db.openheaders.io:5432/prod',
        'REDIS_URL=rediss://default:r3d!s@redis.openheaders.io:6380/0',
        '',
        'STRIPE_KEY=ohk_live_4eC39HqLyjWDarjtT1zdp7dc',
      ].join('\n');
      const result = manager.importEnvironment(data, 'env');
      expect(result.DATABASE_URL.value).toBe('postgresql://admin:P@ss=w0rd&special@db.openheaders.io:5432/prod');
      expect(result.REDIS_URL.value).toBe('rediss://default:r3d!s@redis.openheaders.io:6380/0');
      expect(result.STRIPE_KEY.value).toBe('ohk_live_4eC39HqLyjWDarjtT1zdp7dc');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('throws on unsupported format', () => {
      expect(() => manager.importEnvironment('data', 'xml')).toThrow('Unsupported import format');
    });
  });
});
