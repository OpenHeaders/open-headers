import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { DetectedImportSource } from '../../src/import/detect';
import { RuleTypeSchema } from '../../src/schemas/rule';
import {
  bucketScale,
  bucketSinceInstall,
  parseTelemetryAppVersion,
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryEnvelope,
  TelemetryEnvelopeSchema,
  type TelemetryEvent,
  TelemetryEventSchema,
  type TelemetryImportSourceId,
  TelemetryImportSourceIdSchema,
  TelemetryInstallIdSchema,
  TelemetryRuleTypeIdSchema,
  TelemetrySessionIdSchema,
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
  { name: 'rule_created', ruleType: 'header' },
  { name: 'import_run', source: 'postman', ok: true },
  { name: 'workflow_run', ok: false },
  { name: 'error_beacon', code: 'ws-connect-failed' },
];

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

  it('round-trips a batch envelope', () => {
    const envelope: TelemetryEnvelope = {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      host: 'extension',
      sessionId: SESSION_ID,
      installId: INSTALL_ID,
      sinceInstall: '2-7',
      sentAt: 1_760_000_000_000,
      events: SAMPLE_EVENTS,
    };
    const parsed = v.parse(TelemetryEnvelopeSchema, JSON.parse(JSON.stringify(envelope)));
    expect(parsed).toEqual(envelope);
  });

  it('accepts an envelope without the optional host (schema-v2 clients built before the field)', () => {
    const envelope = {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
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
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
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
    for (const schemaVersion of [1, 3]) {
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

  it('rejects a precise sinceInstall day count — buckets only', () => {
    const envelope = {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
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

  it('buckets entity counts coarsely', () => {
    expect(bucketScale(0)).toBe('0');
    expect(bucketScale(1)).toBe('1-5');
    expect(bucketScale(5)).toBe('1-5');
    expect(bucketScale(6)).toBe('6-20');
    expect(bucketScale(20)).toBe('6-20');
    expect(bucketScale(21)).toBe('21+');
    expect(bucketScale(-3)).toBe('0');
  });
});

describe('telemetry vocabulary — sync pins', () => {
  it('keeps TelemetryRuleTypeId identical to RuleTypeSchema (rule-type growth is a disclosure addition)', () => {
    expect([...TelemetryRuleTypeIdSchema.options]).toEqual([...RuleTypeSchema.options]);
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
      'unknown',
    ]);
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
