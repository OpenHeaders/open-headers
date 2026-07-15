import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { DetectedImportSource } from '../../src/import/detect';
import { RuleTypeSchema } from '../../src/schemas/rule';
import {
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryEnvelope,
  TelemetryEnvelopeSchema,
  type TelemetryEvent,
  TelemetryEventSchema,
  type TelemetryImportSourceId,
  TelemetryImportSourceIdSchema,
  TelemetryRuleTypeIdSchema,
  TelemetrySessionIdSchema,
} from '../../src/telemetry';

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

// Compile-time pin: the telemetry import-source union tracks the detector's
// kind union exactly — divergence fails typecheck, making growth deliberate.
const importSourcesMatchDetector: MutuallyAssignable<TelemetryImportSourceId, DetectedImportSource['kind']> = true;

const SESSION_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';

const SAMPLE_EVENTS: TelemetryEvent[] = [
  {
    name: 'session_start',
    host: 'extension',
    appVersion: { year: 2026, month: 7, patch: 0 },
    platform: 'mac',
    browser: 'chrome',
    locale: 'en',
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
      sessionId: SESSION_ID,
      sentAt: 1_760_000_000_000,
      events: SAMPLE_EVENTS,
    };
    const parsed = v.parse(TelemetryEnvelopeSchema, JSON.parse(JSON.stringify(envelope)));
    expect(parsed).toEqual(envelope);
  });

  it('accepts session_start without the optional browser (desktop, cli)', () => {
    const event = {
      name: 'session_start',
      host: 'cli',
      appVersion: { year: 2026, month: 7, patch: 1 },
      platform: 'linux',
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
      sentAt: 1,
      events: [],
      installId: 'abc',
    };
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
  });

  it('rejects an unsupported schemaVersion', () => {
    const envelope = { schemaVersion: 2, sessionId: SESSION_ID, sentAt: 1, events: [] };
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(false);
  });

  const BAD_SESSION_IDS: Array<[string, string]> = [
    ['too short', 'abc123'],
    ['uppercase hex', SESSION_ID.toUpperCase()],
    ['non-hex alphabet', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'],
    ['arbitrary text', 'user@openheaders.io-was-here-now'],
  ];

  for (const [label, sessionId] of BAD_SESSION_IDS) {
    it(`rejects a session id with ${label}`, () => {
      expect(v.safeParse(TelemetrySessionIdSchema, sessionId).success).toBe(false);
    });
  }
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
      'workspace',
      'unknown',
    ]);
  });
});
