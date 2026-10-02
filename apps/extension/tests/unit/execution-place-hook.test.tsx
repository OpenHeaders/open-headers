/**
 * useExecutionPlace reads this device's own server switch (Settings ›
 * API Requests › Run requests on a server) and hands it to the pure
 * reader — off withholds the workspace's server from the resolution,
 * the target and the roster; on leaves the S8 model untouched.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@openheaders/ui/workbench/settings/schema/requests';

const h = vi.hoisted(() => ({
  serverAllowed: true,
  server: { backendId: 'backend-1', name: 'Acme', connected: true } as {
    backendId: string;
    name: string | null;
    connected: boolean;
  } | null,
}));

vi.mock('@openheaders/ui/workbench/settings/hooks', () => ({
  useSettingValue: (key: string) => (key === 'requests.allowServerExecution' ? h.serverAllowed : undefined),
}));

vi.mock('@openheaders/ui/workbench/execution-place/useWorkspaceServer', () => ({
  useWorkspaceServer: () => h.server,
  useEditingScopeOrgId: () => 'org-acme',
}));

vi.mock('@openheaders/ui/shared/status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/status')>();
  return { ...actual, useDesktopCompanion: () => ({ state: 'not-installed', launchable: false }) };
});

vi.mock('@openheaders/ui/shared/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/backend')>();
  return { ...actual, useBackends: () => [] };
});

import { useExecutionPlace } from '@openheaders/ui/workbench/execution-place/useExecutionPlace';

beforeEach(() => {
  setCurrentHost('extension');
  h.serverAllowed = true;
  h.server = { backendId: 'backend-1', name: 'Acme', connected: true };
  registerCapability('requestRuntime', () => 'browser');
  registerCapability('delegatedGrpcDispatch', () => true);
  registerCapability('delegatedRequestDispatch', () => true);
  registerCapability('delegatedSessionDispatch', () => true);
  registerCapability('wsPageSession', () => true);
  registerCapability('mqttPageSession', () => true);
});

afterEach(() => {
  for (const name of [
    'requestRuntime',
    'delegatedGrpcDispatch',
    'delegatedRequestDispatch',
    'delegatedSessionDispatch',
    'wsPageSession',
    'mqttPageSession',
  ] as const) {
    unregisterCapability(name);
  }
});

describe('useExecutionPlace — the server switch', () => {
  it('on: a gRPC invoke resolves to the connected server with its record as the target', () => {
    const { result } = renderHook(() => useExecutionPlace({ kind: 'grpc' }));
    expect(result.current).toMatchObject({
      place: 'workspace-server',
      placeName: 'Acme',
      state: 'ready',
      reason: { kind: 'delegated', role: 'workspace-server', knobs: [], secretManagers: 0 },
      target: { backendId: 'backend-1' },
    });
    expect(result.current.roster.find((row) => row.role === 'workspace-server')?.available).toBe(true);
  });

  it('off: the same invoke needs the desktop app, names no target, and the Server row says why', () => {
    h.serverAllowed = false;
    const { result } = renderHook(() => useExecutionPlace({ kind: 'grpc' }));
    expect(result.current).toMatchObject({
      place: 'desktop-app',
      state: 'needs-companion',
      reason: { kind: 'companion-required' },
      target: null,
    });
    expect(result.current.roster.find((row) => row.role === 'workspace-server')).toEqual({
      role: 'workspace-server',
      available: false,
      reason: 'server-off',
      cta: null,
    });
    const http = renderHook(() => useExecutionPlace({ kind: 'http', preference: 'workspace-server' }));
    expect(http.result.current).toMatchObject({ state: 'unsupported', reason: { kind: 'server-off' }, target: null });
  });
});
