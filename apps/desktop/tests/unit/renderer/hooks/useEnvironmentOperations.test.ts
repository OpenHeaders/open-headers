// @vitest-environment jsdom
/**
 * Tests for useEnvironmentOperations hook — validates CRUD, switch, clone, and waitForEnvironments.
 */

import type { Environment } from '@openheaders/core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/utils/error-handling/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockShowMessage = vi.fn();
vi.mock('@/renderer/utils/ui/messageUtil', () => ({
  showMessage: (...args: unknown[]) => mockShowMessage(...args),
}));

const mockCreateEnvironment = vi.fn();
const mockUpdateEnvironment = vi.fn();
const mockDeleteEnvironment = vi.fn();
const mockSwitchEnvironment = vi.fn();
const mockBatchSetVariables = vi.fn();
const mockWaitForReady = vi.fn();

const mockEnvironments: Environment[] = [
  {
    id: 'env-default',
    name: 'Default',
    variables: {
      OAUTH2_CLIENT_ID: { value: 'oidc-client-a1b2c3d4-e5f6-7890-abcd-ef1234567890', isSensitive: false },
      API_GATEWAY_URL: { value: 'https://gateway.openheaders.io:8443/v2', isSensitive: false },
    },
  },
  {
    id: 'env-staging',
    name: 'Staging — EU Region',
    variables: {
      OAUTH2_CLIENT_ID: { value: 'oidc-client-staging-b2c3d4e5-f6a7-8901-bcde-f12345678901', isSensitive: false },
      OAUTH2_CLIENT_SECRET: { value: 'ohk_test_7fD48IqMzkXEbskuU2aer8fg', isSensitive: true },
      API_GATEWAY_URL: { value: 'https://staging-eu.openheaders.io:8443/v2', isSensitive: false },
    },
  },
  {
    id: 'env-prod',
    name: 'Production',
    variables: {
      OAUTH2_CLIENT_SECRET: { value: 'sk_prod_9hF60KrOalZGdumwW4cgt0hi', isSensitive: true },
      DATABASE_CONNECTION_STRING: {
        value: 'postgresql://prod_user:Pr0d$ecret!@db.openheaders.io:5432/production',
        isSensitive: true,
      },
    },
  },
];

vi.mock('@/renderer/hooks/environment/useEnvironmentCore', () => ({
  useEnvironmentCore: () => ({
    service: {
      createEnvironment: mockCreateEnvironment,
      updateEnvironment: mockUpdateEnvironment,
      deleteEnvironment: mockDeleteEnvironment,
      switchEnvironment: mockSwitchEnvironment,
      batchSetVariablesInEnvironment: mockBatchSetVariables,
      waitForReady: mockWaitForReady,
    },
    environments: mockEnvironments,
    activeEnvironment: 'env-default',
  }),
}));

import { useEnvironmentOperations } from '@/renderer/hooks/environment/useEnvironmentOperations';

