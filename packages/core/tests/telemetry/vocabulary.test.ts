import { LOCALES } from '@openheaders/i18n';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { DetectedImportSource } from '../../src/import/detect';
import type { LicensedSnapshot } from '../../src/licensing/types';
import { RuleTypeSchema } from '../../src/schemas/rule';
import {
  activatedPlanFromLicenseSnapshot,
  browserMajorFromUserAgent,
  bucketActiveDays,
  bucketScale,
  bucketSessionAge,
  bucketSinceInstall,
  bucketTeamSeats,
  bucketViewportHeight,
  bucketViewportWidth,
  macOsMajorFromDarwinRelease,
  migratedFromImportSource,
  oncePerSessionLatchKey,
  osMajorFromSystemVersion,
  parseTelemetryAppVersion,
  planBucketFromLicenseSnapshot,
  resolveTelemetrySyncKind,
  TELEMETRY_EVENT_POLICY,
  TELEMETRY_LEGACY_SCHEMA_VERSION,
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_VIEWPORT_HEIGHT_FLOORS,
  TELEMETRY_VIEWPORT_WIDTH_FLOORS,
  type TelemetryEnvelope,
  TelemetryEnvelopeSchema,
  type TelemetryEvent,
  TelemetryEventSchema,
  type TelemetryImportSourceId,
  TelemetryImportSourceIdSchema,
  TelemetryInstallIdSchema,
  TelemetryLocaleSchema,
  TelemetryRuleTypeIdSchema,
  TelemetrySessionIdSchema,
  type TelemetryState,
  TelemetryStateSchema,
  toTelemetryArch,
  toTelemetryLocale,
  toTelemetryMcpClient,
  windowsMajorFromClientHintPlatformVersion,
  windowsMajorFromVersion,
} from '../../src/telemetry';

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

// Compile-time pin: the telemetry import-source union tracks the detector's
// kind union exactly — divergence fails typecheck, making growth deliberate.
const importSourcesMatchDetector: MutuallyAssignable<TelemetryImportSourceId, DetectedImportSource['kind']> = true;

const SESSION_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';
const INSTALL_ID = 'feedface00feedface00feedface0000';

const SAMPLE_EVENTS: TelemetryEvent[] = [
  { name: 'first_run', channel: 'chrome-store' },
  {
    name: 'session_start',
    host: 'extension',
    appVersion: { year: 2026, month: 7, patch: 0 },
    platform: 'mac',
    browser: 'chrome',
    locale: 'en',
    rules: '1-5',
    workspaces: '0',
  },
  { name: 'feature_used', feature: 'traffic-panel' },
  { name: 'feature_used', feature: 'desktop-download' },
  { name: 'feature_used', feature: 'git-commit' },
  { name: 'feature_used', feature: 'keymap' },
  { name: 'feature_used', feature: 'workflow-scripts' },
  { name: 'rule_created', ruleType: 'header' },
  { name: 'rule_created', ruleType: 'response', origin: 'quick-editor' },
  { name: 'rule_matched', ruleType: 'header' },
  { name: 'import_run', source: 'postman', ok: true },
  { name: 'workflow_run', ok: false },
  { name: 'error_beacon', code: 'ws-connect-failed' },
  { name: 'error_beacon', code: 'dnr-rule-limit' },
  { name: 'error_beacon', code: 'storage-quota' },
  { name: 'license_activated', plan: 'individual' },
  { name: 'paywall_hit', surface: 'seat-gate' },
  { name: 'upgrade_cta_shown', surface: 'license-pane' },
  { name: 'upgrade_cta_clicked', surface: 'grace-banner' },
  { name: 'feature_used', feature: 'mcp-server' },
  { name: 'feature_used', feature: 'server-admin' },
  { name: 'feature_used', feature: 'popup' },
  { name: 'feature_used', feature: 'rule-toggle' },
  { name: 'mcp_client_connected', client: 'claude-code' },
  { name: 'feature_used', feature: 'extension-paired' },
  { name: 'session_start', rules: '1', workspaces: '1', sync: 'server' },
  { name: 'viewport_seen', surface: 'workbench', width: 1280, height: 800 },
  { name: 'viewport_seen', surface: 'popup', width: 800, height: 600 },
  { name: 'viewport_seen', surface: 'sidepanel', width: 0, height: 0 },
  // Schema 3's slice-one shapes (the v2 plan §4).
  { name: 'milestone', kind: 'first_rule_matched' },
  { name: 'request_sent', protocol: 'graphql' },
  { name: 'share_sent', route: 'server-admin', role: 'editor', members: '2-5' },
  { name: 'share_accepted', route: 'server' },
  { name: 'share_accepted', route: 'idp', role: 'viewer' },
  { name: 'limit_hit', limit: 'seats' },
];

