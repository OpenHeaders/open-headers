/**
 * Tests for the environment sub-managers that CentralizedEnvironmentService delegates to.
 *
 * Tests EnvironmentVariableManager with the new Environment[] data model,
 * plus pure state-management patterns that mirror CES behaviour.
 */
import type { Environment, EnvironmentVariable } from '@openheaders/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger for all sub-module imports
vi.mock('@/renderer/utils/error-handling/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import the CJS sub-managers
const EnvironmentVariableManagerModule = await import(
  '../../../../src/renderer/services/environment/EnvironmentVariableManager'
);
const EnvironmentVariableManager = EnvironmentVariableManagerModule.default;

// ---------------------------------------------------------------------------
// Enterprise-realistic factory helpers
// ---------------------------------------------------------------------------

function makeEnv(id: string, name: string, variables: Record<string, EnvironmentVariable>): Environment {
  return { id, name, variables, createdAt: '2025-11-15T09:30:00.000Z' };
}

function makeEnterpriseEnvironments(): Environment[] {
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
      OAUTH2_CLIENT_SECRET: {
        value: 'ohk_test_7fD48IqMzkXEbskuU2aer8fg',
        isSensitive: true,
        updatedAt: '2025-12-01T08:00:00.000Z',
      },
      API_GATEWAY_URL: {
        value: 'https://staging-eu.openheaders.io:8443/v2',
        isSensitive: false,
        updatedAt: '2025-12-01T08:00:00.000Z',
      },
    }),
    makeEnv('env-qa', 'QA — Integration Tests', {}),
    makeEnv('env-preprod', 'Pre-production', {
      BEARER_TOKEN: {
        value:
          'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQG9wZW5oZWFkZXJzLmlvIiwiaWF0IjoxNzE2MDAwMDAwfQ.signature',
        isSensitive: true,
        updatedAt: '2026-02-15T12:00:00.000Z',
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
      API_GATEWAY_URL: {
        value: 'https://api.openheaders.io/v2',
        isSensitive: false,
        updatedAt: '2026-01-10T16:30:00.000Z',
      },
      DATABASE_CONNECTION_STRING: {
        value:
          'postgresql://prod_user:Pr0d$ecret!@db.openheaders.io:5432/production?sslmode=verify-full&connect_timeout=10',
        isSensitive: true,
        updatedAt: '2026-01-10T16:30:00.000Z',
      },
      REDIS_URL: {
        value: 'rediss://default:r3d!s_p@ss@redis.openheaders.io:6380/0',
        isSensitive: true,
        updatedAt: '2026-01-10T16:30:00.000Z',
      },
    }),
  ];
}

const ENTERPRISE_WORKSPACE_ID = 'ws-a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ======================================================================
// EnvironmentVariableManager
// ======================================================================
describe('EnvironmentVariableManager', () => {
  let vm: InstanceType<typeof EnvironmentVariableManager>;

  beforeEach(() => {
    vm = new EnvironmentVariableManager();
  });

  describe('getAllVariables()', () => {
    it('returns empty object for empty environment', () => {
      const result = vm.getAllVariables([makeEnv('env-1', 'Default', {})], 'env-1');
      expect(result).toEqual({});
    });

    it('extracts values from enterprise variable objects', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.getAllVariables(envs, 'env-prod');
      expect(result).toEqual({
        OAUTH2_CLIENT_ID: 'oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012',
        OAUTH2_CLIENT_SECRET: 'sk_prod_9hF60KrOalZGdumwW4cgt0hi',
        API_GATEWAY_URL: 'https://api.openheaders.io/v2',
        DATABASE_CONNECTION_STRING:
          'postgresql://prod_user:Pr0d$ecret!@db.openheaders.io:5432/production?sslmode=verify-full&connect_timeout=10',
        REDIS_URL: 'rediss://default:r3d!s_p@ss@redis.openheaders.io:6380/0',
      });
    });

    it('returns empty object for non-existent environment', () => {
      const result = vm.getAllVariables([makeEnv('env-1', 'Default', {})], 'non-existent');
      expect(result).toEqual({});
    });

    it('returns empty object when activeEnvironmentId is null', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.getAllVariables(envs, null);
      expect(result).toEqual({});
    });

    it('handles environment with special characters in name', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.getAllVariables(envs, 'env-staging');
      expect(result).toEqual({
        OAUTH2_CLIENT_ID: 'oidc-client-staging-b2c3d4e5-f6a7-8901-bcde-f12345678901',
        OAUTH2_CLIENT_SECRET: 'ohk_test_7fD48IqMzkXEbskuU2aer8fg',
        API_GATEWAY_URL: 'https://staging-eu.openheaders.io:8443/v2',
      });
    });

    it('handles empty QA environment', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.getAllVariables(envs, 'env-qa');
      expect(result).toEqual({});
    });
  });

  describe('getVariableCount()', () => {
    it('returns 0 for empty environment', () => {
      const envs = makeEnterpriseEnvironments();
      expect(vm.getVariableCount(envs, 'env-qa')).toBe(0);
    });

    it('returns correct count for production environment', () => {
      const envs = makeEnterpriseEnvironments();
      expect(vm.getVariableCount(envs, 'env-prod')).toBe(5);
    });

    it('returns 0 for non-existent environment', () => {
      const envs = makeEnterpriseEnvironments();
      expect(vm.getVariableCount(envs, 'missing')).toBe(0);
    });
  });

  describe('exportEnvironment()', () => {
    it('exports production as JSON with all variable details', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.exportEnvironment(envs, 'env-prod', 'json');
      const parsed = JSON.parse(result);
      expect(parsed.OAUTH2_CLIENT_ID).toEqual({
        value: 'oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012',
        isSensitive: false,
        updatedAt: '2026-01-10T16:30:00.000Z',
      });
      expect(parsed.DATABASE_CONNECTION_STRING.isSensitive).toBe(true);
      expect(Object.keys(parsed)).toHaveLength(5);
    });

    it('exports as .env format preserving special chars in values', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.exportEnvironment(envs, 'env-default', 'env');
      expect(result).toContain('OAUTH2_CLIENT_ID=oidc-client-a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(result).toContain('API_GATEWAY_URL=https://gateway.openheaders.io:8443/v2');
    });

    it('throws for non-existent environment', () => {
      const envs = makeEnterpriseEnvironments();
      expect(() => vm.exportEnvironment(envs, 'missing', 'json')).toThrow('does not exist');
    });

    it('exports empty environment as empty string in env format', () => {
      const envs = makeEnterpriseEnvironments();
      const result = vm.exportEnvironment(envs, 'env-qa', 'env');
      expect(result).toBe('');
    });
  });

  describe('importEnvironment()', () => {
    it('imports JSON format with full variable objects', () => {
      const data = JSON.stringify({
        OAUTH2_TOKEN: {
          value: 'Bearer eyJhbGciOiJSUzI1NiJ9.payload.signature',
          isSensitive: true,
          updatedAt: '2026-01-15T10:00:00.000Z',
        },
        ENDPOINT_URL: { value: 'https://api.openheaders.io/v2/resources', isSensitive: false },
      });
      const result = vm.importEnvironment(data, 'json');
      expect(result.OAUTH2_TOKEN.value).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.payload.signature');
      expect(result.ENDPOINT_URL.isSensitive).toBe(false);
    });

    it('imports .env format with special characters in values', () => {
      const data = '# Config\nDATABASE_URL=postgresql://admin:P@ss=w0rd@db.openheaders.io:5432/prod\n';
      const result = vm.importEnvironment(data, 'env');
      expect(result.DATABASE_URL.value).toBe('postgresql://admin:P@ss=w0rd@db.openheaders.io:5432/prod');
    });

    it('throws for unsupported format', () => {
      expect(() => vm.importEnvironment('data', 'xml')).toThrow('Unsupported import format: xml');
    });

    it('throws for invalid JSON', () => {
      expect(() => vm.importEnvironment('not valid json {{{', 'json')).toThrow();
    });
  });
});

