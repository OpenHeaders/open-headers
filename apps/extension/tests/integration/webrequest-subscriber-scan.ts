/**
 * Pure scanner for invariant 7 (single `chrome.webRequest.*`
 * subscriber). Walks a directory and returns every file that — based
 * on file-level pattern evidence — looks like it subscribes to a
 * webRequest event.
 *
 * Two detection patterns, both checked on the comment-stripped source:
 *
 *   - **direct**: `(chrome|browser).webRequest.on<EventName>` accessor.
 *     Catches `chrome.webRequest.onBeforeRequest.addListener(...)`.
 *
 *   - **aliased**: the file references the webRequest namespace
 *     (`chrome.webRequest` or `browser.webRequest` in code) AND
 *     accesses one of the nine known event names (`.onBeforeRequest`,
 *     etc.). Catches the `const wr = chrome.webRequest;
 *     wr.onBeforeRequest.addListener(...)` aliasing pattern. False
 *     positives are theoretical — a file that uses the namespace for
 *     a non-event method (e.g. `handlerBehaviorChanged`) and
 *     coincidentally calls `.onCompleted` on an unrelated object
 *     would be flagged. Today's tree has no such case; if one appears,
 *     the allowlist absorbs it under a documented reason.
 *
 * Comments are stripped before matching by a state-machine tokenizer
 * that respects single-quote, double-quote, and template-string
 * literals (so a substring like `'// foo'` inside a string isn't
 * mistaken for a line comment).
 *
 * Sole consumer: `invariant-7-single-webrequest-subscriber.test.ts`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The nine `chrome.webRequest` event accessors. The accessor name is
 * lowercase-`on` plus a CapCase verb; the same names appear as type
 * namespaces with capital-`On` (`OnBeforeRequestDetails`) but the
 * lowercase-vs-uppercase split disambiguates type usage from runtime
 * subscription.
 */
export const WEBREQUEST_EVENT_NAMES = [
  'onBeforeRequest',
  'onBeforeSendHeaders',
  'onSendHeaders',
  'onHeadersReceived',
  'onAuthRequired',
  'onResponseStarted',
  'onBeforeRedirect',
  'onCompleted',
  'onErrorOccurred',
] as const;

export type WebRequestEventName = (typeof WEBREQUEST_EVENT_NAMES)[number];

export interface SubscriberViolation {
  /** Repo-root-relative POSIX-separated path. */
  readonly file: string;
  readonly reason: 'direct' | 'aliased';
  /** Up to a few example match snippets to make the failure message useful. */
  readonly samples: readonly string[];
}

export interface ScanOptions {
  /**
   * Repo-root-relative POSIX-separated paths that are permitted to
   * subscribe. The scanner skips these files entirely.
   */
  readonly allowlist: readonly string[];
  /** Walk these file extensions only. Default: `.ts`, `.tsx`. */
  readonly extensions?: readonly string[];
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx'] as const;

const DIRECT_PATTERN = /(?:chrome|browser)\.webRequest\.on[A-Z][a-zA-Z]*/g;
const NAMESPACE_PATTERN = /(?:chrome|browser)\.webRequest\b/;
const EVENT_ACCESSOR_PATTERN = new RegExp(
  `\\.(?:${WEBREQUEST_EVENT_NAMES.join('|')})\\b`,
  'g',
);

/**
 * Walk `rootDir` recursively, return every file (outside the
 * allowlist) that matches the direct or aliased subscription pattern.
 */
export function findWebRequestSubscribers(
  rootDir: string,
  repoRoot: string,
  options: ScanOptions,
): SubscriberViolation[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const allowlist = new Set(options.allowlist.map(toPosix));
  const violations: SubscriberViolation[] = [];

  for (const absolute of walk(rootDir, extensions)) {
    const relPath = toPosix(relative(repoRoot, absolute));
    if (allowlist.has(relPath)) continue;
    if (relPath.includes('/tests/')) continue; // tests scan; they may reference patterns in fixtures

    const source = readFileSync(absolute, 'utf8');
    const stripped = stripCommentsRespectingStrings(source);

    const directMatches = unique(stripped.match(DIRECT_PATTERN) ?? []);
    if (directMatches.length > 0) {
      violations.push({ file: relPath, reason: 'direct', samples: directMatches.slice(0, 3) });
      continue;
    }

    if (NAMESPACE_PATTERN.test(stripped)) {
      const eventMatches = unique(stripped.match(EVENT_ACCESSOR_PATTERN) ?? []);
      if (eventMatches.length > 0) {
        violations.push({ file: relPath, reason: 'aliased', samples: eventMatches.slice(0, 3) });
      }
    }
  }

  return violations;
}

function* walk(dir: string, extensions: readonly string[]): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue;
      yield* walk(full, extensions);
    } else if (stats.isFile() && extensions.some((ext) => entry.endsWith(ext))) {
      yield full;
    }
  }
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

function unique(items: readonly string[]): string[] {
  return Array.from(new Set(items));
}

/**
 * Strip `//` line comments and `/* ... *​/` block comments from TS/TSX
 * source while preserving the contents of string literals and template
 * strings. State machine — no regex — to avoid edge cases like
 * `'// not a comment'` or backticks with `${...}` interpolations.
 */
export function stripCommentsRespectingStrings(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      out += ch;
      i++;
      while (i < n && source[i] !== ch) {
        if (source[i] === '\\') {
          out += source[i] + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += source[i];
        i++;
      }
      if (i < n) {
        out += source[i];
        i++;
      }
      continue;
    }
    if (ch === '`') {
      out += ch;
      i++;
      while (i < n && source[i] !== '`') {
        if (source[i] === '\\') {
          out += source[i] + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        // Template-string interpolation `${...}` — keep the contents
        // verbatim; subscribers inside an interpolation are still
        // subscribers and we want them caught.
        out += source[i];
        i++;
      }
      if (i < n) {
        out += source[i];
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}