const SAMPLE_STATE: TelemetryState = {
  stage: 'retained',
  rules: '6-20',
  requests: '2-5',
  workspaces: '1',
  sync: 'server',
  plan: 'team',
  role: 'owner',
  team: '6-10',
  profile: 'both',
  activeDays: '4-9',
  migratedFrom: 'postman',
};

describe('telemetry vocabulary — round-trips', () => {
  it('pins the import-source union to the detector (compile-time check holds)', () => {
    expect(importSourcesMatchDetector).toBe(true);
  });

  for (const event of SAMPLE_EVENTS) {
    it(`round-trips ${event.name} through JSON and the schema`, () => {
      const parsed = v.parse(TelemetryEventSchema, JSON.parse(JSON.stringify(event)));
      expect(parsed).toEqual(event);
    });
  }

  it('round-trips a batch envelope carrying the full per-process fact set and the state block', () => {
    const envelope: TelemetryEnvelope = {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      host: 'extension',
      channel: 'firefox-amo',
      appVersion: { year: 2026, month: 8, patch: 1 },
      platform: 'linux',
      arch: 'arm64',
      browser: 'firefox',
      locale: 'de',
      osVersion: 15,
      browserVersion: 131,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '2-7',
      sessionAge: '1-8h',
      sentAt: 1_760_000_000_000,
      state: SAMPLE_STATE,
      events: SAMPLE_EVENTS,
    };
    const parsed = v.parse(TelemetryEnvelopeSchema, JSON.parse(JSON.stringify(envelope)));
    expect(parsed).toEqual(envelope);
  });

  it('round-trips the state block with only its tracker-derived members — a host omits what it cannot read', () => {
    const minimal = { stage: 'installed', profile: 'none', activeDays: '1', migratedFrom: 'none' };
    expect(v.parse(TelemetryStateSchema, minimal)).toEqual(minimal);
    expect(v.parse(TelemetryStateSchema, SAMPLE_STATE)).toEqual(SAMPLE_STATE);
  });

  it('keeps both generations on the wire: schema 2 without a state block, schema 3 only with one', () => {
    const base = { sessionId: SESSION_ID, installId: INSTALL_ID, sinceInstall: '0', sentAt: 1, events: [] };
    expect(v.safeParse(TelemetryEnvelopeSchema, { ...base, schemaVersion: 2 }).success).toBe(true);
    expect(v.safeParse(TelemetryEnvelopeSchema, { ...base, schemaVersion: 2, state: SAMPLE_STATE }).success).toBe(
      false,
    );
    expect(v.safeParse(TelemetryEnvelopeSchema, { ...base, schemaVersion: 3 }).success).toBe(false);
    expect(v.safeParse(TelemetryEnvelopeSchema, { ...base, schemaVersion: 3, state: SAMPLE_STATE }).success).toBe(true);
  });

  it('accepts every architecture member on the envelope and an envelope without one (pre-S34 clients)', () => {
    const base = {
      schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '0',
      sentAt: 1_760_000_000_000,
      events: [],
    };
    for (const arch of ['x64', 'arm64', 'x64-on-arm64']) {
      expect(v.parse(TelemetryEnvelopeSchema, { ...base, arch })).toEqual({ ...base, arch });
    }
    expect(v.parse(TelemetryEnvelopeSchema, base)).toEqual(base);
  });

  it('accepts an envelope without the version majors (pre-S35 clients) and with either one alone', () => {
    const base = {
      schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '0',
      sentAt: 1_760_000_000_000,
      events: [],
    };
    expect(v.parse(TelemetryEnvelopeSchema, base)).toEqual(base);
    expect(v.parse(TelemetryEnvelopeSchema, { ...base, osVersion: 11 })).toEqual({ ...base, osVersion: 11 });
    expect(v.parse(TelemetryEnvelopeSchema, { ...base, browserVersion: 130 })).toEqual({
      ...base,
      browserVersion: 130,
    });
  });

  it('round-trips the current client event shapes — facts ride the envelope, not the events', () => {
    for (const event of [
      { name: 'first_run' },
      { name: 'session_start' },
      { name: 'session_start', rules: '1-5', workspaces: '0' },
    ]) {
      expect(v.parse(TelemetryEventSchema, JSON.parse(JSON.stringify(event)))).toEqual(event);
    }
  });

  it('accepts an envelope without the optional host (schema-v2 clients built before the field)', () => {
    const envelope = {
      schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '2-7',
      sentAt: 1_760_000_000_000,
      events: [],
    };
    expect(v.parse(TelemetryEnvelopeSchema, envelope)).toEqual(envelope);
  });

  it('accepts session_start without the optional browser and scale buckets (desktop, cli)', () => {
    const event = {
      name: 'session_start',
      host: 'cli',
      appVersion: { year: 2026, month: 7, patch: 1 },
      platform: 'linux',
      locale: 'en',
    };
    expect(v.parse(TelemetryEventSchema, event)).toEqual(event);
  });

  it('accepts session_start without host — current clients carry the surface on the envelope', () => {
    const event = {
      name: 'session_start',
      appVersion: { year: 2026, month: 8, patch: 0 },
      platform: 'mac',
      browser: 'chrome',
      locale: 'en',
    };
    expect(v.parse(TelemetryEventSchema, event)).toEqual(event);
  });
});

