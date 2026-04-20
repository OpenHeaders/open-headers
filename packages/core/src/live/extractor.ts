/**
 * Pure extractor engine for Live Workflow step captures.
 *
 * Given an `Extractor` config + a `StepResponse`, returns the
 * extracted string value or a structured failure. Never throws; the
 * caller can render the failure reason into the observability log
 * without losing the run context.
 *
 * Platform-agnostic — no `fetch`, no DOM, no Node APIs beyond the
 * standard `TextEncoder`.
 */

import type { Extractor } from '../types/v5/live';

// ── Response shape passed to extractors ───────────────────────────

export interface StepResponseHeader {
  key: string;
  value: string;
}

/**
 * The subset of a fetch response the extractors need. Chain runners
 * build this from their platform fetch adapter (the extension's
 * request-executor, tests with a mock adapter, etc.).
 */
export interface StepResponse {
  status: number;
  statusText: string;
  url: string;
  headers: readonly StepResponseHeader[];
  /** Decoded text body. Binary responses round-trip via their source
   *  encoding — the `whole-body` extractor treats this verbatim. */
  body: string;
}

// ── Result shape ──────────────────────────────────────────────────

export type ExtractorFailureKind =
  | 'no-match' // path / header / regex didn't match anything in the response
  | 'invalid-json' // `json-path` against a non-JSON body
  | 'invalid-regex' // `body-regex` pattern failed to compile
  | 'invalid-path' // `json-path` path didn't parse
  | 'invalid-group' // `body-regex` group index out of bounds for the match
  | 'unsupported-shape'; // extractor received a response it couldn't interpret

export type ExtractorResult = { ok: true; value: string } | { ok: false; kind: ExtractorFailureKind; message: string };

// ── applyExtractor ────────────────────────────────────────────────

export function applyExtractor(extractor: Extractor, response: StepResponse): ExtractorResult {
  switch (extractor.kind) {
    case 'json-path':
      return extractJsonPath(extractor.path, response.body);
    case 'header':
      return extractHeader(extractor.name, response.headers);
    case 'body-regex':
      return extractBodyRegex(extractor.pattern, extractor.group ?? 0, response.body);
    case 'whole-body':
      return { ok: true, value: response.body };
    case 'status-code':
      return { ok: true, value: String(response.status) };
  }
}

// ── json-path (minimal implementation) ────────────────────────────
//
// Supports:
//   $                  — whole root (rare; returns JSON-stringified)
//   $.a.b.c            — nested property access
//   $.a[0]             — array index
//   $.a.b[2].c         — mixed
//
// Does NOT support:
//   wildcards ($.*, $[*]), filter expressions ($[?(...)]), recursive
//   descent ($..x), slice ($[0:3]). Expand as real workflows prove
//   the need — v1 covers ~95% of OAuth-shaped tokens.

interface PathStep {
  kind: 'prop' | 'index';
  /** property name when `kind === 'prop'`, index string when `kind === 'index'`. */
  value: string;
}

function parseJsonPath(path: string): PathStep[] | { error: string } {
  if (!path.startsWith('$')) return { error: "JSON path must start with '$'" };
  const body = path.slice(1);
  const steps: PathStep[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '.') {
      // Property access — consume identifier up to next '.' or '['.
      i++;
      let end = i;
      while (end < body.length && body[end] !== '.' && body[end] !== '[') end++;
      if (end === i) return { error: `Empty property segment at position ${i}` };
      steps.push({ kind: 'prop', value: body.slice(i, end) });
      i = end;
    } else if (ch === '[') {
      // Array index — consume digits until ']'.
      const end = body.indexOf(']', i);
      if (end === -1) return { error: `Unclosed '[' at position ${i}` };
      const inner = body.slice(i + 1, end).trim();
      if (!/^\d+$/.test(inner)) {
        return { error: `Only numeric indices supported (got "${inner}")` };
      }
      steps.push({ kind: 'index', value: inner });
      i = end + 1;
    } else {
      return { error: `Unexpected character '${ch}' at position ${i}` };
    }
  }
  return steps;
}

function extractJsonPath(path: string, body: string): ExtractorResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, kind: 'invalid-json', message: 'Response body is not valid JSON.' };
  }

  const steps = parseJsonPath(path);
  if ('error' in steps) {
    return { ok: false, kind: 'invalid-path', message: steps.error };
  }

  let cursor: unknown = parsed;
  for (const step of steps) {
    if (cursor == null) {
      return {
        ok: false,
        kind: 'no-match',
        message: `Path "${path}" dead-ends at null/undefined before reaching the end.`,
      };
    }
    if (step.kind === 'prop') {
      if (typeof cursor !== 'object') {
        return {
          ok: false,
          kind: 'no-match',
          message: `Path "${path}" tried property access on a non-object at segment "${step.value}".`,
        };
      }
      cursor = (cursor as Record<string, unknown>)[step.value];
    } else {
      // index
      if (!Array.isArray(cursor)) {
        return {
          ok: false,
          kind: 'no-match',
          message: `Path "${path}" tried index access on a non-array at segment [${step.value}].`,
        };
      }
      cursor = cursor[Number(step.value)];
    }
    if (cursor === undefined) {
      return { ok: false, kind: 'no-match', message: `Path "${path}" resolved to undefined.` };
    }
  }

  return { ok: true, value: stringifyExtracted(cursor) };
}

/**
 * Convert a JSON-extracted value to its string representation used in
 * variable templates. Strings pass through unquoted; null / boolean /
 * number become their literal form; objects / arrays round-trip via
 * `JSON.stringify` (rare — almost always a misconfiguration, but we
 * don't want to lose the value when the user set up a funky path).
 */
function stringifyExtracted(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

// ── header ─────────────────────────────────────────────────────────

function extractHeader(name: string, headers: readonly StepResponseHeader[]): ExtractorResult {
  const target = name.toLowerCase();
  for (const h of headers) {
    if (h.key.toLowerCase() === target) {
      return { ok: true, value: h.value };
    }
  }
  return { ok: false, kind: 'no-match', message: `Response header "${name}" not present.` };
}

// ── body-regex ────────────────────────────────────────────────────

function extractBodyRegex(pattern: string, group: number, body: string): ExtractorResult {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (err) {
    return {
      ok: false,
      kind: 'invalid-regex',
      message: `RegExp syntax error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const match = regex.exec(body);
  if (!match) {
    return { ok: false, kind: 'no-match', message: `Pattern /${pattern}/ did not match anywhere in the body.` };
  }
  if (group < 0 || group >= match.length) {
    return {
      ok: false,
      kind: 'invalid-group',
      message: `Capture group ${group} is out of bounds (match has ${match.length} group(s)).`,
    };
  }
  const value = match[group];
  if (value === undefined) {
    return {
      ok: false,
      kind: 'no-match',
      message: `Capture group ${group} matched an optional branch that didn't participate.`,
    };
  }
  return { ok: true, value };
}
