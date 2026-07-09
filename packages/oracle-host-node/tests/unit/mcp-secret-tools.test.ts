/**
 * Coverage for `variables_reveal_secret` — the sole exception to the
 * vault masking contract. The vault hydrates through the guarded
 * storage read, so the harness overlays `getValidatedGuarded` on the
 * shared storage fake: an `ok` payload seeds real secrets, an
 * `undecryptable` result exercises the locked-out state (which must
 * read as "re-entry required", never "no such secret"). Handlers are
 * called directly — tier gating has its own leg in
 * `mcp-registry-policy.test.ts`.
 */

import { setHostLogger } from '@openheaders/core/logger';
import type { GuardedRead } from '@openheaders/core/storage';
import { setHostStorage, wsKeys } from '@openheaders/core/storage';
import type { Vault } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { afterEach, describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { createSecretToolDefinitions } from '../../src/mcp/tools/secret-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-mcp-secrets';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

const VAULT: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'vs-1', kind: 'string', name: 'apiKey', value: 'sk-live-abc123' },
    { uid: 'vs-2', kind: 'totp', name: 'ghOtp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
  ],
};

const tool: McpToolDefinition = createSecretToolDefinitions()[0];

function call(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

/** Boot the service with the vault slot hydrating to `guarded`. */
async function boot(guarded: GuardedRead<Vault>): Promise<void> {
  setHostLogger(consoleLogger);
  const fake = createHostStorageFake();
  setHostStorage(
    Object.assign(fake, {
      getValidatedGuarded: async (spec: { key: string }): Promise<GuardedRead<unknown>> =>
        spec.key === wsKeys(wsId).vault.key ? guarded : { status: 'absent' },
    }),
  );
  __initSyncServiceForTests(wsId);
  // An empty apply awaits the service's hydration gate, so the vault
  // cache has settled (seeded or locked) before any assertion reads it.
  await applySyncRequest({
    type: 'oh.sync.apply',
    batch: { batchId: 'hydration-gate', mutations: [] },
    sideEffects: [],
  });
}

afterEach(() => {
  disposeSyncService();
});

describe('variables_reveal_secret', () => {
  it('reveals a string vault secret by name', async () => {
    await boot({ status: 'ok', value: VAULT });

    const result = await call({ name: 'apiKey' });

    expect(result.secret).toEqual({ name: 'apiKey', kind: 'string', value: 'sk-live-abc123' });
  });

  it('never reveals a TOTP seed, pointing at {{vault.*}} instead', async () => {
    await boot({ status: 'ok', value: VAULT });

    await expect(call({ name: 'ghOtp' })).rejects.toThrow(/never revealed.*\{\{vault\.ghOtp\}\}/);
  });

  it('errors on an unknown secret name', async () => {
    await boot({ status: 'ok', value: VAULT });

    await expect(call({ name: 'ghost' })).rejects.toThrow(/no vault secret named 'ghost'.*variables_list/);
  });

  it('reports a locked vault as re-entry required, not as missing secrets', async () => {
    await boot({ status: 'undecryptable' });

    await expect(call({ name: 'apiKey' })).rejects.toThrow(/locked.*re-entered in Open Headers/);
  });

  it('declares the secrets tier as operator-only — vault plaintext never crosses to directory users', () => {
    expect(tool.tier).toBe('secrets');
    expect(tool.capability).toBe('daemon.admin');
  });
});