describe('telemetry vocabulary — rejections', () => {
  it('rejects an unknown event name', () => {
    expect(v.safeParse(TelemetryEventSchema, { name: 'page_viewed' }).success).toBe(false);
  });

  it('rejects an event carrying a property outside the allowlist', () => {
    const smuggled = { name: 'workflow_run', ok: true, url: 'https://openheaders.io/secret' };
    expect(v.safeParse(TelemetryEventSchema, smuggled).success).toBe(false);
  });

  it('rejects a first_run carrying a host — the surface lives on the envelope, no client ever sent it here', () => {
    const forged = { name: 'first_run', host: 'extension', channel: 'chrome-store' };
    expect(v.safeParse(TelemetryEventSchema, forged).success).toBe(false);
  });

  it('rejects a free-form string where a closed union is required', () => {
    expect(v.safeParse(TelemetryEventSchema, { name: 'feature_used', feature: 'anything-else' }).success).toBe(false);
  });

  it('rejects a rule_created origin outside the closed union', () => {
    const forged = { name: 'rule_created', ruleType: 'header', origin: 'https://openheaders.io/landing' };
    expect(v.safeParse(TelemetryEventSchema, forged).success).toBe(false);
  });

  it('rejects a rule_matched with a free-form rule type', () => {
    expect(v.safeParse(TelemetryEventSchema, { name: 'rule_matched', ruleType: 'anything' }).success).toBe(false);
  });

  it('rejects a license_activated plan outside the coarse bucket picklist — channel separation is structural', () => {
    for (const plan of ['enterprise', 'lic_00000042', 'user@openheaders.io']) {
      expect(v.safeParse(TelemetryEventSchema, { name: 'license_activated', plan }).success).toBe(false);
    }
  });

  it('rejects license_activated carrying anything beyond the plan bucket', () => {
    const smuggled = { name: 'license_activated', plan: 'team', seats: 25 };
    expect(v.safeParse(TelemetryEventSchema, smuggled).success).toBe(false);
  });

  it('rejects a monetization surface outside the closed union', () => {
    for (const name of ['paywall_hit', 'upgrade_cta_shown', 'upgrade_cta_clicked']) {
      expect(v.safeParse(TelemetryEventSchema, { name, surface: 'pricing-page' }).success).toBe(false);
    }
  });

  it('rejects a raw MCP client name — the picklist mapping is structural, never a passthrough', () => {
    for (const client of ['My Custom Agent/1.0', 'Claude Code', 'openheaders-test-client']) {
      expect(v.safeParse(TelemetryEventSchema, { name: 'mcp_client_connected', client }).success).toBe(false);
    }
  });

  it('rejects mcp_client_connected carrying anything beyond the client bucket', () => {
    const smuggled = { name: 'mcp_client_connected', client: 'cursor', version: '1.2.3' };
    expect(v.safeParse(TelemetryEventSchema, smuggled).success).toBe(false);
  });

  it('rejects a web host kind — served-web is hard-off and inexpressible', () => {
    const forged = {
      name: 'session_start',
      host: 'web',
      appVersion: { year: 2026, month: 7, patch: 0 },
      platform: 'mac',
      locale: 'en',
    };
    expect(v.safeParse(TelemetryEventSchema, forged).success).toBe(false);
  });

  it('rejects an envelope with extra top-level properties', () => {
    const envelope = {
      schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '0',
      sentAt: 1,
      events: [],
      country: 'US',
    };
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
  });

  it('rejects retired and unknown schemaVersions', () => {
    for (const schemaVersion of [1, 4]) {
      const envelope = {
        schemaVersion,
        sessionId: SESSION_ID,
        installId: INSTALL_ID,
        sinceInstall: '0',
        sentAt: 1,
        events: [],
      };
      expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
    }
  });

  it('rejects an architecture outside the closed union — a raw process.arch never passes through', () => {
    for (const arch of ['ia32', 'x86-64', 'arm', 'x64 ']) {
      const envelope = {
        schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
        arch,
        sessionId: SESSION_ID,
        installId: INSTALL_ID,
        sinceInstall: '0',
        sentAt: 1_760_000_000_000,
        events: [],
      };
      expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
    }
  });

  it('rejects a version major that is not a small positive integer — never a build, never a dotted string (S35)', () => {
    for (const bad of [0, -1, 10.5, 22631, '15', '10.0.22631']) {
      for (const field of ['osVersion', 'browserVersion']) {
        const envelope = {
          schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
          [field]: bad,
          sessionId: SESSION_ID,
          installId: INSTALL_ID,
          sinceInstall: '0',
          sentAt: 1,
          events: [],
        };
        expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success, `${field}=${String(bad)}`).toBe(false);
      }
    }
  });

  it('rejects a viewport outside the floor grammar — an exact size is inexpressible (S35)', () => {
    for (const forged of [
      { name: 'viewport_seen', surface: 'workbench', width: 1366, height: 800 },
      { name: 'viewport_seen', surface: 'workbench', width: 1280, height: 768 },
      { name: 'viewport_seen', surface: 'workbench', width: '1280', height: 800 },
      { name: 'viewport_seen', surface: 'tray', width: 1280, height: 800 },
      { name: 'viewport_seen', surface: 'workbench', width: 1280 },
    ]) {
      expect(v.safeParse(TelemetryEventSchema, forged).success).toBe(false);
    }
  });

  it('rejects a sync kind outside the picklist — a backend URL never passes through', () => {
    for (const sync of ['wss://sync.openheaders.io', 'daemon', '']) {
      expect(v.safeParse(TelemetryEventSchema, { name: 'session_start', sync }).success).toBe(false);
    }
  });

  it('rejects a precise sessionAge — buckets only', () => {
    const envelope = {
      schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '0',
      sessionAge: '37m',
      sentAt: 1,
      events: [],
    };
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
  });

  it('rejects a precise sinceInstall day count — buckets only', () => {
    const envelope = {
      schemaVersion: TELEMETRY_LEGACY_SCHEMA_VERSION,
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '12',
      sentAt: 1,
      events: [],
    };
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
  });

  const BAD_SESSION_IDS: Array<[string, string]> = [
    ['too short', 'abc123'],
    ['uppercase hex', SESSION_ID.toUpperCase()],
    ['non-hex alphabet', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'],
    ['arbitrary text', 'user@openheaders.io-was-here-now'],
  ];

  for (const [label, id] of BAD_SESSION_IDS) {
    it(`rejects a session or install id with ${label}`, () => {
      expect(v.safeParse(TelemetrySessionIdSchema, id).success).toBe(false);
      expect(v.safeParse(TelemetryInstallIdSchema, id).success).toBe(false);
    });
  }
});

