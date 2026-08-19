/**
 * License refresh agent — stand-down matrix (no license / offline
 * marker / outside the renewal window / lapsed latch), the exact wire
 * payload, the success swap through the slot (including the distinct
 * refresh audit stamp), refusal-vs-transport handling, and the timer
 * scheduling contract. Injected transport/now/timers throughout — no
 * real network, no real clock.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resetAuditSink, setAuditSink } from '@openheaders/core/identity';
import type { License, LicenseKeyRing } from '@openheaders/core/licensing';
import { generateLicenseSigningKeys, signLicense } from '@openheaders/core/licensing';
import type { DaemonUserRecord } from '@openheaders/core/types';
import {
  type RequestTransport,
  TransportError,
  type TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installLicenseRefreshAgent,
  LICENSE_REFRESH_ENDPOINT,
  type LicenseRefreshAgentHandle,
} from '../../../src/daemon/license-refresh-agent';
import { installLicenseSlot, type LicenseSlotHandle } from '../../../src/daemon/license-slot';

const DAY = 86_400_000;
const KID = 'oh-lic-2026dev';
const NOW = 1_752_000_000_000;
const APP_VERSION = '2026.7.2';

let dir: string;
let filePath: string;
let signer: { ring: LicenseKeyRing; sign(claims: unknown): Promise<string> };
let disposables: Array<{ dispose(): void }>;

interface SendCall {
  url: string;
  method: string;
  body: unknown;
}

function transportResponse(bodyText: string, status: number): TransportResponse {
  return {
    status,
    statusText: '',
    url: LICENSE_REFRESH_ENDPOINT,
    headers: [],
    body: bodyText,
    bodyTruncated: false,
    bodyBytes: bodyText.length,
  };
}

function makeTransport(respond: () => TransportResponse | Error): { calls: SendCall[]; transport: RequestTransport } {
  const calls: SendCall[] = [];
  const transport: RequestTransport = {
    async send(request) {
      calls.push({
        url: request.url,
        method: request.method,
        body: request.body.kind === 'raw' ? JSON.parse(request.body.content) : request.body,
      });
      const result = respond();
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { calls, transport };
}

function makeLicense(overrides: Partial<License> = {}): License {
  return {
    schemaVersion: 1,
    licenseId: 'lic-0001',
    licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
    seats: 25,
    entitlements: [],
    issuedAt: NOW - 30 * DAY,
    validUntil: NOW + 15 * DAY,
    graceDays: 21,
    kid: KID,
    ...overrides,
  };
}

async function makeSlot(): Promise<LicenseSlotHandle> {
  const slot = await installLicenseSlot({
    filePath,
    broadcast: () => undefined,
    ring: signer.ring,
    now: () => NOW,
  });
  disposables.push(slot);
  return slot;
}

function makeAgent(
  slot: LicenseSlotHandle,
  transport: RequestTransport,
  options: {
    timers?: Array<{ ms: number }>;
    now?: () => number;
    listUsers?: () => Promise<readonly DaemonUserRecord[]>;
    replaceArtifact?: (licenseId: string, licenseKey: string) => Promise<number>;
  } = {},
): LicenseRefreshAgentHandle {
  const agent = installLicenseRefreshAgent({
    slot,
    appVersion: APP_VERSION,
    platform: 'testos',
    transport,
    ring: signer.ring,
    ...(options.listUsers ? { listUsers: options.listUsers } : {}),
    ...(options.replaceArtifact ? { replaceArtifact: options.replaceArtifact } : {}),
    now: options.now ?? (() => NOW),
    setTimer: (_fn, ms) => {
      options.timers?.push({ ms });
      return 0 as unknown as NodeJS.Timeout;
    },
    clearTimer: () => undefined,
    random: () => 0.5,
    endpoint: LICENSE_REFRESH_ENDPOINT,
  });
  disposables.push(agent);
  return agent;
}

function makeUserRecord(input: {
  userId: string;
  email: string;
  admission?: { kind: 'personal'; licenseId: string; licenseKey: string };
  deactivatedAt?: number;
}): DaemonUserRecord {
  return {
    user: { id: input.userId, displayName: input.email, homeOrgId: 'org-1', isStandalone: false },
    userIdentity: {
      id: `${input.userId}-identity`,
      userId: input.userId,
      kind: 'email',
      value: input.email,
      isPrimary: true,
      verifiedAt: new Date(NOW).toISOString(),
    },
    membership: {
      id: `${input.userId}-membership`,
      userId: input.userId,
      orgId: 'org-1',
      primaryRole: 'member',
      functionalRoles: [],
    },
    principal: { id: `${input.userId}-principal`, userId: input.userId, orgId: 'org-1' },
    createdAt: NOW - DAY,
    deactivatedAt: input.deactivatedAt ?? null,
    ...(input.admission ? { admission: input.admission } : {}),
  };
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-license-refresh-'));
  filePath = path.join(dir, 'license.key');
  const keys = await generateLicenseSigningKeys();
  signer = {
    ring: { [KID]: keys.publicKeyBase64Url },
    sign: (claims) => signLicense(claims, keys.privateKey),
  };
  disposables = [];
});

afterEach(() => {
  for (const item of disposables) item.dispose();
  resetAuditSink();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('license refresh agent — stand-down matrix', () => {
  it('does not POST when no license is installed', async () => {
    const slot = await makeSlot();
    const { calls, transport } = makeTransport(() => transportResponse('', 200));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(calls).toHaveLength(0);
  });

  it('does not POST for an offline: true license', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense({ offline: true })));
    const { calls, transport } = makeTransport(() => transportResponse('', 200));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(calls).toHaveLength(0);
  });

  it('does not POST outside the renewal window', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense({ validUntil: NOW + 40 * DAY })));
    const { calls, transport } = makeTransport(() => transportResponse('', 200));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(calls).toHaveLength(0);
  });

  it('POSTs exactly at the window boundary crossing', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense({ validUntil: NOW + 30 * DAY })));
    const { calls, transport } = makeTransport(() => transportResponse('', 500));
    // validUntil − now === 30d: still outside (strict less-than).
    const atBoundary = makeAgent(slot, transport);
    await atBoundary.tick();
    expect(calls).toHaveLength(0);
    // One ms later the file is inside the window.
    const inside = makeAgent(slot, transport, { now: () => NOW + 1 });
    await inside.tick();
    expect(calls).toHaveLength(1);
  });

  it('POSTs during grace — the outage-recovery path', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense({ validUntil: NOW - 5 * DAY })));
    expect(slot.getSnapshot().status).toBe('grace');
    const { calls, transport } = makeTransport(() => transportResponse('', 500));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(calls).toHaveLength(1);
  });
});

describe('license refresh agent — wire payload', () => {
  it('POSTs exactly { licenseKey, appVersion, platform } to the endpoint', async () => {
    const slot = await makeSlot();
    const installed = await signer.sign(makeLicense());
    await slot.install(installed);
    const { calls, transport } = makeTransport(() => transportResponse('', 500));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://license.openheaders.com/refresh');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({
      licenseKey: installed,
      appVersion: APP_VERSION,
      platform: 'testos',
    });
  });
});

describe('license refresh agent — success swap', () => {
  it('installs the fresh artifact through the slot', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense()));
    const fresh = await signer.sign(makeLicense({ validUntil: NOW + 45 * DAY, seats: 30 }));
    const { transport } = makeTransport(() => transportResponse(`${fresh}\n`, 200));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    const snapshot = slot.getSnapshot();
    expect(snapshot.status).toBe('licensed');
    if (snapshot.status !== 'licensed') return;
    expect(snapshot.seats).toBe(30);
    expect(snapshot.validUntil).toBe(NOW + 45 * DAY);
    expect(fs.readFileSync(filePath, 'utf8').trim()).toBe(fresh);
  });

  it('stamps the audit log with daemon.license-refresh, not license-install', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense()));
    const capabilities: string[] = [];
    setAuditSink((entry) => capabilities.push(entry.capability));
    const fresh = await signer.sign(makeLicense({ validUntil: NOW + 45 * DAY }));
    const { transport } = makeTransport(() => transportResponse(fresh, 200));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(capabilities).toEqual(['daemon.license-refresh']);
  });

  it('keeps the installed file when a 200 body fails verification, and retries next tick', async () => {
    const slot = await makeSlot();
    const installed = await signer.sign(makeLicense());
    await slot.install(installed);
    const { calls, transport } = makeTransport(() => transportResponse('not a license', 200));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    expect(fs.readFileSync(filePath, 'utf8').trim()).toBe(installed);
    await agent.tick();
    expect(calls).toHaveLength(2);
  });
});

describe('license refresh agent — refusal vs transport', () => {
  it('latches off after a 4xx until a different license is installed', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense()));
    const { calls, transport } = makeTransport(() => transportResponse('', 410));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    await agent.tick();
    expect(calls).toHaveLength(1);
    // A different artifact (renewed subscription pasted in) re-arms.
    await slot.install(await signer.sign(makeLicense({ licenseId: 'lic-0002' })));
    await agent.tick();
    expect(calls).toHaveLength(2);
  });

  it('retries on the next tick after a network failure', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense()));
    const { calls, transport } = makeTransport(() => new TransportError('connect ECONNREFUSED'));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    await agent.tick();
    expect(calls).toHaveLength(2);
    expect(slot.getSnapshot().status).toBe('licensed');
  });

  it('retries on the next tick after a 5xx', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense()));
    const { calls, transport } = makeTransport(() => transportResponse('', 503));
    const agent = makeAgent(slot, transport);
    await agent.tick();
    await agent.tick();
    expect(calls).toHaveLength(2);
  });
});

describe('license refresh agent — personal seats', () => {
  function makePersonal(overrides: Partial<License> = {}): License {
    return makeLicense({
      kind: 'personal-seat',
      seats: 1,
      licenseId: 'lic-personal-1',
      licensee: { name: 'Ada Example', email: 'ada@openheaders.io' },
      ...overrides,
    });
  }

  it('renews a user-attached artifact in the window and stamps the refresh audit row', async () => {
    const slot = await makeSlot();
    const installed = await signer.sign(makePersonal());
    const fresh = await signer.sign(makePersonal({ validUntil: NOW + 45 * DAY }));
    const replaced: Array<{ licenseId: string; licenseKey: string }> = [];
    const capabilities: string[] = [];
    setAuditSink((entry) => capabilities.push(entry.capability));
    const { calls, transport } = makeTransport(() => transportResponse(`${fresh}\n`, 200));
    const agent = makeAgent(slot, transport, {
      listUsers: async () => [
        makeUserRecord({
          userId: 'u1',
          email: 'ada@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-1', licenseKey: installed },
        }),
      ],
      replaceArtifact: async (licenseId, licenseKey) => {
        replaced.push({ licenseId, licenseKey });
        return 1;
      },
    });
    await agent.tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual({ licenseKey: installed, appVersion: APP_VERSION, platform: 'testos' });
    expect(replaced).toEqual([{ licenseId: 'lic-personal-1', licenseKey: fresh }]);
    expect(capabilities).toEqual(['daemon.license-refresh']);
  });

  it('dedupes by licenseId and skips deactivated, out-of-window, and invalid artifacts', async () => {
    const slot = await makeSlot();
    const inWindow = await signer.sign(makePersonal());
    const outside = await signer.sign(makePersonal({ licenseId: 'lic-personal-2', validUntil: NOW + 40 * DAY }));
    const { calls, transport } = makeTransport(() => transportResponse('', 500));
    const agent = makeAgent(slot, transport, {
      listUsers: async () => [
        makeUserRecord({
          userId: 'u1',
          email: 'ada@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-1', licenseKey: inWindow },
        }),
        makeUserRecord({
          userId: 'u2',
          email: 'ada2@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-1', licenseKey: inWindow },
        }),
        makeUserRecord({
          userId: 'u3',
          email: 'bob@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-2', licenseKey: outside },
        }),
        makeUserRecord({
          userId: 'u4',
          email: 'eve@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-3', licenseKey: 'not a license' },
          deactivatedAt: undefined,
        }),
        makeUserRecord({
          userId: 'u5',
          email: 'gone@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-4', licenseKey: inWindow },
          deactivatedAt: NOW - DAY,
        }),
      ],
      replaceArtifact: async () => 0,
    });
    await agent.tick();
    expect(calls).toHaveLength(1);
  });

  it('latches per licenseId on 4xx and re-arms when the stored artifact changes', async () => {
    const slot = await makeSlot();
    let installed = await signer.sign(makePersonal());
    const { calls, transport } = makeTransport(() => transportResponse('', 410));
    const agent = makeAgent(slot, transport, {
      listUsers: async () => [
        makeUserRecord({
          userId: 'u1',
          email: 'ada@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-1', licenseKey: installed },
        }),
      ],
      replaceArtifact: async () => 0,
    });
    await agent.tick();
    await agent.tick();
    expect(calls).toHaveLength(1);
    installed = await signer.sign(makePersonal({ validUntil: NOW + 20 * DAY }));
    await agent.tick();
    expect(calls).toHaveLength(2);
  });

  it('never swaps in a 200 body that fails the ring or changes lineage; retries next tick', async () => {
    const slot = await makeSlot();
    const installed = await signer.sign(makePersonal());
    const foreignLineage = await signer.sign(makePersonal({ licenseId: 'lic-other', validUntil: NOW + 45 * DAY }));
    const replaced: string[] = [];
    let body = 'not a license';
    const { calls, transport } = makeTransport(() => transportResponse(body, 200));
    const agent = makeAgent(slot, transport, {
      listUsers: async () => [
        makeUserRecord({
          userId: 'u1',
          email: 'ada@openheaders.io',
          admission: { kind: 'personal', licenseId: 'lic-personal-1', licenseKey: installed },
        }),
      ],
      replaceArtifact: async (licenseId) => {
        replaced.push(licenseId);
        return 1;
      },
    });
    await agent.tick();
    body = foreignLineage;
    await agent.tick();
    expect(calls).toHaveLength(2);
    expect(replaced).toEqual([]);
  });
});

describe('license refresh agent — scheduling', () => {
  it('arms the first tick shortly after install and re-arms after each fired tick', async () => {
    const slot = await makeSlot();
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const agent = installLicenseRefreshAgent({
      slot,
      appVersion: APP_VERSION,
      platform: 'testos',
      transport: makeTransport(() => transportResponse('', 200)).transport,
      now: () => NOW,
      setTimer: (fn, ms) => {
        timers.push({ fn, ms });
        return 0 as unknown as NodeJS.Timeout;
      },
      clearTimer: () => undefined,
      random: () => 0.5,
    });
    disposables.push(agent);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.ms).toBe(60_000);
    timers[0]?.fn();
    await new Promise((resolve) => setImmediate(resolve));
    expect(timers).toHaveLength(2);
    expect(timers[1]?.ms).toBe(6 * 60 * 60 * 1000);
  });

  it('dispose stops the chain — a disposed agent never re-arms or ticks', async () => {
    const slot = await makeSlot();
    await slot.install(await signer.sign(makeLicense()));
    const timers: Array<{ ms: number }> = [];
    const { calls, transport } = makeTransport(() => transportResponse('', 200));
    const agent = makeAgent(slot, transport, { timers });
    agent.dispose();
    await agent.tick();
    expect(calls).toHaveLength(0);
    expect(timers).toHaveLength(1);
  });
});
