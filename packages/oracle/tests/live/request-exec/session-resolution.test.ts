/**
 * Session resolution — the oracle-side resolution a live session
 * retains, over the REAL resolver with the entity stores mocked: a
 * `{{vault.otp}}` resolve reports the code to the batch's tracker the
 * caller hands (none handed, none reported); the TOTP plane hands a
 * tracker only when the vault holds a TOTP entry, gates through the
 * cooldown store under the pinned workspace (else the runtime-Active
 * one, read only when a code is in play) and records every row; and
 * the pre-pass RE-MINTS the registry when a batch names a TOTP entry —
 * a rider two windows after Connect resolves the code of ITS moment,
 * while a batch naming none leaves the registry as it was.
 */

import type { Vault } from '@openheaders/core/types';
import type { UnresolvedReferences } from '@openheaders/core/variables';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { treeOracleFrom } from './tree-oracle';

const vault = vi.fn<() => Vault>(() => ({ schemaVersion: 5, secrets: [] }));
const checkCooldown = vi.fn(() => ({ inCooldown: false }) as { inCooldown: boolean; remainingSeconds?: number });
const recordUsage = vi.fn();

vi.mock('../../../src/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => [],
  getEnvironmentsForWorkspace: () => [],
  getVault: () => vault(),
  getVaultForWorkspace: () => vault(),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
  getWorkspaceVariablesForWorkspace: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('../../../src/entity/request-store', () => ({
  getRequest: () => null,
  getRequestInWorkspace: () => null,
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
  getRequestFolders: () => [],
  getRequestFoldersForWorkspace: () => [],
}));
vi.mock('../../../src/sync/service/accessors', () => ({
  getOracleForCurrentWorkspace: () => treeOracleFrom([], []).oracle,
  getOracleForWorkspace: () => treeOracleFrom([], []).oracle,
}));
vi.mock('../../../src/entity/rule-store', () => ({
  getCollections: () => [],
  getCollectionsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/template-store', () => ({
  getTemplateCollections: () => [],
  getTemplateCollectionsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/files-store', () => ({
  getFileBlob: async () => null,
  listFiles: async () => [],
}));
vi.mock('../../../src/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: () => new Map(),
}));
vi.mock('../../../src/entity/totp-cooldown-store', () => ({
  checkCooldown: (...args: unknown[]) => checkCooldown(...(args as [])),
  recordUsage: (...args: unknown[]) => recordUsage(...args),
}));
vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
  peekActiveWorkspaceId: () => 'ws-active',
}));

import { buildOracleSessionResolution } from '../../../src/live/request-exec/session-resolution';
import { createTotpUsageTracker } from '../../../src/live/request-exec/totp-usage';

const REQUEST = { uid: 'ws00001', path: 'requests/suite-col1/probe' };

const totpVault: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'sec00001', kind: 'string', name: 'api_key', value: 'k-1' },
    { uid: 'totp0001', kind: 'totp', name: 'otp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
  ],
};

beforeEach(() => {
  vault.mockReturnValue({ schemaVersion: 5, secrets: [] });
  checkCooldown.mockReset();
  checkCooldown.mockReturnValue({ inCooldown: false });
  recordUsage.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('buildOracleSessionResolution — the TOTP plane', () => {
  it('reports a resolved code to the tracker the caller hands, and nothing without one', async () => {
    vault.mockReturnValue(totpVault);
    const resolution = await buildOracleSessionResolution(REQUEST, { workspaceId: null, environmentId: undefined });
    const unresolved: UnresolvedReferences = new Map();
    const silent = resolution.resolve('otp={{vault.otp}}', unresolved);
    expect(silent).toMatch(/^otp=\d{6}$/);
    expect(unresolved.size).toBe(0);

    const tracker = createTotpUsageTracker(totpVault);
    const loud = resolution.resolve('{{vault.otp}} and {{api_key}}', unresolved, tracker);
    expect(loud).toBe(`${silent.slice('otp='.length)} and k-1`);
    expect(tracker.used).toEqual([{ name: 'otp', code: silent.slice('otp='.length), period: 30 }]);
  });

  it('hands a tracker only when the vault holds a TOTP entry', async () => {
    const none = await buildOracleSessionResolution(REQUEST, { workspaceId: null, environmentId: undefined });
    expect(none.totp.tracker()).toBeNull();
    vault.mockReturnValue(totpVault);
    const some = await buildOracleSessionResolution(REQUEST, { workspaceId: null, environmentId: undefined });
    expect(some.totp.tracker()).not.toBeNull();
  });

  it('gates and records through the cooldown store under the pinned workspace, else the runtime-Active one', async () => {
    vault.mockReturnValue(totpVault);
    const usage = { name: 'otp', code: '123456', period: 30 };
    const pinned = await buildOracleSessionResolution(REQUEST, { workspaceId: 'ws-pinned', environmentId: undefined });
    expect(await pinned.totp.refusal([usage])).toBeNull();
    expect(checkCooldown).toHaveBeenCalledWith('ws-pinned', 'otp', '123456');
    pinned.totp.record([usage]);
    expect(recordUsage).toHaveBeenCalledWith('ws-pinned', 'otp', '123456', 30);

    checkCooldown.mockReturnValue({ inCooldown: true, remainingSeconds: 7 });
    const active = await buildOracleSessionResolution(REQUEST, { workspaceId: null, environmentId: undefined });
    expect(await active.totp.refusal([usage])).toBe("TOTP 'otp' code can't be reused — wait 7s for the next window.");
    expect(checkCooldown).toHaveBeenLastCalledWith('ws-active', 'otp', '123456');

    // An empty batch never reaches the store.
    checkCooldown.mockClear();
    recordUsage.mockClear();
    expect(await active.totp.refusal([])).toBeNull();
    active.totp.record([]);
    expect(checkCooldown).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it('the pre-pass re-mints the registry when the batch names a TOTP entry — the code of the moment, never Connect’s', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));
    vault.mockReturnValue(totpVault);
    const resolution = await buildOracleSessionResolution(REQUEST, { workspaceId: null, environmentId: undefined });
    const unresolved: UnresolvedReferences = new Map();
    const atConnect = resolution.resolve('{{vault.otp}}', unresolved);
    expect(atConnect).toMatch(/^\d{6}$/);

    // Two windows later the retained registry still answers Connect's code…
    vi.setSystemTime(new Date('2026-10-25T10:01:00Z'));
    expect(resolution.resolve('{{vault.otp}}', unresolved)).toBe(atConnect);
    // …a batch naming no TOTP entry leaves it so…
    await resolution.prepare(['{{api_key}}']);
    expect(resolution.resolve('{{vault.otp}}', unresolved)).toBe(atConnect);
    // …and a batch naming one re-mints it (bare or `vault.`-prefixed).
    await resolution.prepare(['hello {{vault.otp}}']);
    const later = resolution.resolve('{{vault.otp}}', unresolved);
    expect(later).toMatch(/^\d{6}$/);
    expect(later).not.toBe(atConnect);

    vi.setSystemTime(new Date('2026-10-25T10:02:00Z'));
    await resolution.prepare(['{{otp}}']);
    const latest = resolution.resolve('{{otp}}', unresolved);
    expect(latest).not.toBe(later);
    expect(unresolved.size).toBe(0);
  });
});