describe('telemetry vocabulary — the state block (the v2 plan §3)', () => {
  it('rejects an exact team size, an off-ladder stage and an unlisted origin — buckets and picklists only', () => {
    expect(v.safeParse(TelemetryStateSchema, { ...SAMPLE_STATE, team: 7 }).success).toBe(false);
    expect(v.safeParse(TelemetryStateSchema, { ...SAMPLE_STATE, team: '7' }).success).toBe(false);
    expect(v.safeParse(TelemetryStateSchema, { ...SAMPLE_STATE, stage: 'paying' }).success).toBe(false);
    expect(v.safeParse(TelemetryStateSchema, { ...SAMPLE_STATE, migratedFrom: 'paw' }).success).toBe(false);
    expect(v.safeParse(TelemetryStateSchema, { ...SAMPLE_STATE, seeded: true }).success).toBe(false);
  });

  it('buckets the seats grammar against the free cap and the Team ceiling', () => {
    expect([0, 1, 2, 5, 6, 10, 11, 50, 51, 400].map(bucketTeamSeats)).toEqual([
      '1',
      '1',
      '2-5',
      '2-5',
      '6-10',
      '6-10',
      '11-50',
      '11-50',
      '51+',
      '51+',
    ]);
  });

  it('buckets active days with today as the floor', () => {
    expect([0, 1, 2, 3, 4, 9, 10, 28].map(bucketActiveDays)).toEqual([
      '1',
      '1',
      '2-3',
      '2-3',
      '4-9',
      '4-9',
      '10+',
      '10+',
    ]);
  });

  it('reads the plan for the state block: licensed or in grace by kind, free for everything else', () => {
    const licensed = (status: 'licensed' | 'grace' | 'expired', kind?: 'personal-seat') => ({
      status,
      licenseId: 'lic_1',
      licensee: { name: 'John Doe' },
      seats: 5,
      entitlements: [],
      validUntil: 1,
      graceEndsAt: 2,
      ...(kind ? { kind } : {}),
    });
    expect(planBucketFromLicenseSnapshot({ status: 'unlicensed' })).toBe('free');
    expect(planBucketFromLicenseSnapshot({ status: 'invalid', reason: 'bad-signature' })).toBe('free');
    expect(planBucketFromLicenseSnapshot(licensed('expired'))).toBe('free');
    expect(planBucketFromLicenseSnapshot(licensed('licensed'))).toBe('team');
    expect(planBucketFromLicenseSnapshot(licensed('grace', 'personal-seat'))).toBe('individual');
  });

  it('folds the detector kinds onto the origin list: both Postman shapes, the named tools, other for the rest', () => {
    expect(migratedFromImportSource('postman')).toBe('postman');
    expect(migratedFromImportSource('postman-backup')).toBe('postman');
    expect(migratedFromImportSource('insomnia')).toBe('insomnia');
    expect(migratedFromImportSource('bruno')).toBe('bruno');
    expect(migratedFromImportSource('har')).toBe('har');
    expect(migratedFromImportSource('openapi')).toBe('openapi');
    for (const generic of ['curl', 'url', 'workspace', 'graphql-schema', 'unknown'] as const) {
      expect(migratedFromImportSource(generic)).toBe('other');
    }
  });
});

