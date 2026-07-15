/**
 * Script translation — `pm.*` → `oh.*`.
 *
 * Translation is semantic or it doesn't count: a translated script
 * runs under the Safe sandbox's `oh.*` API (`core/src/scripts`).
 * Anything outside the mapped surface keeps the user's source verbatim
 * behind a marker comment plus a report transform naming the
 * untranslated construct — logic is never deleted, and no `pm.*`
 * compatibility shim exists in the product runtime.
 *
 * The mapped surface (documented idioms, tuned by a live corpus
 * census):
 *   • `pm.environment` / `pm.collectionVariables` / `pm.globals` /
 *     `pm.variables` get/set — and the legacy
 *     `postman.set/getEnvironmentVariable` pair — flatten onto
 *     `oh.variables.*` (workspace scope; `await` inserted because the
 *     `oh` calls are async where the vendor's were synchronous).
 *   • `pm.response.json()/text()/code/status/headers.get()` and the
 *     legacy `responseBody` global → `oh.response` reads.
 *   • `pm.test(name, fn)` → `await oh.test(name, fn)` (two-argument
 *     form only — the degenerate single-argument form has no sandbox
 *     meaning and falls back).
 *   • `pm.expect(...)` chains → `oh.expect(...)` where a native
 *     matcher exists; a chain using anything else falls back.
 *   • `pm.request.headers.add/upsert/remove(...)` → `oh.setHeader` /
 *     `oh.removeHeader`. Other `pm.request` reads/mutations carry
 *     vendor object semantics (`Url` instances etc.) and fall back.
 *   • Single-argument `pm.sendRequest(req)` → `await oh.sendRequest(`;
 *     the callback form falls back.
 *
 * After mapping, any residual vendor token (`pm.*`, `postman.*`,
 * legacy `request.*` / `responseCode` / `responseHeaders` globals,
 * `tests[...]`, bare `require(...)`) demotes the WHOLE script to
 * verbatim — half-translated scripts are worse than either extreme.
 * Translated output is finally syntax-checked under the exact async
 * wrapper the runner compiles with, which mechanically catches the
 * sync→async hazard (inserted `await` inside a user's non-async inner
 * function is a SyntaxError). Where `new Function` is unavailable
 * (CSP-restricted import UIs) the gate is skipped — the token scan has
 * already vouched for the mapping itself.
 */

import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { PostmanEvent } from './types';

// ── Result shape ────────────────────────────────────────────────────

export type PostmanScriptTranslation =
  | {
      kind: 'translated';
      source: string;
      /** Human-readable list of idiom families that were mapped. */
      mapped: string[];
    }
  | {
      kind: 'verbatim';
      /** Original source behind the marker header. */
      source: string;
      /** The constructs that blocked translation, for the report note. */
      constructs: string[];
    };

// ── Helper prelude lines (injected only when their call is emitted) ──

const HEADER_HELPER =
  'const __ohResponseHeader = (name) => oh.response.headers.find((h) => h.key.toLowerCase() === String(name).toLowerCase())?.value;';
const UPSERT_HELPER = 'const __ohUpsertHeader = (row) => oh.setHeader(row.key, row.value);';

// ── Entry point ─────────────────────────────────────────────────────

