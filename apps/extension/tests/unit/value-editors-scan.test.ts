/**
 * JWT buffer scanning + the Monaco link plane's pure parts. Pins:
 *   - `scanForJWTs` finds structurally valid tokens (and only those)
 *     inside larger text with correct offsets;
 *   - dotted runs longer than three segments never match;
 *   - `buildJwtLinks` maps hits onto Monaco ranges + `command:` urls;
 *   - the provider/command registration routes a link activation to
 *     the attached model handler with the clicked token.
 */

import {
  attachJwtEditTarget,
  buildJwtLinks,
  JWT_EDIT_COMMAND,
  type JwtLinkTarget,
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
  it('maps hits onto ranges and command urls carrying the registration id + offsets', () => {
    const text = `line one\n"token": "${TOKEN}"`;
    const links = buildJwtLinks(makeModelStub(text), 42);
    expect(links).toHaveLength(1);
    expect(links[0].tooltip).toBe('Edit JWT');
    expect(links[0].range.startLineNumber).toBe(2);
    expect(links[0].range.endLineNumber).toBe(2);
    expect(links[0].range.startColumn).toBe('"token": "'.length + 1);
    const start = text.indexOf(TOKEN);
    expect(links[0].url).toBe(
      `command:${JWT_EDIT_COMMAND}?${encodeURIComponent(JSON.stringify([42, start, start + TOKEN.length]))}`,
    );
  });
});

describe('registerJwtLinkPlane + attachJwtEditTarget', () => {
  it('routes the edit command on an attached model to its handler', () => {
    let provider: { provideLinks: (model: unknown) => { links: Array<{ url: string }> } } | undefined;
    let command: ((accessor: unknown, ...args: number[]) => void) | undefined;
    const fakeMonaco = {
      languages: {
        registerLinkProvider: (_selector: string, p: typeof provider) => {
          provider = p;
          return { dispose: vi.fn() };
        },
      },
      editor: {
        registerCommand: (id: string, handler: typeof command) => {
          expect(id).toBe(JWT_EDIT_COMMAND);
          command = handler;
          return { dispose: vi.fn() };
        },
      },
    };
    registerJwtLinkPlane(fakeMonaco as unknown as typeof monaco);
    expect(provider).toBeDefined();
    expect(command).toBeDefined();

    const text = `{"auth": "${TOKEN}"}`;
    const model = makeModelStub(text);
    const onOpen = vi.fn();
    const detach = attachJwtEditTarget(model as unknown as monaco.editor.ITextModel, onOpen);

    const { links } = provider!.provideLinks(model);
    expect(links).toHaveLength(1);
    const args = JSON.parse(decodeURIComponent(links[0].url.split('?')[1])) as number[];

    command!(null, ...args);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const target = onOpen.mock.calls[0][0] as JwtLinkTarget;
    expect(target.token).toBe(TOKEN);
    expect(text.slice(target.start, target.end)).toBe(TOKEN);

    // Stale offsets (buffer moved under a link) are swallowed.
    onOpen.mockClear();
    command!(null, args[0], args[1] + 3, args[2]);
    expect(onOpen).not.toHaveBeenCalled();

    // A detached model stops producing links and swallows stale commands.
    detach();
    expect(provider!.provideLinks(model).links).toHaveLength(0);
    command!(null, ...args);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