describe('telemetry vocabulary — the policy table (the v2 plan §4)', () => {
  it('names every event shape exactly once, under its own name', () => {
    const names = TelemetryEventSchema.options.map((option) => option.entries.name.literal);
    expect(Object.keys(TELEMETRY_EVENT_POLICY).sort()).toEqual([...names].sort());
    for (const [name, policy] of Object.entries(TELEMETRY_EVENT_POLICY)) expect(policy.name).toBe(name);
  });

  it('keys a daily latch by the member the table names and nothing else', () => {
    expect(oncePerSessionLatchKey({ name: 'request_sent', protocol: 'grpc' })).toBe('request_sent:grpc');
    expect(oncePerSessionLatchKey({ name: 'milestone', kind: 'first_import' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'share_accepted', route: 'server' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'limit_hit', limit: 'seats' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'session_start' })).toBeNull();
  });
});

describe('telemetry vocabulary — coarse buckets', () => {
  const NOW = 1_760_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  it('buckets install age coarsely and clamps a backwards clock to day 0', () => {
    expect(bucketSinceInstall(NOW, NOW)).toBe('0');
    expect(bucketSinceInstall(NOW - 1 * DAY, NOW)).toBe('1');
    expect(bucketSinceInstall(NOW - 3 * DAY, NOW)).toBe('2-7');
    expect(bucketSinceInstall(NOW - 7 * DAY, NOW)).toBe('2-7');
    expect(bucketSinceInstall(NOW - 12 * DAY, NOW)).toBe('8-30');
    expect(bucketSinceInstall(NOW - 30 * DAY, NOW)).toBe('8-30');
    expect(bucketSinceInstall(NOW - 31 * DAY, NOW)).toBe('31+');
    expect(bucketSinceInstall(NOW + DAY, NOW)).toBe('0');
  });

  it('buckets entity counts coarsely with the S17 top-end and S20 bottom-end splits', () => {
    expect(bucketScale(0)).toBe('0');
    expect(bucketScale(1)).toBe('1');
    expect(bucketScale(2)).toBe('2-5');
    expect(bucketScale(5)).toBe('2-5');
    expect(bucketScale(6)).toBe('6-20');
    expect(bucketScale(20)).toBe('6-20');
    expect(bucketScale(21)).toBe('21-100');
    expect(bucketScale(100)).toBe('21-100');
    expect(bucketScale(101)).toBe('100+');
    expect(bucketScale(-3)).toBe('0');
  });

  it('still accepts the legacy 1-5 and 21+ scale buckets from earlier clients', () => {
    const event = { name: 'session_start', rules: '21+', workspaces: '1-5' };
    expect(v.parse(TelemetryEventSchema, event)).toEqual(event);
  });

  const HOUR = 60 * 60 * 1000;

  it('buckets session age coarsely and clamps a backwards clock to the youngest bucket', () => {
    expect(bucketSessionAge(NOW, NOW)).toBe('0-9m');
    expect(bucketSessionAge(NOW - 9 * 60 * 1000, NOW)).toBe('0-9m');
    expect(bucketSessionAge(NOW - 10 * 60 * 1000, NOW)).toBe('10-59m');
    expect(bucketSessionAge(NOW - HOUR + 1, NOW)).toBe('10-59m');
    expect(bucketSessionAge(NOW - HOUR, NOW)).toBe('1-8h');
    expect(bucketSessionAge(NOW - 8 * HOUR, NOW)).toBe('8-24h');
    expect(bucketSessionAge(NOW - 24 * HOUR, NOW)).toBe('24h+');
    expect(bucketSessionAge(NOW + HOUR, NOW)).toBe('0-9m');
  });
});

