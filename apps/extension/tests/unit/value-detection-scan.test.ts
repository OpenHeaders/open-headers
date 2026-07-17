/**
 * JWT buffer scanning + the Monaco link plane's pure parts. Pins:
 *   - `scanForJWTs` finds structurally valid tokens (and only those)
 *     inside larger text with correct offsets;
 *   - dotted runs longer than three segments never match;
 *   - `buildJwtDecorations` maps hits onto Monaco ranges + trusted
 *     hover markdown carrying the edit `command:` link;
 *   - the command registration routes an activation to the attached
 *     model handler with the clicked token.
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { scanForJWTs } from '@openheaders/ui/shared/value-detection';
import {
  attachJwtEditTarget,
  buildJwtDecorations,
  JWT_EDIT_COMMAND,
  JWT_LINK_CLASS,
  type JwtLinkTarget,
  registerJwtLinkPlane,
} from '@openheaders/ui/workbench/components/value-editors';
import type * as monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

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

  it('rejects runs with adjacent, leading or trailing dots', () => {
    expect(scanForJWTs('a..b.c')).toHaveLength(0);
    expect(scanForJWTs(`.${TOKEN}`)).toHaveLength(0);
    expect(scanForJWTs(`${TOKEN}.`)).toHaveLength(0);
  });

  it('returns nothing for empty text', () => {
    expect(scanForJWTs('')).toHaveLength(0);
  });

  it('stays linear on a long dotless base64 run (inline-sourcemap freeze regression)', () => {
    // A captured .js body carrying a ~300 kB base64 inline sourcemap:
    // the old regex scan re-consumed the run from every start position
    // (O(n²), a multi-second panel freeze); the charcode pass is O(n).
    const sourcemapRun = 'A'.repeat(300 * 1024);
    const text = `//# sourceMappingURL=data:application/json;base64,${sourcemapRun}\nconst t = "${TOKEN}";`;
    const started = performance.now();
    const hits = scanForJWTs(text);
    expect(performance.now() - started).toBeLessThan(500);
    expect(hits.map((h) => h.token)).toEqual([TOKEN]);
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

describe('buildJwtDecorations', () => {
  it('maps hits onto ranges with a trusted hover carrying the edit command', () => {
    const text = `line one\n"token": "${TOKEN}"`;
    const decorations = buildJwtDecorations(makeModelStub(text), 42, 'edit', t);
    expect(decorations).toHaveLength(1);
    expect(decorations[0].options.inlineClassName).toBe(JWT_LINK_CLASS);
    expect(decorations[0].range.startLineNumber).toBe(2);
    expect(decorations[0].range.endLineNumber).toBe(2);
    expect(decorations[0].range.startColumn).toBe('"token": "'.length + 1);
    const start = text.indexOf(TOKEN);
    const url = `command:${JWT_EDIT_COMMAND}?${encodeURIComponent(JSON.stringify([42, start, start + TOKEN.length]))}`;
    expect(decorations[0].options.hoverMessage.isTrusted).toBe(true);
    expect(decorations[0].options.hoverMessage.value).toContain(`[Edit JWT](${url})`);
  });

  it('labels the hover link "View JWT" in view mode, same command wiring', () => {
    const text = `"token": "${TOKEN}"`;
    const decorations = buildJwtDecorations(makeModelStub(text), 7, 'view', t);
    expect(decorations).toHaveLength(1);
    const start = text.indexOf(TOKEN);
    const url = `command:${JWT_EDIT_COMMAND}?${encodeURIComponent(JSON.stringify([7, start, start + TOKEN.length]))}`;
    expect(decorations[0].options.hoverMessage.value).toContain(`[View JWT](${url})`);
    expect(decorations[0].options.hoverMessage.value).not.toContain('Edit JWT');
  });
});

describe('registerJwtLinkPlane + attachJwtEditTarget', () => {
  it('routes the edit command on an attached model to its handler', () => {
    let command: ((accessor: unknown, ...args: number[]) => void) | undefined;
    const fakeMonaco = {
      editor: {
        registerCommand: (id: string, handler: typeof command) => {
          expect(id).toBe(JWT_EDIT_COMMAND);
          command = handler;
          return { dispose: vi.fn() };
        },
      },
    };
    registerJwtLinkPlane(fakeMonaco as unknown as typeof monaco);
    expect(command).toBeDefined();

    const text = `{"auth": "${TOKEN}"}`;
    const model = makeModelStub(text);
    const onOpen = vi.fn();
    const { id, detach } = attachJwtEditTarget(model as unknown as monaco.editor.ITextModel, onOpen);

    const decorations = buildJwtDecorations(model, id, 'edit', t);
    expect(decorations).toHaveLength(1);
    const args = JSON.parse(
      decodeURIComponent(decorations[0].options.hoverMessage.value.match(/command:[^?]+\?([^)]+)\)/)?.[1] ?? ''),
    ) as number[];
    expect(args[0]).toBe(id);

    command!(null, ...args);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const target = onOpen.mock.calls[0][0] as JwtLinkTarget;
    expect(target.token).toBe(TOKEN);
    expect(text.slice(target.start, target.end)).toBe(TOKEN);

    // Stale offsets (buffer moved under a hover) are swallowed.
    onOpen.mockClear();
    command!(null, args[0], args[1] + 3, args[2]);
    expect(onOpen).not.toHaveBeenCalled();

    // A detached model swallows stale commands.
    detach();
    command!(null, ...args);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
