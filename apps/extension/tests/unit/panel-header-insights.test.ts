import { computeHeaderInsights, type HeaderInsight } from '@openheaders/ui/panel/data/header-insights';
import { describe, expect, it } from 'vitest';

function h(name: string, value: string) {
  return { name, value };
}

function findInsight(insights: readonly HeaderInsight[], id: string): HeaderInsight | undefined {
  return insights.find((i) => i.id === id);
}

describe('computeHeaderInsights', () => {
  it('flags CORS wildcard + credentials with an override action', () => {
    const out = computeHeaderInsights({
      url: 'https://api.openheaders.io/v1',
      mimeType: 'application/json',
      statusCode: 200,
      requestHeaders: [h('Origin', 'https://app.openheaders.io')],
      responseHeaders: [
        h('Access-Control-Allow-Origin', '*'),
        h('Access-Control-Allow-Credentials', 'true'),
      ],
    });
    const ins = findInsight(out, 'cors-wildcard-with-creds');
    expect(ins?.severity).toBe('err');
    expect(ins?.action?.kind).toBe('override-header');
    if (ins?.action?.kind === 'override-header') {
      expect(ins.action.value).toBe('https://app.openheaders.io');
    }
  });

  it('flags CORS request with no Access-Control-Allow-Origin', () => {
    const out = computeHeaderInsights({
      url: 'https://api.openheaders.io/v1',
      mimeType: 'application/json',
      statusCode: 200,
      requestHeaders: [h('Origin', 'https://app.openheaders.io')],
      responseHeaders: [],
    });
    const ins = findInsight(out, 'cors-missing-acao');
    expect(ins?.severity).toBe('warn');
    expect(ins?.action?.kind).toBe('add-header');
  });

  it('does not flag missing CSP / HSTS for non-HTML responses', () => {
    const out = computeHeaderInsights({
      url: 'https://api.openheaders.io/v1',
      mimeType: 'application/json',
      statusCode: 200,
      requestHeaders: [],
      responseHeaders: [],
    });
    expect(findInsight(out, 'missing-csp')).toBeUndefined();
    expect(findInsight(out, 'missing-hsts')).toBeUndefined();
  });

  it('flags missing CSP and HSTS on HTML HTTPS responses', () => {
    const out = computeHeaderInsights({
      url: 'https://www.openheaders.io',
      mimeType: 'text/html; charset=utf-8',
      statusCode: 200,
      requestHeaders: [],
      responseHeaders: [],
    });
    expect(findInsight(out, 'missing-csp')?.severity).toBe('warn');
    expect(findInsight(out, 'missing-hsts')?.severity).toBe('warn');
  });

  it('flags cookies missing Secure over HTTPS', () => {
    const out = computeHeaderInsights({
      url: 'https://www.openheaders.io',
      mimeType: 'text/html',
      statusCode: 200,
      requestHeaders: [],
      responseHeaders: [h('Set-Cookie', 'a=1; HttpOnly; SameSite=Lax'), h('Set-Cookie', 'b=2; Secure; HttpOnly')],
    });
    const ins = findInsight(out, 'cookie-missing-secure');
    expect(ins?.severity).toBe('warn');
    expect(ins?.title).toMatch(/`a`/);
  });

  it('produces a cache summary for max-age', () => {
    const out = computeHeaderInsights({
      url: 'https://api.openheaders.io/x',
      mimeType: 'application/json',
      statusCode: 200,
      requestHeaders: [],
      responseHeaders: [h('Cache-Control', 'public, max-age=3600')],
    });
    expect(findInsight(out, 'cache-summary')?.title).toBe('Cache: fresh 1h');
  });

  it('decodes a JWT in the Authorization header and reports exp', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const exp = 1_700_000_000;
    const payload = Buffer.from(JSON.stringify({ sub: 'u', exp })).toString('base64url');
    const out = computeHeaderInsights(
      {
        url: 'https://api.openheaders.io/me',
        mimeType: 'application/json',
        statusCode: 200,
        requestHeaders: [h('Authorization', `Bearer ${header}.${payload}.sig`)],
        responseHeaders: [],
      },
      exp * 1000 - 3600 * 1000,
    );
    const info = findInsight(out, 'jwt-info');
    expect(info?.title).toMatch(/RS256/);
    expect(info?.title).toMatch(/1h/);
  });

  it('flags expired JWT as err', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const exp = 1_700_000_000;
    const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
    const out = computeHeaderInsights(
      {
        url: 'https://api.openheaders.io/x',
        mimeType: 'application/json',
        statusCode: 401,
        requestHeaders: [h('Authorization', `Bearer ${header}.${payload}.sig`)],
        responseHeaders: [],
      },
      exp * 1000 + 60_000,
    );
    expect(findInsight(out, 'jwt-expired')?.severity).toBe('err');
  });

  it('reports compression encoding', () => {
    const out = computeHeaderInsights({
      url: 'https://www.openheaders.io',
      mimeType: 'text/html',
      statusCode: 200,
      requestHeaders: [],
      responseHeaders: [h('Content-Encoding', 'br'), h('Content-Security-Policy', "default-src 'self'"), h('Strict-Transport-Security', 'max-age=31536000')],
    });
    expect(findInsight(out, 'compression')?.title).toBe('Compressed: br');
  });
});