export function translatePostmanScript(original: string): PostmanScriptTranslation {
  const constructs = new Set<string>();
  const mapped = new Set<string>();

  // Call-form guards run on the ORIGINAL source: the degenerate
  // single-argument pm.test and the callback-style pm.sendRequest have
  // no semantic mapping.
  for (const index of callSites(original, /\bpm\.test\s*\(/g)) {
    if (!hasTopLevelComma(original, index)) constructs.add('pm.test(name) without a test callback');
  }
  for (const index of callSites(original, /\bpm\.sendRequest\s*\(/g)) {
    if (hasTopLevelComma(original, index)) constructs.add('pm.sendRequest with a callback');
  }

  let source = original;
  const hadExpect = /\bpm\.expect\s*\(/.test(source);

  // Variable scopes — vendor's four namespaces flatten onto the single
  // workspace-scoped oh.variables (get/set are async there, hence the
  // await).
  source = source.replace(
    /\bpm\.(environment|collectionVariables|globals|variables)\.(get|set)\s*\(/g,
    (_m, scope, op) => {
      mapped.add(`pm.${scope}.${op} → oh.variables.${op} (workspace scope)`);
      return `await oh.variables.${op}(`;
    },
  );
  source = source.replace(/\bpostman\.(set|get)EnvironmentVariable\s*\(/g, (_m, op) => {
    mapped.add(`postman.${op}EnvironmentVariable → oh.variables.${op} (workspace scope)`);
    return `await oh.variables.${op === 'set' ? 'set' : 'get'}(`;
  });

  // Response reads. json()/text()/headers.get() before the bare
  // code/status properties so the longer forms win.
  source = source.replace(/\bpm\.response\.json\s*\(\s*\)/g, () => {
    mapped.add('pm.response.json() → JSON.parse(oh.response.body)');
    return 'JSON.parse(oh.response.body)';
  });
  source = source.replace(/\bpm\.response\.text\s*\(\s*\)/g, () => {
    mapped.add('pm.response.text() → oh.response.body');
    return 'oh.response.body';
  });
  source = source.replace(/\bpm\.response\.headers\.get\s*\(/g, () => {
    mapped.add('pm.response.headers.get → oh.response.headers lookup');
    return '__ohResponseHeader(';
  });
  source = source.replace(/\bpm\.response\.code\b/g, () => {
    mapped.add('pm.response.code → oh.response.status');
    return 'oh.response.status';
  });
  source = source.replace(/\bpm\.response\.status\b/g, () => {
    mapped.add('pm.response.status → oh.response.statusText');
    return 'oh.response.statusText';
  });
  source = source.replace(/(?<![\w$.])responseBody\b/g, () => {
    mapped.add('responseBody → oh.response.body');
    return 'oh.response.body';
  });

  // Assertions. Chai chain matchers first, then the expect head — so a
  // chain that used only mapped matchers ends up fully native.
  if (hadExpect) {
    source = source
      .replace(/\.to\.deep\.equal\s*\(/g, '.toEqual(')
      .replace(/\.to\.eql\s*\(/g, '.toEqual(')
      .replace(/\.to\.equal\s*\(/g, '.toBe(')
      .replace(/\.to\.include\s*\(/g, '.toContain(')
      .replace(/\.to\.have\.status\s*\(/g, '.toHaveStatus(');
    source = source.replace(/\bpm\.expect\s*\(/g, () => {
      mapped.add('pm.expect → oh.expect');
      return 'oh.expect(';
    });
  }
  source = source.replace(/\bpm\.test\s*\(/g, () => {
    mapped.add('pm.test → oh.test');
    return 'await oh.test(';
  });

  // Request mutations — the call forms whose arguments carry over
  // unchanged. Other pm.request usage falls to the residual scan.
  source = source.replace(/\bpm\.request\.headers\.(add|upsert)\s*\(/g, () => {
    mapped.add('pm.request.headers.add/upsert → oh.setHeader');
    return '__ohUpsertHeader(';
  });
  source = source.replace(/\bpm\.request\.headers\.remove\s*\(/g, () => {
    mapped.add('pm.request.headers.remove → oh.removeHeader');
    return 'oh.removeHeader(';
  });

  source = source.replace(/\bpm\.sendRequest\s*\(/g, () => {
    mapped.add('pm.sendRequest → oh.sendRequest');
    return 'await oh.sendRequest(';
  });

  // Residual scan — any vendor token left demotes the whole script.
  for (const match of source.matchAll(/(?<![\w$.])pm\.[A-Za-z_$][\w$.]*/g)) {
    constructs.add(match[0]);
  }
  for (const match of source.matchAll(/(?<![\w$.])postman\.[A-Za-z_$][\w$]*/g)) {
    constructs.add(match[0]);
  }
  for (const match of source.matchAll(/(?<![\w$.])request\.[A-Za-z_$][\w$]*/g)) {
    constructs.add(`${match[0]} (legacy request global)`);
  }
  for (const match of source.matchAll(/(?<![\w$.])(responseCode|responseHeaders)\b/g)) {
    constructs.add(`${match[1]} (legacy response global)`);
  }
  if (/(?<![\w$.])tests\s*\[/.test(source)) constructs.add('tests[…] legacy assertions');
  if (/(?<![\w$.])require\s*\(/.test(source)) constructs.add('require(…)');
  if (hadExpect && /\.to\.[\w$]/.test(source)) constructs.add('unsupported expect matcher chain');

  if (constructs.size > 0) {
    return { kind: 'verbatim', source: withVerbatimMarker(original, [...constructs]), constructs: [...constructs] };
  }

  // Helper prelude, only for the helpers actually emitted.
  const prelude: string[] = [];
  if (source.includes('__ohResponseHeader(')) prelude.push(HEADER_HELPER);
  if (source.includes('__ohUpsertHeader(')) prelude.push(UPSERT_HELPER);
  if (prelude.length > 0) source = `${prelude.join('\n')}\n\n${source}`;

  const syntaxError = sandboxSyntaxError(source);
  if (syntaxError !== null) {
    const construct = `translated form does not compile under the sandbox (${syntaxError})`;
    return { kind: 'verbatim', source: withVerbatimMarker(original, [construct]), constructs: [construct] };
  }

  return { kind: 'translated', source, mapped: [...mapped] };
}

// ── Request-level event assembly ────────────────────────────────────

export interface PostmanScriptFields {
  preRequestScript?: string;
  postResponseScript?: string;
}

/**
 * Fold a request item's enabled `event[]` into the two script slots.
 * Empty scripts vanish silently at every level — vendor UI residue
 * with no logic to lose. Each non-empty script records one transform
 * (translated, imported as-is, or verbatim-with-marker); an event with
 * an unrecognized `listen` keeps an honest drop.
 */
export function buildScriptFields(
  events: PostmanEvent[] | undefined,
  jsonPath: string,
  report: ImportReport,
): PostmanScriptFields {
  const pre: string[] = [];
  const post: string[] = [];
  if (!Array.isArray(events)) return {};
  for (const ev of events) {
    if (!ev || ev.disabled) continue;
    const source = eventSource(ev);
    if (source.trim().length === 0) continue;
    const listen = ev.listen === 'prerequest' || ev.listen === 'test' ? ev.listen : null;
    const path = `${jsonPath}.event[${ev.listen ?? 'unknown'}]`;
    if (listen === null) {
      recordDrop(report, {
        path,
        reason: `Script for unrecognized event "${ev.listen ?? 'unknown'}" not imported — only pre-request and test scripts have a slot.`,
        tracking: 'PERMANENT: Postman shape validation',
      });
      continue;
    }
    const translation = translatePostmanScript(source);
    if (translation.kind === 'translated') {
      recordTransform(report, {
        path,
        from: `${listen} script (Postman API)`,
        to: 'oh.* script',
        reason:
          translation.mapped.length > 0
            ? `Script translated to the sandbox API: ${translation.mapped.join('; ')}.`
            : 'Script imported as-is — it uses no Postman-specific APIs.',
      });
    } else {
      recordTransform(report, {
        path,
        from: `${listen} script (Postman API)`,
        to: 'imported unchanged',
        reason: `Not auto-translated — uses ${translation.constructs.join(', ')}. The original source is preserved behind a marker comment; rewrite it against the oh.* API before running.`,
        tracking: '#todo-script-translation',
      });
    }
    (listen === 'prerequest' ? pre : post).push(translation.source);
  }
  return {
    ...(pre.length > 0 ? { preRequestScript: pre.join('\n\n') } : {}),
    ...(post.length > 0 ? { postResponseScript: post.join('\n\n') } : {}),
  };
}

/** Joined source of one event — the wire carries string or string[]. */
export function eventSource(ev: PostmanEvent): string {
  const exec = ev.script?.exec;
  if (Array.isArray(exec)) return exec.join('\n');
  return typeof exec === 'string' ? exec : '';
}

// ── Internals ───────────────────────────────────────────────────────

function withVerbatimMarker(original: string, constructs: string[]): string {
  return [
    '// == Imported unchanged ==',
    "// This script uses APIs that are not available in this app's script sandbox:",
    ...constructs.map((c) => `//   ${c}`),
    '// The original logic is preserved below — rewrite it against the oh.* API before running.',
    '',
    original,
  ].join('\n');
}

/** Start indices of each regex match (the call's opening paren is the
 *  last character of the match). */
function callSites(source: string, pattern: RegExp): number[] {
  const sites: number[] = [];
  for (const match of source.matchAll(pattern)) {
    sites.push(match.index + match[0].length - 1);
  }
  return sites;
}

/**
 * Whether the call whose opening paren sits at `open` has a comma at
 * argument top level. String/template/comment aware; template `${}`
 * frames nest. An unterminated call reports no comma (the residual
 * scan and compile gate own malformed sources).
 */
function hasTopLevelComma(source: string, open: number): boolean {
  type Frame = { mode: 'code' | 'sq' | 'dq' | 'tpl'; depth: number };
  const stack: Frame[] = [{ mode: 'code', depth: 0 }];
  for (let i = open; i < source.length; i++) {
    const frame = stack[stack.length - 1];
    if (!frame) return false;
    const ch = source[i];
    if (frame.mode === 'sq') {
      if (ch === '\\') i++;
      else if (ch === "'") stack.pop();
      continue;
    }
    if (frame.mode === 'dq') {
      if (ch === '\\') i++;
      else if (ch === '"') stack.pop();
      continue;
    }
    if (frame.mode === 'tpl') {
      if (ch === '\\') i++;
      else if (ch === '`') stack.pop();
      else if (ch === '$' && source[i + 1] === '{') {
        stack.push({ mode: 'code', depth: 0 });
        i++;
      }
      continue;
    }
    // code frame
    if (ch === "'") stack.push({ mode: 'sq', depth: 0 });
    else if (ch === '"') stack.push({ mode: 'dq', depth: 0 });
    else if (ch === '`') stack.push({ mode: 'tpl', depth: 0 });
    else if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      frame.depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.length > 1 && frame.depth === 0 && ch === '}') {
        stack.pop(); // closes a template ${ } expression
        continue;
      }
      if (stack.length === 1 && frame.depth === 1 && ch === ')') return false; // call closed, no comma seen
      frame.depth--;
    } else if (ch === ',' && stack.length === 1 && frame.depth === 1) {
      return true;
    }
  }
  return false;
}

/**
 * Syntax-check `source` under the exact wrapper the script runner
 * compiles with — compile only, never executed. Returns the error
 * message, or null when it compiles (or when `new Function` itself is
 * unavailable: CSP-restricted import surfaces skip the gate).
 */
function sandboxSyntaxError(source: string): string | null {
  try {
    new Function('');
  } catch {
    return null;
  }
  try {
    new Function('oh', 'console', `"use strict";\nreturn (async () => {\n${source}\n})();`);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
