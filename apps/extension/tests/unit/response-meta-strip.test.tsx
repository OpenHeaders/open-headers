// @vitest-environment jsdom
/**
 * ResponseMetaStrip tags — the per-run policy tags beside status/time/
 * size. Warning tags mark trust-relaxing policies the send ran under
 * (unverified TLS, lowered TLS floor, Authorization forwarded); the
 * cookie-jar tag is ATTRIBUTION — neutral tone — shown when the
 * snapshot recorded jar activity (`cookieHeaderAttached` /
 * `cookiesCaptured`), never read from live jar state.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import ResponseMetaStrip from '@openheaders/ui/workbench/components/request-editor/response/ResponseMetaStrip';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

function makeSnapshot(overrides: Partial<ExecutedRequestSnapshot> = {}): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: '{}',
    bodyTruncated: false,
    bodyBytes: 2,
    durationMs: 42,
    error: null,
    ...overrides,
  };
}

function renderStrip(overrides: Partial<ExecutedRequestSnapshot> = {}) {
  return render(<ResponseMetaStrip response={makeSnapshot(overrides)} statusColor="#37be5f" />);
}

describe('ResponseMetaStrip cookie-jar attribution', () => {
  it('shows no cookie-jar tag on a run without jar activity', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-cookie-jar')).toBeNull();
  });

  it('tags a run whose jar attached a Cookie header', () => {
    renderStrip({ cookieHeaderAttached: 'session=abc123' });
    expect(screen.getByTestId('oh-response-cookie-jar').textContent).toBe('Cookie jar');
  });

  it('tags a run whose jar only stored cookies', () => {
    renderStrip({ cookiesCaptured: ['session', 'theme'] });
    expect(screen.getByTestId('oh-response-cookie-jar')).toBeTruthy();
  });

  it('renders the jar tag neutral, unlike the warning-toned policy tags', () => {
    renderStrip({ cookieHeaderAttached: 'session=abc123', authorizationForwarded: true });
    expect(screen.getByTestId('oh-response-cookie-jar').className).not.toContain('ant-tag-warning');
    expect(screen.getByTestId('oh-response-auth-forwarded').className).toContain('ant-tag-warning');
  });

  it('shows no policy tags at all on a plain run', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-tls-unverified')).toBeNull();
    expect(screen.queryByTestId('oh-response-tls-floor-lowered')).toBeNull();
    expect(screen.queryByTestId('oh-response-auth-forwarded')).toBeNull();
  });
});
