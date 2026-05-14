import { formatHttpVersion } from '@openheaders/ui/panel/data/http-version';
import { describe, expect, it } from 'vitest';

describe('formatHttpVersion', () => {
  it.each([
    // Already-friendly labels pass through, uppercased.
    ['HTTP/1.0', 'HTTP/1.0'],
    ['HTTP/1.1', 'HTTP/1.1'],
    ['http/1.1', 'HTTP/1.1'],
    ['HTTP/2', 'HTTP/2'],
    ['HTTP/3', 'HTTP/3'],
    // ALPN IDs for HTTP/2.
    ['h2', 'HTTP/2'],
    ['h2c', 'HTTP/2'],
    // ALPN IDs for HTTP/3 — the ones that actually ship on the wire
    // today (draft tags) plus the final identifier.
    ['h3', 'HTTP/3'],
    ['h3-29', 'HTTP/3'],
    ['h3-Q050', 'HTTP/3'],
    ['H3', 'HTTP/3'],
    // Chrome's legacy label.
    ['http/2+quic/99', 'HTTP/3'],
    // SPDY — rare but preserve the version tag.
    ['spdy/3.1', 'SPDY (spdy/3.1)'],
    // Empty / missing → empty.
    ['', ''],
    [undefined, ''],
    [null, ''],
    // Unknown → pass through.
    ['FUTURE/7', 'FUTURE/7'],
  ])('%s -> %s', (raw, expected) => {
    expect(formatHttpVersion(raw as string | undefined | null)).toBe(expected);
  });
});
