/**
 * The body plane (AGENT_TRAFFIC_PLAN.md §3, slice S3): capture caps
 * honestly, projection redacts at the boundary, base64 rides verbatim
 * so binary round-trips — and the on-demand pull path shapes bodies
 * through the same module as the retained carve-out.
 */

import { redactionMarker, TRAFFIC_BODY_CAP_CHARS } from '@openheaders/core/traffic';
import type { InspectorHarBody } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { captureBody, projectBody, projectPulledBody } from '../../src/traffic-retention/body';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';

function harBody(overrides: Partial<InspectorHarBody> = {}): InspectorHarBody {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/users',
    startedDateTime: '2026-08-03T10:00:00.000Z',
    content: '{"ok":true}',
    encoding: '',
    ...overrides,
  };
}

describe('captureBody', () => {
  it('keeps small text bodies whole and unflagged', () => {
    const captured = captureBody(harBody());
    expect(captured).toEqual({ content: '{"ok":true}', encoding: 'text', truncated: false });
  });

  it('caps text at the shared ceiling and flags truncation', () => {
    const captured = captureBody(harBody({ content: 'x'.repeat(TRAFFIC_BODY_CAP_CHARS + 5) }));
    expect(captured.content).toHaveLength(TRAFFIC_BODY_CAP_CHARS);
    expect(captured.truncated).toBe(true);
  });

  it('caps base64 on a 4-char boundary so the kept prefix stays decodable', () => {
    const captured = captureBody(harBody({ content: 'A'.repeat(TRAFFIC_BODY_CAP_CHARS + 6), encoding: 'base64' }));
    expect(captured.encoding).toBe('base64');
    expect(captured.content.length % 4).toBe(0);
    expect(captured.content.length).toBeLessThanOrEqual(TRAFFIC_BODY_CAP_CHARS);
    expect(captured.truncated).toBe(true);
  });
});

describe('projectBody / projectPulledBody', () => {
  it('redacts token shapes in text content with the stable marker', () => {
    const projected = projectPulledBody(harBody({ content: `{"token":"${JWT}"}` }));
    expect(projected.content).not.toContain(JWT);
    expect(projected.content).toContain(redactionMarker(JWT));
  });

  it('honors the reveal escalation option', () => {
    const projected = projectPulledBody(harBody({ content: `{"token":"${JWT}"}` }), { revealSecrets: true });
    expect(projected.content).toContain(JWT);
  });

  it('leaves base64 content verbatim — binary must not corrupt', () => {
    // A base64 blob IS one giant token-shaped run; the text scan must
    // never touch it.
    const blob = Buffer.from(`binary-carrier-${JWT}`).toString('base64');
    const projected = projectBody({ content: blob, encoding: 'base64', truncated: false });
    expect(projected.content).toBe(blob);
  });
});
