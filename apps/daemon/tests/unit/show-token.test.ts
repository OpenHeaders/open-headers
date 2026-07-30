/**
 * First-boot token mint (`ohd show-token`) — mints through the
 * real `mintDaemonAuthToken` path against an on-disk `storage.json`:
 * hash-only ledger in the plain bucket, secret surfaced once, join
 * URLs shaped by the configured bind. Deliberately sqlite-free (the
 * CLI never loads the engine).
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mintBootstrapToken } from '../../src/cli/show-token';
import type { DaemonConfig } from '../../src/config';

const tempDirs: string[] = [];

function makeConfig(overrides: Partial<DaemonConfig> = {}): DaemonConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-show-token-'));
  tempDirs.push(dataDir);
  return {
    dataDir,
    bindAddress: '127.0.0.1',
    bindPort: 8137,
    logLevel: 'info',
    trustedProxy: false,
    allowedHosts: [],
    allowInsecureLan: false,
    webRoot: null,
    oidc: null,
    vaultPassphrase: null,
    auditRetentionDays: 90,
    auditForwarding: null,
    licenseFile: null,
    licenseRefresh: true,
    personalSeats: true,
    environmentProxy: null,
    configPath: path.join(dataDir, 'daemon.json'),
    ...overrides,
  };
}

function readLedger(dataDir: string): Array<{ id: string; tokenHash: string; label?: string }> {
  const envelope = JSON.parse(fs.readFileSync(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
    secrets: Record<string, string>;
  };
  expect(envelope.secrets['oh.daemonAuthTokens']).toBeUndefined();
  return (envelope.values['oh.daemonAuthTokens'] ?? []) as Array<{ id: string; tokenHash: string; label?: string }>;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('mintBootstrapToken', () => {
  it('persists only the SHA-256 hash of the surfaced secret', async () => {
    const config = makeConfig();
    const minted = await mintBootstrapToken(config, 'first client');

    expect(minted.secret).toMatch(/^oh_[A-Za-z0-9_-]{40,}$/);
    const ledger = readLedger(config.dataDir);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].id).toBe(minted.tokenId);
    expect(ledger[0].label).toBe('first client');
    expect(ledger[0].tokenHash).toBe(createHash('sha256').update(minted.secret).digest('hex'));
    expect(JSON.stringify(ledger)).not.toContain(minted.secret);
  });

  it('appends to an existing ledger instead of replacing it', async () => {
    const config = makeConfig();
    const first = await mintBootstrapToken(config);
    const second = await mintBootstrapToken(config);

    const ids = readLedger(config.dataDir).map((t) => t.id);
    expect(ids).toEqual([first.tokenId, second.tokenId]);
    expect(first.secret).not.toBe(second.secret);
  });

  it('offers only loopback on a loopback bind, LAN addresses on 0.0.0.0', async () => {
    const loopback = await mintBootstrapToken(makeConfig({ bindPort: 9001 }));
    expect(loopback.joinUrls.map((j) => j.url)).toEqual(['ws://127.0.0.1:9001']);

    const lan = await mintBootstrapToken(makeConfig({ bindAddress: '0.0.0.0', bindPort: 9002 }));
    expect(lan.joinUrls[0].url).toBe('ws://127.0.0.1:9002');
    for (const join of lan.joinUrls) {
      expect(join.url).toBe(`ws://${join.host}:9002`);
    }
  });
});