describe('useEnvironmentOperations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockShowMessage.mockClear();
    mockCreateEnvironment
      .mockReset()
      .mockResolvedValue({ id: 'env-new', name: 'DR — Disaster Recovery', variables: {} });
    mockUpdateEnvironment.mockReset().mockResolvedValue(undefined);
    mockDeleteEnvironment.mockReset().mockResolvedValue(undefined);
    mockSwitchEnvironment.mockReset().mockResolvedValue(undefined);
    mockBatchSetVariables.mockReset().mockResolvedValue(undefined);
    mockWaitForReady.mockReset().mockResolvedValue(true);
  });

  it('returns environments and active environment', () => {
    const { result } = renderHook(() => useEnvironmentOperations());
    expect(result.current.environments).toEqual(mockEnvironments);
    expect(result.current.activeEnvironment).toBe('env-default');
  });

  describe('createEnvironment', () => {
    it('creates enterprise environment', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let created: Environment | null = null;
      await act(async () => {
        created = await result.current.createEnvironment({ name: 'DR — Disaster Recovery' });
      });

      expect(created).toBeTruthy();
      expect(mockCreateEnvironment).toHaveBeenCalledWith({ name: 'DR — Disaster Recovery' });
      expect(mockShowMessage).not.toHaveBeenCalled();
    });

    it('returns null on error with descriptive message', async () => {
      mockCreateEnvironment.mockRejectedValue(new Error("Environment 'Default' already exists"));

      const { result } = renderHook(() => useEnvironmentOperations());

      let created: Environment | null = { id: 'x', name: 'x', variables: {} };
      await act(async () => {
        created = await result.current.createEnvironment({ name: 'Default' });
      });

      expect(created).toBeNull();
      expect(mockShowMessage).toHaveBeenCalledWith('error', "Environment 'Default' already exists");
    });
  });

  describe('updateEnvironment', () => {
    it('renames environment', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let updated = false;
      await act(async () => {
        updated = await result.current.updateEnvironment('env-staging', { name: 'Staging — US Region' });
      });

      expect(updated).toBe(true);
      expect(mockUpdateEnvironment).toHaveBeenCalledWith('env-staging', { name: 'Staging — US Region' });
    });

    it('shows error on failure', async () => {
      mockUpdateEnvironment.mockRejectedValue(new Error("Environment 'Default' already exists"));

      const { result } = renderHook(() => useEnvironmentOperations());

      let updated = true;
      await act(async () => {
        updated = await result.current.updateEnvironment('env-staging', { name: 'Default' });
      });

      expect(updated).toBe(false);
      expect(mockShowMessage).toHaveBeenCalledWith('error', "Environment 'Default' already exists");
    });
  });

  describe('deleteEnvironment', () => {
    it('deletes environment', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let deleted = false;
      await act(async () => {
        deleted = await result.current.deleteEnvironment('env-staging');
      });

      expect(deleted).toBe(true);
      expect(mockDeleteEnvironment).toHaveBeenCalledWith('env-staging');
      expect(mockShowMessage).not.toHaveBeenCalled();
    });
  });

  describe('switchEnvironment', () => {
    it('switches to enterprise environment', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let switched = false;
      await act(async () => {
        switched = await result.current.switchEnvironment('env-prod');
      });

      expect(switched).toBe(true);
      expect(mockSwitchEnvironment).toHaveBeenCalledWith('env-prod');
      expect(mockShowMessage).not.toHaveBeenCalled();
    });

    it('switches to null (no environment)', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let switched = false;
      await act(async () => {
        switched = await result.current.switchEnvironment(null);
      });

      expect(switched).toBe(true);
      expect(mockSwitchEnvironment).toHaveBeenCalledWith(null);
      expect(mockShowMessage).not.toHaveBeenCalled();
    });
  });

  describe('cloneEnvironment', () => {
    it('clones Staging environment with all 3 variables', async () => {
      mockCreateEnvironment.mockResolvedValue({
        id: 'env-clone',
        name: 'Staging-Copy',
        variables: {},
        collectionId: undefined,
        folderId: undefined,
      });

      const { result } = renderHook(() => useEnvironmentOperations());

      let cloned = false;
      await act(async () => {
        cloned = await result.current.cloneEnvironment('env-staging', 'Staging-Copy');
      });

      expect(cloned).toBe(true);
      expect(mockCreateEnvironment).toHaveBeenCalledWith({
        name: 'Staging-Copy',
        collectionId: undefined,
        folderId: undefined,
      });
      expect(mockBatchSetVariables).toHaveBeenCalledWith('env-clone', [
        {
          name: 'OAUTH2_CLIENT_ID',
          value: 'oidc-client-staging-b2c3d4e5-f6a7-8901-bcde-f12345678901',
          isSensitive: false,
        },
        { name: 'OAUTH2_CLIENT_SECRET', value: 'ohk_test_7fD48IqMzkXEbskuU2aer8fg', isSensitive: true },
        { name: 'API_GATEWAY_URL', value: 'https://staging-eu.openheaders.io:8443/v2', isSensitive: false },
      ]);
    });

    it('fails if source environment does not exist', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let cloned = true;
      await act(async () => {
        cloned = await result.current.cloneEnvironment('non-existent', 'Copy');
      });

      expect(cloned).toBe(false);
      expect(mockShowMessage).toHaveBeenCalledWith('error', expect.stringContaining('does not exist'));
    });
  });

  describe('waitForEnvironments', () => {
    it('returns true when environments are ready', async () => {
      const { result } = renderHook(() => useEnvironmentOperations());

      let ready = false;
      await act(async () => {
        ready = await result.current.waitForEnvironments();
      });

      expect(ready).toBe(true);
      expect(mockWaitForReady).toHaveBeenCalledWith(5000);
    });
  });
});
