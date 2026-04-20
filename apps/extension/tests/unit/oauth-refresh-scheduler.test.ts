/**
 * oauth-refresh-scheduler — alarm-driven silent refresh for OAuth
 * credentials. We mock `chrome.alarms` + `oauth-flow.refreshCredential`
 * so each phase is exercised without real timers or network.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────

const alarmsCreateMock = vi.fn<(name: string, info: chrome.alarms.AlarmCreateInfo) => void>();
const alarmsClearMock = vi.fn<(name: string) => void>();
const alarmsGetAllMock = vi.fn<() => Promise<chrome.alarms.Alarm[]>>();
const recordLogMock = vi.fn();
const refreshCredentialMock = vi.fn();

vi.mock('@utils/browser-api', () => ({
  alarms: {
    create: (name: string, info: chrome.alarms.AlarmCreateInfo) => alarmsCreateMock(name, info),
    clear: (name: string) => alarmsClearMock(name),
    getAll: () => alarmsGetAllMock(),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: (...args: unknown[]) => recordLogMock(...args),
}));

vi.mock('@/background/modules/oauth-flow', () => ({
  refreshCredential: (...args: unknown[]) => refreshCredentialMock(...args),
}));

// Token-store: hand-rolled stub — we control the state directly via
// test setters so the scheduler logic is exercised in isolation. The
// real token-store is unit-tested separately.
let storeState: {
  tokens: Record<string, Record<string, OAuth2TokenBundle>>;
  configs: Record<string, Record<string, V5.OAuth2Auth>>;
  errors: Record<
    string,
    Record<string, { consecutiveFailures: number; lastErrorAt: number; lastErrorMessage: string }>
  >;
  listeners: Set<(workspaceId: string) => void>;
} = { tokens: {}, configs: {}, errors: {}, listeners: new Set() };

vi.mock('@/background/modules/oauth-token-store', () => ({
  getTokenBundle: vi.fn(async (ref: string, ws: string) => storeState.tokens[ws]?.[ref] ?? null),
  getRefreshConfig: vi.fn(async (ref: string, ws: string) => storeState.configs[ws]?.[ref] ?? null),
  listAllWorkspaceCredentials: vi.fn(async () => {
    const out: Array<{
      workspaceId: string;
      credentialRef: string;
      bundle: OAuth2TokenBundle;
      config: V5.OAuth2Auth | null;
      errorState: { consecutiveFailures: number; lastErrorAt: number; lastErrorMessage: string } | null;
    }> = [];
    for (const ws of Object.keys(storeState.tokens)) {
      for (const [ref, bundle] of Object.entries(storeState.tokens[ws])) {
        out.push({
          workspaceId: ws,
          credentialRef: ref,
          bundle,
          config: storeState.configs[ws]?.[ref] ?? null,
          errorState: storeState.errors[ws]?.[ref] ?? null,
        });
      }
    }
    return out;
  }),
  onOAuthStoreChange: vi.fn((fn: (workspaceId: string) => void) => {
    storeState.listeners.add(fn);
    return () => storeState.listeners.delete(fn);
  }),
  recordRefreshError: vi.fn(async (ref: string, message: string, ws: string) => {
    const prev = storeState.errors[ws]?.[ref];
    const next = {
      consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
      lastErrorAt: Date.now(),
      lastErrorMessage: message,
    };
    storeState.errors[ws] = { ...(storeState.errors[ws] ?? {}), [ref]: next };
    for (const fn of storeState.listeners) fn(ws);
    return next;
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

function makeBundle(overrides: Partial<OAuth2TokenBundle> = {}): OAuth2TokenBundle {
  return {
    accessToken: 'at-test',
    refreshToken: 'rt-test',
    tokenType: 'Bearer',
    scope: 'read',
    issuedAt: NOW - 600_000,
    expiresAt: NOW + 600_000,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<V5.OAuth2Auth> = {}): V5.OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'cred-test',
    flow: 'authorization-code-pkce',
    authorizationEndpoint: 'https://auth.openheaders.io/authorize',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-xyz',
    scopes: ['read'],
    ...overrides,
  };
}

function seed(
  workspaceId: string,
  credentialRef: string,
  bundle: OAuth2TokenBundle,
  config: V5.OAuth2Auth | null,
  errorState?: { consecutiveFailures: number; lastErrorAt: number; lastErrorMessage: string },
): void {
  storeState.tokens[workspaceId] = { ...(storeState.tokens[workspaceId] ?? {}), [credentialRef]: bundle };
  if (config) {
    storeState.configs[workspaceId] = { ...(storeState.configs[workspaceId] ?? {}), [credentialRef]: config };
  }
  if (errorState) {
    storeState.errors[workspaceId] = { ...(storeState.errors[workspaceId] ?? {}), [credentialRef]: errorState };
  }
}

beforeEach(() => {
  storeState = { tokens: {}, configs: {}, errors: {}, listeners: new Set() };
  alarmsCreateMock.mockReset();
  alarmsClearMock.mockReset();
  alarmsGetAllMock.mockReset();
  alarmsGetAllMock.mockResolvedValue([]);
  recordLogMock.mockReset();
  refreshCredentialMock.mockReset();
});

afterEach(async () => {
  const mod = await import('@/background/modules/oauth-refresh-scheduler');
  mod.stopOAuthScheduler();
  vi.restoreAllMocks();
});

// ── Alarm-name codec ──────────────────────────────────────────────

describe('oauth-refresh-scheduler — alarm naming', () => {
  it('round-trips workspaceId + credentialRef through buildAlarmName / parseAlarmName', async () => {
    const { buildAlarmName, parseAlarmName, OAUTH_ALARM_PREFIX } = await import(
      '@/background/modules/oauth-refresh-scheduler'
    );
    const name = buildAlarmName('ws-ab12', 'cred:with:colons/and spaces');
    expect(name.startsWith(OAUTH_ALARM_PREFIX)).toBe(true);
    expect(parseAlarmName(name)).toEqual({ workspaceId: 'ws-ab12', credentialRef: 'cred:with:colons/and spaces' });
  });

  it('parseAlarmName returns null for unrelated alarm names', async () => {
    const { parseAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    expect(parseAlarmName('updateBadge')).toBeNull();
    expect(parseAlarmName('oauth-refresh:!!!!!!')).toBeNull();
  });

  it('isOAuthRefreshAlarm discriminates on prefix', async () => {
    const { isOAuthRefreshAlarm, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    expect(isOAuthRefreshAlarm({ name: 'wsReconnect' } as chrome.alarms.Alarm)).toBe(false);
    expect(isOAuthRefreshAlarm({ name: buildAlarmName('w', 'c') } as chrome.alarms.Alarm)).toBe(true);
  });
});

// ── Cadence (pure) ────────────────────────────────────────────────

describe('oauth-refresh-scheduler — cadence math', () => {
  it('fires REFRESH_LEAD_MS before expiry on the healthy path', async () => {
    const { computeNextFireAt, REFRESH_LEAD_MS } = await import('@/background/modules/oauth-refresh-scheduler');
    const bundle = makeBundle({ expiresAt: NOW + 3600_000 });
    expect(computeNextFireAt(bundle, null, NOW)).toBe(NOW + 3600_000 - REFRESH_LEAD_MS);
  });

  it('clamps the healthy-path fire time to now + MIN_ALARM_DELAY_MS when expiry is imminent', async () => {
    const { computeNextFireAt, MIN_ALARM_DELAY_MS } = await import('@/background/modules/oauth-refresh-scheduler');
    const bundle = makeBundle({ expiresAt: NOW + 1_000 });
    expect(computeNextFireAt(bundle, null, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('applies exponential backoff when consecutive failures > 0', async () => {
    const { computeNextFireAt, MIN_ALARM_DELAY_MS } = await import('@/background/modules/oauth-refresh-scheduler');
    const bundle = makeBundle();
    // 1st failure: 60s backoff, 2nd: 120s, 3rd: 240s
    const t0 = NOW;
    expect(
      computeNextFireAt(bundle, { consecutiveFailures: 1, lastErrorAt: t0, lastErrorMessage: '' }, t0 + 10_000),
    ).toBe(Math.max(t0 + 60_000, t0 + 10_000 + MIN_ALARM_DELAY_MS));
    expect(
      computeNextFireAt(bundle, { consecutiveFailures: 2, lastErrorAt: t0, lastErrorMessage: '' }, t0 + 10_000),
    ).toBe(t0 + 120_000);
    expect(
      computeNextFireAt(bundle, { consecutiveFailures: 3, lastErrorAt: t0, lastErrorMessage: '' }, t0 + 10_000),
    ).toBe(t0 + 240_000);
  });

  it('caps backoff at 3600s (MAX_BACKOFF_SECONDS)', async () => {
    const { computeNextFireAt, MAX_BACKOFF_SECONDS } = await import('@/background/modules/oauth-refresh-scheduler');
    const bundle = makeBundle();
    // 2^20 * 60 = ~62M seconds — should clamp to 3600.
    const state = { consecutiveFailures: 20, lastErrorAt: NOW, lastErrorMessage: '' };
    expect(computeNextFireAt(bundle, state, NOW - 10_000)).toBe(NOW + MAX_BACKOFF_SECONDS * 1000);
  });

  it('returns null when the bundle has no expiresAt and no error state', async () => {
    const { computeNextFireAt } = await import('@/background/modules/oauth-refresh-scheduler');
    const bundle = makeBundle({ expiresAt: null });
    expect(computeNextFireAt(bundle, null, NOW)).toBeNull();
  });
});

// ── canSilentRefresh ──────────────────────────────────────────────

describe('oauth-refresh-scheduler — canSilentRefresh', () => {
  it('allows refresh when refreshToken is present', async () => {
    const { canSilentRefresh } = await import('@/background/modules/oauth-refresh-scheduler');
    expect(canSilentRefresh(makeBundle(), makeConfig())).toBe(true);
  });

  it('rejects refresh when refreshToken is absent and flow is not client-credentials', async () => {
    const { canSilentRefresh } = await import('@/background/modules/oauth-refresh-scheduler');
    expect(canSilentRefresh(makeBundle({ refreshToken: undefined }), makeConfig())).toBe(false);
  });

  it('allows refresh for client-credentials flow even without refreshToken', async () => {
    const { canSilentRefresh } = await import('@/background/modules/oauth-refresh-scheduler');
    expect(canSilentRefresh(makeBundle({ refreshToken: undefined }), makeConfig({ flow: 'client-credentials' }))).toBe(
      true,
    );
  });

  it('rejects when bundle or config is null', async () => {
    const { canSilentRefresh } = await import('@/background/modules/oauth-refresh-scheduler');
    expect(canSilentRefresh(null, makeConfig())).toBe(false);
    expect(canSilentRefresh(makeBundle(), null)).toBe(false);
  });
});

// ── scheduleOAuthRefresh ──────────────────────────────────────────

describe('oauth-refresh-scheduler — scheduleOAuthRefresh', () => {
  it('creates an alarm with the healthy-path fire time', async () => {
    const { scheduleOAuthRefresh, buildAlarmName, REFRESH_LEAD_MS } = await import(
      '@/background/modules/oauth-refresh-scheduler'
    );
    const bundle = makeBundle({ expiresAt: NOW + 3600_000 });
    const scheduled = await scheduleOAuthRefresh(
      { workspaceId: 'ws-1', credentialRef: 'cred-1', bundle, config: makeConfig(), errorState: null },
      NOW,
    );
    expect(scheduled).toBe(true);
    expect(alarmsCreateMock).toHaveBeenCalledWith(buildAlarmName('ws-1', 'cred-1'), {
      when: NOW + 3600_000 - REFRESH_LEAD_MS,
    });
  });

  it('skips when credential is not silently refreshable', async () => {
    const { scheduleOAuthRefresh } = await import('@/background/modules/oauth-refresh-scheduler');
    const scheduled = await scheduleOAuthRefresh(
      {
        workspaceId: 'ws-1',
        credentialRef: 'cred-1',
        bundle: makeBundle({ refreshToken: undefined }),
        config: makeConfig(),
        errorState: null,
      },
      NOW,
    );
    expect(scheduled).toBe(false);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
  });

  it('skips when expiry is unknown and no backoff state', async () => {
    const { scheduleOAuthRefresh } = await import('@/background/modules/oauth-refresh-scheduler');
    const scheduled = await scheduleOAuthRefresh(
      {
        workspaceId: 'ws-1',
        credentialRef: 'cred-1',
        bundle: makeBundle({ expiresAt: null }),
        config: makeConfig(),
        errorState: null,
      },
      NOW,
    );
    expect(scheduled).toBe(false);
  });
});

// ── cancelOAuthRefresh ────────────────────────────────────────────

describe('oauth-refresh-scheduler — cancelOAuthRefresh', () => {
  it('clears the alarm by deterministic name', async () => {
    const { cancelOAuthRefresh, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    await cancelOAuthRefresh('ws-1', 'cred-1');
    expect(alarmsClearMock).toHaveBeenCalledWith(buildAlarmName('ws-1', 'cred-1'));
  });
});

// ── reconcileOAuthSchedules ───────────────────────────────────────

describe('oauth-refresh-scheduler — reconcileOAuthSchedules', () => {
  it('schedules alarms for every silently-refreshable credential across all workspaces', async () => {
    seed('ws-1', 'cred-a', makeBundle({ expiresAt: NOW + 3_600_000 }), makeConfig({ credentialRef: 'cred-a' }));
    seed('ws-1', 'cred-b', makeBundle({ expiresAt: NOW + 7_200_000 }), makeConfig({ credentialRef: 'cred-b' }));
    seed('ws-2', 'cred-c', makeBundle({ expiresAt: NOW + 1_800_000 }), makeConfig({ credentialRef: 'cred-c' }));

    const { reconcileOAuthSchedules, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    await reconcileOAuthSchedules(NOW);

    expect(alarmsCreateMock).toHaveBeenCalledTimes(3);
    const names = alarmsCreateMock.mock.calls.map(([name]) => name);
    expect(names).toContain(buildAlarmName('ws-1', 'cred-a'));
    expect(names).toContain(buildAlarmName('ws-1', 'cred-b'));
    expect(names).toContain(buildAlarmName('ws-2', 'cred-c'));
  });

  it('clears orphan alarms whose credentials no longer exist', async () => {
    seed('ws-1', 'cred-a', makeBundle({ expiresAt: NOW + 3_600_000 }), makeConfig({ credentialRef: 'cred-a' }));

    const { reconcileOAuthSchedules, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    // Pretend an old alarm exists for a credential that was deleted.
    alarmsGetAllMock.mockResolvedValue([
      { name: buildAlarmName('ws-old', 'cred-gone'), scheduledTime: NOW + 60_000 } as chrome.alarms.Alarm,
      { name: buildAlarmName('ws-1', 'cred-a'), scheduledTime: NOW + 60_000 } as chrome.alarms.Alarm,
      // A non-oauth alarm (the test proves the filter ignores it).
      { name: 'updateBadge', scheduledTime: NOW } as chrome.alarms.Alarm,
    ]);
    await reconcileOAuthSchedules(NOW);

    expect(alarmsClearMock).toHaveBeenCalledWith(buildAlarmName('ws-old', 'cred-gone'));
    expect(alarmsClearMock).not.toHaveBeenCalledWith('updateBadge');
    // The surviving alarm is rescheduled (overwrite) via create, not cleared.
    expect(alarmsClearMock).not.toHaveBeenCalledWith(buildAlarmName('ws-1', 'cred-a'));
  });

  it('does not schedule non-refreshable credentials', async () => {
    seed(
      'ws-1',
      'cred-implicit',
      makeBundle({ refreshToken: undefined, expiresAt: NOW + 3_600_000 }),
      makeConfig({ flow: 'authorization-code-pkce' }),
    );
    const { reconcileOAuthSchedules } = await import('@/background/modules/oauth-refresh-scheduler');
    await reconcileOAuthSchedules(NOW);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
  });
});

// ── handleOAuthAlarm ──────────────────────────────────────────────

describe('oauth-refresh-scheduler — handleOAuthAlarm', () => {
  it('calls refreshCredential and records success observability', async () => {
    seed('ws-1', 'cred-a', makeBundle({ expiresAt: NOW + 30_000 }), makeConfig({ credentialRef: 'cred-a' }));
    refreshCredentialMock.mockResolvedValue(makeBundle({ accessToken: 'at-new' }));

    const { handleOAuthAlarm, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    await handleOAuthAlarm({ name: buildAlarmName('ws-1', 'cred-a'), scheduledTime: NOW } as chrome.alarms.Alarm);

    expect(refreshCredentialMock).toHaveBeenCalledWith(
      expect.objectContaining({ credentialRef: 'cred-a', flow: 'authorization-code-pkce' }),
      'ws-1',
    );
    expect(recordLogMock).toHaveBeenCalledWith(expect.objectContaining({ subsystem: 'oauth', op: 'refresh-fired' }));
    expect(recordLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ subsystem: 'oauth', op: 'refresh-succeeded' }),
    );
  });

  it('records failure and consecutive-failure count on refreshCredential reject', async () => {
    seed('ws-1', 'cred-a', makeBundle({ expiresAt: NOW + 30_000 }), makeConfig({ credentialRef: 'cred-a' }));
    refreshCredentialMock.mockRejectedValue(new Error('network fail'));

    const { handleOAuthAlarm, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    await handleOAuthAlarm({ name: buildAlarmName('ws-1', 'cred-a'), scheduledTime: NOW } as chrome.alarms.Alarm);

    expect(recordLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ subsystem: 'oauth', op: 'refresh-failed', level: 'warn' }),
    );
    expect(storeState.errors['ws-1']?.['cred-a']?.consecutiveFailures).toBe(1);
  });

  it('escalates log level to error on the 3rd consecutive failure', async () => {
    seed('ws-1', 'cred-a', makeBundle({ expiresAt: NOW + 30_000 }), makeConfig({ credentialRef: 'cred-a' }), {
      consecutiveFailures: 2,
      lastErrorAt: NOW - 60_000,
      lastErrorMessage: 'prev',
    });
    refreshCredentialMock.mockRejectedValue(new Error('still failing'));

    const { handleOAuthAlarm, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    await handleOAuthAlarm({ name: buildAlarmName('ws-1', 'cred-a'), scheduledTime: NOW } as chrome.alarms.Alarm);

    const failedEntry = recordLogMock.mock.calls.find(([entry]) => (entry as { op: string }).op === 'refresh-failed');
    expect(failedEntry?.[0]).toMatchObject({ level: 'error' });
  });

  it('clears the alarm when the credential was deleted between scheduling and firing', async () => {
    const { handleOAuthAlarm, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    // No seeded credential — storeState is empty.
    await handleOAuthAlarm({ name: buildAlarmName('ws-1', 'cred-gone'), scheduledTime: NOW } as chrome.alarms.Alarm);
    expect(alarmsClearMock).toHaveBeenCalledWith(buildAlarmName('ws-1', 'cred-gone'));
    expect(refreshCredentialMock).not.toHaveBeenCalled();
  });

  it('ignores unrelated alarm names', async () => {
    const { handleOAuthAlarm } = await import('@/background/modules/oauth-refresh-scheduler');
    await handleOAuthAlarm({ name: 'updateBadge', scheduledTime: NOW } as chrome.alarms.Alarm);
    expect(refreshCredentialMock).not.toHaveBeenCalled();
    expect(recordLogMock).not.toHaveBeenCalled();
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────

describe('oauth-refresh-scheduler — lifecycle', () => {
  it('startOAuthScheduler subscribes to store changes and triggers reconcile', async () => {
    seed('ws-1', 'cred-a', makeBundle({ expiresAt: NOW + 3_600_000 }), makeConfig({ credentialRef: 'cred-a' }));

    const { startOAuthScheduler, buildAlarmName } = await import('@/background/modules/oauth-refresh-scheduler');
    startOAuthScheduler();

    // Fire the store change listener — the subscriber should reconcile,
    // which schedules the seeded credential's alarm.
    for (const fn of storeState.listeners) fn('ws-1');
    await Promise.resolve();
    await Promise.resolve();

    expect(alarmsCreateMock).toHaveBeenCalledWith(
      buildAlarmName('ws-1', 'cred-a'),
      expect.objectContaining({ when: expect.any(Number) }),
    );
  });

  it('stopOAuthScheduler disposes the subscription (second start is no-op)', async () => {
    const { startOAuthScheduler, stopOAuthScheduler } = await import('@/background/modules/oauth-refresh-scheduler');
    startOAuthScheduler();
    const firstListenerCount = storeState.listeners.size;
    startOAuthScheduler(); // idempotent
    expect(storeState.listeners.size).toBe(firstListenerCount);

    stopOAuthScheduler();
    expect(storeState.listeners.size).toBe(firstListenerCount - 1);
  });
});
