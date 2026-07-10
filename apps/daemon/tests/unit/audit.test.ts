/**
 * `oh daemon audit` — the sqlite-free half (`audit-format.ts`): filter
 * building with §9.3 actor-email resolution against the real on-disk
 * directory, time-bound parsing (ISO + relative), row formatting with
 * display-at-view-time names, and the never-booted refusal. The
 * sqlite-touching query itself is proven in
 * `@openheaders/oracle-host-node` under the Electron ABI; these tests
 * run under plain Node like every other CLI path.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ensureSyntheticIdentity } from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import type { AuditLogEntry } from '@openheaders/core/types';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFilter, formatLine, parseTimeBound, resolveAuditDbPath } from '../../src/cli/audit-format';
import { addUser } from '../../src/cli/users';
import type { DaemonConfig } from '../../src/config';
import { noCipherYet } from '../../src/no-cipher';

const ORG = '0193a8ff-c000-7000-8000-00000000000a';
const WS = '0193a8ff-c000-7000-8000-000000000001';

const tempDirs: string[] = [];

function makeConfig(): DaemonConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-audit-'));
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
    auditRetentionDays: 90,
    configPath: path.join(dataDir, 'daemon.json'),
  };
}

/** Stand in for the daemon's first boot: seed the synthetic identity. */
async function seedDaemonIdentity(config: DaemonConfig): Promise<void> {
  setHostStorage(
    new FileBackedHostStorage({
      filePath: path.join(config.dataDir, 'storage.json'),
      secretCipher: noCipherYet,
    }),
  );
  await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
}

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: `${ORG}:1`,
    orgId: ORG,
    seq: 1,
    actorUserId: 'user-alice',
    capability: 'workspace.write',
    workspaceId: WS,
    decision: { allow: true },
    occurredAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseTimeBound', () => {
  it('accepts ISO forms and normalizes them', () => {
    expect(parseTimeBound('2026-07-02T00:00:00Z', 'since')).toBe('2026-07-02T00:00:00.000Z');
    expect(parseTimeBound('2026-07-02', 'since')).toBe('2026-07-02T00:00:00.000Z');
  });

  it('resolves relative bounds against now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    expect(parseTimeBound('30m', 'since')).toBe('2026-07-10T11:30:00.000Z');
    expect(parseTimeBound('24h', 'since')).toBe('2026-07-09T12:00:00.000Z');
    expect(parseTimeBound('7d', 'since')).toBe('2026-07-03T12:00:00.000Z');
  });

  it('refuses anything else loudly', () => {
    expect(() => parseTimeBound('yesterday-ish', 'since')).toThrow(/--since/);
  });
});

describe('buildFilter', () => {
  it('maps flags onto the query filter, resolving --actor by email through the directory', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    const alice = await addUser(config, { displayName: 'Alice', email: 'alice@openheaders.io' });
    const filter = await buildFilter(
      config,
      {
        actor: 'alice@openheaders.io',
        capability: 'workspace.write',
        decision: 'deny',
        workspace: WS,
        since: '2026-07-01T00:00:00Z',
        until: '2026-07-03T00:00:00Z',
        limit: '10',
      },
      'desc',
    );
    expect(filter).toEqual({
      order: 'desc',
      actorUserId: alice.user.id,
      capability: 'workspace.write',
      allow: false,
      workspaceId: WS,
      sinceIso: '2026-07-01T00:00:00.000Z',
      untilIso: '2026-07-03T00:00:00.000Z',
      limit: 10,
    });
  });

  it('refuses unknown decisions, bad limits and unknown actors', async () => {
    const config = makeConfig();
    await seedDaemonIdentity(config);
    await expect(buildFilter(config, { decision: 'maybe' }, 'desc')).rejects.toThrow(/--decision/);
    await expect(buildFilter(config, { limit: '-5' }, 'desc')).rejects.toThrow(/--limit/);
    await expect(buildFilter(config, { actor: 'nobody@openheaders.io' }, 'desc')).rejects.toThrow(/no user/);
  });
});

describe('formatLine', () => {
  it('resolves display names at view time and falls back to the raw id', () => {
    const names = new Map([['user-alice', 'Alice']]);
    expect(formatLine(makeEntry(), names)).toBe(
      `2026-07-01T00:00:00.000Z  allow  workspace.write  ws=${WS}  Alice (user-alice)`,
    );
    const { workspaceId: _dropped, ...noWorkspace } = makeEntry({
      actorUserId: 'user-gone',
      decision: { allow: false, reason: 'not-daemon-admin' },
      capability: 'daemon.admin',
    });
    expect(formatLine(noWorkspace, names)).toBe(
      '2026-07-01T00:00:00.000Z  deny(not-daemon-admin)  daemon.admin  user-gone',
    );
  });

  it("labels the HELLO gate's daemon.admission rows as admissions, not enforcement decisions", () => {
    const names = new Map([['user-alice', 'Alice']]);
    const { workspaceId: _a, ...admitted } = makeEntry({ capability: 'daemon.admission' });
    expect(formatLine(admitted, names)).toBe(
      '2026-07-01T00:00:00.000Z  admission  daemon.admission  Alice (user-alice)',
    );
    const { workspaceId: _b, ...refused } = makeEntry({
      actorUserId: 'user-gone',
      capability: 'daemon.admission',
      decision: { allow: false, reason: 'auth-required' },
    });
    expect(formatLine(refused, names)).toBe(
      '2026-07-01T00:00:00.000Z  admission-refused(auth-required)  daemon.admission  user-gone',
    );
  });

  it("labels the claims-mapping's daemon.sso-* rows as sso-grant / sso-revoke", () => {
    const names = new Map([['user-alice', 'Alice']]);
    expect(formatLine(makeEntry({ capability: 'daemon.sso-grant' }), names)).toBe(
      `2026-07-01T00:00:00.000Z  sso-grant  daemon.sso-grant  ws=${WS}  Alice (user-alice)`,
    );
    expect(formatLine(makeEntry({ capability: 'daemon.sso-revoke' }), names)).toBe(
      `2026-07-01T00:00:00.000Z  sso-revoke  daemon.sso-revoke  ws=${WS}  Alice (user-alice)`,
    );
  });
});

describe('resolveAuditDbPath', () => {
  it('refuses a data dir the daemon never booted against, and resolves an existing oracle.db', () => {
    const config = makeConfig();
    expect(() => resolveAuditDbPath(config)).toThrow(/never booted/);
    fs.writeFileSync(path.join(config.dataDir, 'oracle.db'), '');
    expect(resolveAuditDbPath(config)).toBe(path.join(config.dataDir, 'oracle.db'));
  });
});