describe('telemetry vocabulary — viewport floors (S35)', () => {
  it('floors a size onto the largest grammar member at or below it', () => {
    expect(bucketViewportWidth(1366)).toBe(1280);
    expect(bucketViewportWidth(1280)).toBe(1280);
    expect(bucketViewportWidth(2560)).toBe(1920);
    expect(bucketViewportWidth(800)).toBe(800);
    expect(bucketViewportWidth(359)).toBe(0);
    expect(bucketViewportHeight(600)).toBe(600);
    expect(bucketViewportHeight(1080)).toBe(1000);
    expect(bucketViewportHeight(1440)).toBe(1200);
    expect(bucketViewportHeight(399)).toBe(0);
  });

  it('reads a negative or non-numeric size as the lowest floor, never a failure', () => {
    expect(bucketViewportWidth(-1)).toBe(0);
    expect(bucketViewportWidth(Number.NaN)).toBe(0);
    expect(bucketViewportHeight(Number.NaN)).toBe(0);
  });

  it('keeps the grammars ascending from 0 so a floor read is unambiguous', () => {
    for (const floors of [TELEMETRY_VIEWPORT_WIDTH_FLOORS, TELEMETRY_VIEWPORT_HEIGHT_FLOORS]) {
      expect(floors[0]).toBe(0);
      expect([...floors]).toEqual([...floors].sort((a, b) => a - b));
      expect(new Set(floors).size).toBe(floors.length);
    }
  });
});

