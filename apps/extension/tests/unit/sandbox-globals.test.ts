/**
 * The script editor's declared surface against the real compiler —
 * the ECMAScript lib, the runtimes' shared globals
 * (`sandbox-globals.ts`) and each slot kind's `oh` ambient, exactly
 * what Monaco's TypeScript service is fed.
 *
 * Contract: every shipped snippet of every kind typechecks clean
 * against that surface (the snippets and the promise never drift);
 * the browser's globals are not part of it, and the console has the
 * runner's five methods alone.
 */

import { SCRIPT_KINDS } from '@openheaders/core/scripts';
import { ohAmbientDts } from '@openheaders/ui/workbench/components/script-editor/oh-types';
import { SANDBOX_GLOBALS_DTS } from '@openheaders/ui/workbench/components/script-editor/sandbox-globals';
import { getScriptSnippetGroups } from '@openheaders/ui/workbench/components/script-editor/script-snippets';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  lib: ['lib.esnext.d.ts'],
  allowJs: true,
  checkJs: true,
  strict: false,
  noEmit: true,
  types: [],
  typeRoots: [],
};

const OH_PATH = '/oh.d.ts';
const GLOBALS_PATH = '/oh-globals.d.ts';
const SCRIPT_PATH = '/script.js';

/** Parsed lib files are shared across programs — binding happens once
 *  per source file object. */
const libCache = new Map<string, ts.SourceFile | undefined>();

function check(ambient: string, script: string): string[] {
  const virtual = new Map<string, string>([
    [OH_PATH, ambient],
    [GLOBALS_PATH, SANDBOX_GLOBALS_DTS],
    [SCRIPT_PATH, script],
  ]);
  const base = ts.createCompilerHost(OPTIONS);
  const host: ts.CompilerHost = {
    ...base,
    fileExists: (name) => virtual.has(name) || base.fileExists(name),
    readFile: (name) => virtual.get(name) ?? base.readFile(name),
    getSourceFile: (name, languageVersion, onError) => {
      const text = virtual.get(name);
      if (text !== undefined) return ts.createSourceFile(name, text, languageVersion, true);
      if (!libCache.has(name)) libCache.set(name, base.getSourceFile(name, languageVersion, onError));
      return libCache.get(name);
    },
  };
  const program = ts.createProgram([OH_PATH, GLOBALS_PATH, SCRIPT_PATH], OPTIONS, host);
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const where =
      d.file && d.start !== undefined
        ? `${d.file.fileName}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1}`
        : '';
    return `${where} TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
  });
}

/** The runner's wrapper: user source inside an async function. */
function wrap(code: string): string {
  return `(async () => {\n${code}\n})();\n`;
}

describe('the script editor surface', () => {
  it.each(SCRIPT_KINDS)('every %s snippet typechecks against the lib, the globals and the kind ambient', (kind) => {
    const snippets = getScriptSnippetGroups(kind).flatMap((group) => group.snippets);
    expect(snippets.length).toBeGreaterThan(0);
    const script = snippets.map((snippet) => `// ${snippet.id}\n${wrap(snippet.code)}`).join('\n');
    expect(check(ohAmbientDts(kind), script)).toEqual([]);
  });

  it('declares the shared globals a script can reach', () => {
    const script = wrap(`
const url = new URL('https://api.openheaders.io/v1/items?page=2');
const page = url.searchParams.get('page');
const bytes = new TextEncoder().encode(page ?? '');
const digest = await crypto.subtle.digest('SHA-256', bytes);
const id = crypto.randomUUID();
const text = new TextDecoder().decode(bytes);
const b64 = btoa(atob('aGk='));
const copy = structuredClone({ id, text, b64, size: digest.byteLength });
const started = performance.now();
const timer = setTimeout(() => clearTimeout(timer), 1);
queueMicrotask(() => console.debug(copy, started));
console.log(JSON.stringify(copy));
`);
    expect(check(ohAmbientDts('pre-request'), script)).toEqual([]);
  });

  it("leaves out the browser's globals and the console methods the runner does not capture", () => {
    const diagnostics = check(ohAmbientDts('pre-request'), wrap('document; window; fetch; console.table([]);'));
    // TS2584 names a browser global the lib would add; TS2304 any other.
    expect(diagnostics.filter((d) => /TS2(304|584) Cannot find name '(document|window|fetch)'/.test(d))).toHaveLength(
      3,
    );
    expect(diagnostics.some((d) => d.includes('TS2339') && d.includes("'table'"))).toBe(true);
  });
});
