import { getTranslator } from '@openheaders/i18n';
import { computeCookieInsights, problemCookieNames } from '@openheaders/ui/panel/data/cookies/cookie-insights';
import type { CookieRow } from '@openheaders/ui/panel/data/cookies/cookie-model';
import { describe, expect, it } from 'vitest';

const NOW = Date.UTC(2026, 4, 18, 23, 0, 0);

function row(over: Partial<CookieRow> = {}): CookieRow {
  return {
    name: 'session',
    value: 'v',
    direction: 'response',
    attribution: 'response-set',
    id: 'r:1',
    size: 10,
    ...over,
  };
}

const t = getTranslator('en');

describe('computeCookieInsights', () => {
  it('flags SameSite=None without Secure', () => {
    const insights = computeCookieInsights(t, {
      url: 'https://openheaders.io/',
      request: [],
      response: [row({ name: 's', sameSite: 'no_restriction', secure: false })],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.some((i) => i.id === 'samesite-none-no-secure')).toBe(true);
  });

  it('flags __Host- prefix violations', () => {
    const insights = computeCookieInsights(t, {
      url: 'https://openheaders.io/',
      request: [],
      response: [row({ name: '__Host-a', secure: false, path: '/' })],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.some((i) => i.id === 'host-prefix-violation')).toBe(true);
  });

  it('flags __Secure- prefix without Secure', () => {
    const insights = computeCookieInsights(t, {
      url: 'https://openheaders.io/',
      request: [],
      response: [row({ name: '__Secure-a', secure: false })],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.some((i) => i.id === 'secure-prefix-violation')).toBe(true);
  });

  it('flags expired but still sent', () => {
    const insights = computeCookieInsights(t, {
      url: 'https://openheaders.io/',
      request: [
        row({
          direction: 'request',
          attribution: 'request-jar',
          expirationDate: Math.floor(NOW / 1000) - 60,
        }),
      ],
      response: [],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.some((i) => i.id === 'expired-but-sent')).toBe(true);
  });

  it('flags oversized cookie payload', () => {
    const big = Array.from({ length: 10 }, (_, i) =>
      row({ direction: 'request', attribution: 'request-har', name: `c${i}`, size: 500 }),
    );
    const insights = computeCookieInsights(t, {
      url: 'https://openheaders.io/',
      request: big,
      response: [],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.some((i) => i.id === 'oversized-cookie-payload')).toBe(true);
  });

  it('flags third-party cookies set', () => {
    const insights = computeCookieInsights(t, {
      url: 'https://tracker.example.com/p',
      request: [],
      response: [row({ name: 'tp', secure: true, domain: '.tracker.example.com' })],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.some((i) => i.id === 'third-party-set')).toBe(true);
  });

  it('problemCookieNames lifts every cookieNames entry', () => {
    const set = problemCookieNames([
      { id: 'x', severity: 'warn', title: '', cookieNames: ['a', 'b'] },
      { id: 'y', severity: 'err', title: '', cookieNames: ['b', 'c'] },
    ]);
    expect([...set].sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps the insight list small even with many problems', () => {
    const insights = computeCookieInsights(t, {
      url: 'https://openheaders.io/',
      request: [],
      response: [
        row({ name: '__Host-bad', secure: false }),
        row({ name: '__Secure-bad', secure: false }),
        row({ name: 'sn', sameSite: 'no_restriction', secure: false }),
      ],
      pageOrigin: 'https://openheaders.io',
      now: NOW,
    });
    expect(insights.length).toBeLessThanOrEqual(5);
  });
});