describe('telemetry vocabulary — version majors (S35)', () => {
  it('reads Windows 11 off build 22000 and Windows 10 below it; nothing older is stamped', () => {
    expect(windowsMajorFromVersion('10.0.22631')).toBe(11);
    expect(windowsMajorFromVersion('10.0.22000')).toBe(11);
    expect(windowsMajorFromVersion('10.0.19045')).toBe(10);
    expect(windowsMajorFromVersion('10.0')).toBe(10);
    expect(windowsMajorFromVersion('6.3.9600')).toBeNull();
    expect(windowsMajorFromVersion('')).toBeNull();
  });

  it('reads the Client Hints platformVersion as Windows 11 from 13, Windows 10 from 1, unstamped at 0', () => {
    expect(windowsMajorFromClientHintPlatformVersion('15.0.0')).toBe(11);
    expect(windowsMajorFromClientHintPlatformVersion('13.0.0')).toBe(11);
    expect(windowsMajorFromClientHintPlatformVersion('10.0.0')).toBe(10);
    expect(windowsMajorFromClientHintPlatformVersion('1.0.0')).toBe(10);
    expect(windowsMajorFromClientHintPlatformVersion('0.0.0')).toBeNull();
    expect(windowsMajorFromClientHintPlatformVersion('')).toBeNull();
  });

  it('maps the Darwin kernel major onto the macOS marketing major, including the jump to 26', () => {
    expect(macOsMajorFromDarwinRelease('20.6.0')).toBe(11);
    expect(macOsMajorFromDarwinRelease('23.5.0')).toBe(14);
    expect(macOsMajorFromDarwinRelease('24.1.0')).toBe(15);
    expect(macOsMajorFromDarwinRelease('25.0.0')).toBe(26);
    expect(macOsMajorFromDarwinRelease('26.0.0')).toBe(27);
    expect(macOsMajorFromDarwinRelease('19.6.0')).toBeNull();
    expect(macOsMajorFromDarwinRelease('')).toBeNull();
  });

  it('reads a marketing version by platform — mac as is, win by build, linux never', () => {
    expect(osMajorFromSystemVersion('mac', '15.1')).toBe(15);
    expect(osMajorFromSystemVersion('mac', '26.0.1')).toBe(26);
    expect(osMajorFromSystemVersion('win', '10.0.22631')).toBe(11);
    expect(osMajorFromSystemVersion('win', '10.0.19045')).toBe(10);
    expect(osMajorFromSystemVersion('linux', '6.8.0-45-generic')).toBeNull();
    expect(osMajorFromSystemVersion('mac', '')).toBeNull();
  });

  it('reads the browser major off the UA string by engine; the UA freeze never touched the major', () => {
    const chromeUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const edgeUa = `${chromeUa} Edg/130.0.2849.56`;
    const firefoxUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
    const safariUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
    expect(browserMajorFromUserAgent('chrome', chromeUa)).toBe(130);
    expect(browserMajorFromUserAgent('edge', edgeUa)).toBe(130);
    expect(browserMajorFromUserAgent('firefox', firefoxUa)).toBe(131);
    expect(browserMajorFromUserAgent('safari', safariUa)).toBe(18);
    expect(browserMajorFromUserAgent('other', chromeUa)).toBeNull();
    expect(browserMajorFromUserAgent('chrome', firefoxUa)).toBeNull();
  });

  it('folds the sync facts into the install-wide maximum: server over git over local', () => {
    expect(resolveTelemetrySyncKind({ server: true, git: true })).toBe('server');
    expect(resolveTelemetrySyncKind({ server: false, git: true })).toBe('git');
    expect(resolveTelemetrySyncKind({ server: false, git: false })).toBe('local');
  });
});

describe('telemetry vocabulary — sync pins', () => {
  it('keeps TelemetryRuleTypeId identical to RuleTypeSchema (rule-type growth is a disclosure addition)', () => {
    expect([...TelemetryRuleTypeIdSchema.options]).toEqual([...RuleTypeSchema.options]);
  });

  it('keeps the locale union at the shipped i18n registry (minus pseudo) plus other', () => {
    const shipped = LOCALES.filter((locale) => !locale.synthetic).map((locale) => locale.code);
    expect([...TelemetryLocaleSchema.options]).toEqual([...shipped, 'other']);
  });

  it('keeps the import-source members identical to the detector kinds', () => {
    expect([...TelemetryImportSourceIdSchema.options]).toEqual([
      'curl',
      'url',
      'har',
      'postman',
      'postman-backup',
      'insomnia',
      'bruno',
      'openapi',
      'workspace',
      'graphql-schema',
      'unknown',
    ]);
  });
});

describe('activatedPlanFromLicenseSnapshot', () => {
  const licensed = (overrides: Partial<LicensedSnapshot> = {}): LicensedSnapshot => ({
    status: 'licensed',
    licenseId: 'lic-1',
    licensee: { name: 'Dev' },
    seats: 25,
    entitlements: [],
    validUntil: 1_900_000_000_000,
    graceEndsAt: 1_902_000_000_000,
    ...overrides,
  });

  it('maps a personal-seat artifact to individual and any other verified license to team', () => {
    expect(activatedPlanFromLicenseSnapshot(licensed({ kind: 'personal-seat', seats: 1 }))).toBe('individual');
    expect(activatedPlanFromLicenseSnapshot(licensed())).toBe('team');
    expect(activatedPlanFromLicenseSnapshot(licensed({ status: 'grace' }))).toBe('team');
    expect(activatedPlanFromLicenseSnapshot(licensed({ status: 'expired' }))).toBe('team');
  });

  it('derives nothing from unlicensed or invalid snapshots — no activation, no event', () => {
    expect(activatedPlanFromLicenseSnapshot({ status: 'unlicensed' })).toBeNull();
    expect(activatedPlanFromLicenseSnapshot({ status: 'invalid', reason: 'bad-signature' })).toBeNull();
  });
});

