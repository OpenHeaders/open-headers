/**
 * JWT buffer scanning + the Monaco link plane's pure parts. Pins:
 *   - `scanForJWTs` finds structurally valid tokens (and only those)
 *     inside larger text with correct offsets;
 *   - dotted runs longer than three segments never match;
 *   - `buildJwtLinks` maps hits onto Monaco ranges + oh-jwt urls;
 *   - `parseJwtLinkUrl` round-trips the url and rejects malformed input;
 *   - the provider/opener registration routes a link click to the
 *     attached model handler with the clicked token.
 */

import {
  attachJwtEditTarget,
  buildJwtLinks,
  type JwtLinkTarget,
  parseJwtLinkUrl,
  registerJwtLinkPlane,
  scanForJWTs,
} from '@openheaders/ui/workbench/components/value-editors';
import type * as monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

function buildJWT(header: object, payload: object, sig = 'fakesig'): string {
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encode(header)}.${encode(payload)}.${sig}`;
}

const HEADER = { alg: 'HS256', typ: 'JWT' };
const TOKEN = buildJWT(HEADER, { sub: 'user@openheaders.io' });

describe('scanForJWTs', () => {
  it('finds a token inside a JSON body with correct offsets', () => {
    const text = `{\n  "auth": "${TOKEN}",\n  "url": "https://api.openheaders.io"\n}`;
    const hits = scanForJWTs(text);
    expect(hits).toHaveLength(1);
    expect(hits[0].token).toBe(TOKEN);
    expect(text.slice(hits[0].start, hits[0].end)).toBe(TOKEN);
  });

  it('finds multiple tokens in document order', () => {
    const second = buildJWT(HEADER, { sub: 'admin@openheaders.io' }, 'othersig');
    const hits = scanForJWTs(`${TOKEN}\nplain text\n${second}`);
    expect(hits.map((h) => h.token)).toEqual([TOKEN, second]);
  });

  it('finds the bare token after a Bearer prefix', () => {
    const hits = scanForJWTs(`{"authorization": "Bearer ${TOKEN}"}`);
    expect(hits).toHaveLength(1);
    expect(hits[0].token).toBe(TOKEN);
  });

  it('rejects dotted runs of more than three segments', () => {
    expect(scanForJWTs(`${TOKEN}.extra`)).toHaveLength(0);
    expect(scanForJWTs(`prefix.${TOKEN}`)).toHaveLength(0);
  });

  it('ignores three-segment strings that are not JWTs', () => {
    expect(scanForJWTs('window.location.href = api.openheaders.io')).toHaveLength(0);
    expect(scanForJWTs('{{env.API_TOKEN}}')).toHaveLength(0);
  });

  it('returns nothing for empty text', () => {
    expect(scanForJWTs('')).toHaveLength(0);
  });
});

// Offset → line/column helper matching Monaco's 1-based semantics.
function makeModelStub(text: string) {
  return {
    uri: { toString: () => 'inmemory://model/test' },
    getValue: () => text,
    getPositionAt: (offset: number) => {
      const before = text.slice(0, offset);
      const lines = before.split('\n');
      return { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
    },
  };
}

describe('buildJwtLinks', () => {
  it('maps hits onto ranges and oh-jwt urls carrying the registration id', () => {
    const text = `line one\n"token": "${TOKEN}"`;
    const links = buildJwtLinks(makeModelStub(text), 42);
    expect(links).toHaveLength(1);
    expect(links[0].tooltip).toBe('Edit JWT');
    expect(links[0].range.startLineNumber).toBe(2);
    expect(links[0].range.endLineNumber).toBe(2);
    expect(links[0].range.startColumn).toBe('"token": "'.length + 1);
    const parsed = parseJwtLinkUrl(links[0].url.slice('oh-jwt:'.length));
    expect(parsed).toEqual({ id: 42, start: text.indexOf(TOKEN), end: text.indexOf(TOKEN) + TOKEN.length });
  });
});

describe('parseJwtLinkUrl', () => {
  it('rejects malformed paths', () => {
    expect(parseJwtLinkUrl('1/2')).toBeNull();
    expect(parseJwtLinkUrl('a/b/c')).toBeNull();
    expect(parseJwtLinkUrl('1/10/5')).toBeNull();
    expect(parseJwtLinkUrl('1/-1/5')).toBeNull();
  });
});

describe('registerJwtLinkPlane + attachJwtEditTarget', () => {
  it('routes a link click on an attached model to its handler', () => {
    let provider: { provideLinks: (model: unknown) => { links: Array<{ url: string }> } } | undefined;
    let opener: { open: (resource: { scheme: string; path: string }) => boolean } | undefined;
    const fakeMonaco = {
      languages: {
        registerLinkProvider: (_selector: string, p: typeof provider) => {
          provider = p;
          return { dispose: vi.fn() };
        },
      },
      editor: {
        registerLinkOpener: (o: typeof opener) => {
          opener = o;
          return { dispose: vi.fn() };
        },
      },
    };
    registerJwtLinkPlane(fakeMonaco as unknown as typeof monaco);
    expect(provider).toBeDefined();
    expect(opener).toBeDefined();

    const text = `{"auth": "${TOKEN}"}`;
    const model = makeModelStub(text);
    const onOpen = vi.fn();
    const detach = attachJwtEditTarget(model as unknown as monaco.editor.ITextModel, onOpen);

    const { links } = provider!.provideLinks(model);
    expect(links).toHaveLength(1);

    const handled = opener!.open({ scheme: 'oh-jwt', path: links[0].url.slice('oh-jwt:'.length) });
    expect(handled).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const target = onOpen.mock.calls[0][0] as JwtLinkTarget;
    expect(target.token).toBe(TOKEN);
    expect(text.slice(target.start, target.end)).toBe(TOKEN);

    // Foreign schemes fall through to the default opener chain.
    expect(opener!.open({ scheme: 'https', path: '/openheaders.io' })).toBe(false);

    // A detached model stops producing links and swallows stale clicks.
    detach();
    expect(provider!.provideLinks(model).links).toHaveLength(0);
    onOpen.mockClear();
    opener!.open({ scheme: 'oh-jwt', path: links[0].url.slice('oh-jwt:'.length) });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
