/**
 * Projection-boundary redaction (the agent-traffic plan §4, slice S2).
 *
 * The record→projection mapping is the ONLY place records become
 * readable, so redaction pinned here is redaction everywhere: a raw
 * secret retained from the wire must never appear in a snapshot, and
 * the reveal escalation is an explicit per-call opt-in the tap
 * time-boxes — never a default.
 */

import { redactionMarker } from '@openheaders/core/traffic';
import { describe, expect, it } from 'vitest';
import { TrafficRetentionConsumer, TrafficRetentionRing } from '../../src/traffic-retention';
import { makeLifecycle } from './factories';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';
const COOKIE_SECRET = 'oh_session_9f8e7d6c5b4a39281706';

function rigWithSecretRecord() {
  const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 64 * 1024 });
  const consumer = new TrafficRetentionConsumer({ ring });
  consumer.handle({ kind: 'ready', tabId: 1, watermarkMs: 0 });
  consumer.handle({
    kind: 'lifecycle-update',
    update: {
      kind: 'started',
      lifecycle: makeLifecycle({
        url: `https://api.openheaders.io/users?access_token=${JWT}&tag=probe`,
        requestHeaders: [
          { name: 'Authorization', value: `Bearer ${JWT}` },
          { name: 'Cookie', value: `sid=${COOKIE_SECRET}` },
          { name: 'Accept', value: 'application/json' },
        ],
        responseHeaders: [
          { name: 'Set-Cookie', value: `sid=${COOKIE_SECRET}; Path=/; HttpOnly` },
          { name: 'Content-Type', value: 'application/json' },
        ],
      }),
    },
  });
  return { ring, consumer };
}

describe('snapshot redaction', () => {
  it('no raw secret survives the default projection — anywhere in the payload', () => {
    const { ring } = rigWithSecretRecord();
    const serialized = JSON.stringify(ring.snapshot());
    expect(serialized).not.toContain(JWT);
    expect(serialized).not.toContain(COOKIE_SECRET);
  });

  it('markers are stable per value across positions and preserve structure', () => {
    const { ring } = rigWithSecretRecord();
    const [record] = ring.snapshot();
    const jwtMarker = redactionMarker(JWT);
    expect(record?.url).toBe(`https://api.openheaders.io/users?access_token=${jwtMarker}&tag=probe`);
    expect(record?.requestHeaders?.find((h) => h.name === 'Authorization')?.value).toBe(`Bearer ${jwtMarker}`);
    expect(record?.requestHeaders?.find((h) => h.name === 'Cookie')?.value).toBe(
      `sid=${redactionMarker(COOKIE_SECRET)}`,
    );
    expect(record?.requestHeaders?.find((h) => h.name === 'Accept')?.value).toBe('application/json');
    expect(record?.responseHeaders?.find((h) => h.name === 'Set-Cookie')?.value).toBe(
      `sid=${redactionMarker(COOKIE_SECRET)}; Path=/; HttpOnly`,
    );
  });

  it('redirect-trail hop URLs redact like url and initiator — the trail is not a side door', () => {
    const { ring, consumer } = rigWithSecretRecord();
    consumer.handle({
      kind: 'lifecycle-update',
      update: {
        kind: 'redirect',
        tabId: 1,
        requestId: 'req-1',
        hop: {
          sourceUrl: `https://api.openheaders.io/users?access_token=${JWT}&tag=probe`,
          redirectUrl: 'https://api.openheaders.io/final',
          statusCode: 302,
          timestampMs: 1_050,
        },
        nextUrl: 'https://api.openheaders.io/final',
      },
    });
    const [record] = ring.snapshot();
    expect(record?.redirectTrail?.[0]?.url).toBe(
      `https://api.openheaders.io/users?access_token=${redactionMarker(JWT)}&tag=probe`,
    );
    expect(JSON.stringify(ring.snapshot())).not.toContain(JWT);
    // The reveal escalation opens the trail too — one boundary, one law.
    expect(JSON.stringify(ring.snapshot({ revealSecrets: true }))).toContain(JWT);
  });

  it('revealSecrets projects raw values — the escalation seam, never the default', () => {
    const { ring } = rigWithSecretRecord();
    const serialized = JSON.stringify(ring.snapshot({ revealSecrets: true }));
    expect(serialized).toContain(JWT);
    expect(serialized).toContain(COOKIE_SECRET);
    // The next default read is redacted again — reveal is per call.
    expect(JSON.stringify(ring.snapshot())).not.toContain(JWT);
  });
});