describe('toTelemetryMcpClient', () => {
  it('maps the known agent families by keyword, case-insensitively', () => {
    expect(toTelemetryMcpClient('claude-code')).toBe('claude-code');
    expect(toTelemetryMcpClient('Claude Code')).toBe('claude-code');
    expect(toTelemetryMcpClient('claude-ai')).toBe('claude-desktop');
    expect(toTelemetryMcpClient('Claude Desktop')).toBe('claude-desktop');
    expect(toTelemetryMcpClient('cursor')).toBe('cursor');
    expect(toTelemetryMcpClient('Windsurf')).toBe('windsurf');
    expect(toTelemetryMcpClient('Visual Studio Code')).toBe('vscode');
    expect(toTelemetryMcpClient('vscode')).toBe('vscode');
  });

  it('reads VS Code forks as the fork, not vscode — fork checks run first', () => {
    expect(toTelemetryMcpClient('cursor-vscode')).toBe('cursor');
    expect(toTelemetryMcpClient('windsurf-vscode')).toBe('windsurf');
  });

  it('maps everything unlisted to other, never a raw string', () => {
    expect(toTelemetryMcpClient('mcp-inspector')).toBe('other');
    expect(toTelemetryMcpClient('My Custom Agent/1.0')).toBe('other');
    expect(toTelemetryMcpClient('')).toBe('other');
  });
});

describe('toTelemetryArch', () => {
  it('maps the Node and browser spellings of the two shipped architectures', () => {
    expect(toTelemetryArch('x64')).toBe('x64');
    expect(toTelemetryArch('x86-64')).toBe('x64');
    expect(toTelemetryArch('arm64')).toBe('arm64');
  });

  it('names an x64 process under arm64 translation; translation never applies to a native arm64 one', () => {
    expect(toTelemetryArch('x64', true)).toBe('x64-on-arm64');
    expect(toTelemetryArch('x86-64', true)).toBe('x64-on-arm64');
    expect(toTelemetryArch('arm64', true)).toBe('arm64');
  });

  it('reads everything unlisted as null — unstamped, never the nearest member', () => {
    for (const arch of ['ia32', 'x86-32', 'arm', 'mips', 'ppc64', 's390x', '']) {
      expect(toTelemetryArch(arch)).toBeNull();
      expect(toTelemetryArch(arch, true)).toBeNull();
    }
  });
});

describe('toTelemetryLocale', () => {
  it('passes vocabulary members through and maps everything else to other', () => {
    expect(toTelemetryLocale('en')).toBe('en');
    expect(toTelemetryLocale('fr')).toBe('fr');
    expect(toTelemetryLocale('zh-CN')).toBe('zh-CN');
    expect(toTelemetryLocale('pseudo')).toBe('other');
    expect(toTelemetryLocale('ja')).toBe('ja');
    expect(toTelemetryLocale('ko')).toBe('ko');
    expect(toTelemetryLocale('ru')).toBe('ru');
    expect(toTelemetryLocale('ro')).toBe('ro');
    expect(toTelemetryLocale('pt-BR')).toBe('other');
    expect(toTelemetryLocale('')).toBe('other');
  });
});

describe('parseTelemetryAppVersion', () => {
  it('decomposes CalVer into the numeric triple, without a beta member on stable builds', () => {
    expect(parseTelemetryAppVersion('2026.7.3')).toEqual({ year: 2026, month: 7, patch: 3 });
  });

  it('zeroes malformed or missing segments instead of failing', () => {
    expect(parseTelemetryAppVersion('2026.7')).toEqual({ year: 2026, month: 7, patch: 0 });
    expect(parseTelemetryAppVersion('dev')).toEqual({ year: 0, month: 0, patch: 0 });
  });

  it('reads the -beta.N pre-release tag as the beta iteration — the release train rides the version', () => {
    expect(parseTelemetryAppVersion('2026.8.0-beta.2')).toEqual({ year: 2026, month: 8, patch: 0, beta: 2 });
    expect(parseTelemetryAppVersion('2026.8.0-beta')).toEqual({ year: 2026, month: 8, patch: 0, beta: 1 });
    expect(parseTelemetryAppVersion('2026.8.0-nightly.1')).toEqual({ year: 2026, month: 8, patch: 0 });
  });

  it('round-trips a beta appVersion through the session_start schema', () => {
    const event = {
      name: 'session_start',
      host: 'desktop',
      appVersion: { year: 2026, month: 8, patch: 0, beta: 2 },
      platform: 'win',
      locale: 'en',
    };
    expect(v.parse(TelemetryEventSchema, event)).toEqual(event);
  });
});