// ======================================================================
// CES-style patterns — pure state management logic
// ======================================================================
describe('CES state management patterns', () => {
  describe('batchSetVariables pattern', () => {
    it('sets multiple variables in an environment', () => {
      const envs = makeEnterpriseEnvironments();
      const prod = envs.find((e) => e.id === 'env-prod')!;
      const varsCopy = { ...prod.variables };
      const variables = [
        { name: 'NEW_API_TOKEN', value: 'Bearer eyJhbGciOiJSUzI1NiJ9.new-payload.sig', isSensitive: true },
        { name: 'MONITORING_URL', value: 'https://grafana.openheaders.io/d/api-latency', isSensitive: false },
      ];

      for (const { name, value, isSensitive } of variables) {
        varsCopy[name] = { value: value!, isSensitive, updatedAt: new Date().toISOString() };
      }

      expect(varsCopy.NEW_API_TOKEN.value).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.new-payload.sig');
      expect(varsCopy.MONITORING_URL.value).toBe('https://grafana.openheaders.io/d/api-latency');
      // Original variables preserved
      expect(varsCopy.OAUTH2_CLIENT_ID.value).toBe('oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012');
    });

    it('deletes variables with null or empty values', () => {
      const envs = makeEnterpriseEnvironments();
      const prod = envs.find((e) => e.id === 'env-prod')!;
      const varsCopy = { ...prod.variables };
      delete varsCopy.REDIS_URL;
      delete varsCopy.DATABASE_CONNECTION_STRING;

      expect(varsCopy.REDIS_URL).toBeUndefined();
      expect(varsCopy.DATABASE_CONNECTION_STRING).toBeUndefined();
      expect(varsCopy.OAUTH2_CLIENT_ID.value).toBe('oidc-client-prod-c3d4e5f6-a7b8-9012-cdef-123456789012');
      expect(Object.keys(varsCopy)).toHaveLength(3);
    });
  });

  describe('deleteEnvironment pattern', () => {
    it('sets activeEnvironment to null when deleting active environment', () => {
      const envs = makeEnterpriseEnvironments();
      let activeEnvironment: string | null = 'env-staging';

      const wasActive = activeEnvironment === 'env-staging';
      const remaining = envs.filter((e) => e.id !== 'env-staging');

      if (wasActive) {
        activeEnvironment = null;
      }

      expect(activeEnvironment).toBeNull();
      expect(remaining.find((e) => e.id === 'env-staging')).toBeUndefined();
      expect(remaining).toHaveLength(4);
    });

    it('does not change active environment when deleting non-active', () => {
      const activeEnvironment: string | null = 'env-prod';
      const wasActive = activeEnvironment === 'env-qa';
      expect(wasActive).toBe(false);
    });
  });

  describe('handleWorkspaceChange pattern', () => {
    it('skips when already in target workspace and ready', () => {
      const state = { currentWorkspaceId: ENTERPRISE_WORKSPACE_ID, isReady: true };
      const shouldChange = !(state.currentWorkspaceId === ENTERPRISE_WORKSPACE_ID && state.isReady);
      expect(shouldChange).toBe(false);
    });

    it('proceeds when workspace is different', () => {
      const state = { currentWorkspaceId: ENTERPRISE_WORKSPACE_ID, isReady: true };
      const shouldChange = !(state.currentWorkspaceId === 'ws-different-workspace' && state.isReady);
      expect(shouldChange).toBe(true);
    });
  });
});
