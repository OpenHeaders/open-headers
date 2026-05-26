/**
 * invariant 7 — single chrome.webRequest subscriber (T3b runtime check).
 *
 * The request-lifecycle architecture mandates exactly one module that
 * subscribes to `chrome.webRequest.*` events across the entire
 * extension: the heuristic correlator's input adapter at
 * `apps/extension/src/background/correlator-host/chrome-webrequest-source.ts`.
 *
 * This test scans `apps/extension/src/` for any other file that looks
 * like it subscribes (direct or aliased pattern, see
 * `./webrequest-subscriber-scan.ts`) and fails loudly if found. It is
 * the only invariant in the request-lifecycle epic with a runtime
 * enforcement story — every other invariant lives at unit-test scope.
 *
 * If you genuinely need a second subscriber, add an entry to
 * `ALLOWLIST` with a one-line architectural justification — but the
 * default answer is "route through the correlator instead."
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findWebRequestSubscribers,
  WEBREQUEST_EVENT_NAMES,
} from './webrequest-subscriber-scan';

const REPO_ROOT = findRepoRoot();
const EXTENSION_SRC = resolve(REPO_ROOT, 'apps/extension/src');

const ALLOWLIST = [
  // Sole legitimate owner — the input adapter that maps chrome events
  // to the oracle-shaped `WebRequestEvent` and fans out to the
  // heuristic correlator.
  'apps/extension/src/background/correlator-host/chrome-webrequest-source.ts',
] as const;

function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== '/' && dir.length > 1) {
    try {
      statSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('Could not locate repo root (pnpm-workspace.yaml not found)');
}

describe('invariant 7 — single webRequest subscriber', () => {
  it('only the allowlisted adapter subscribes to chrome.webRequest events', () => {
    const violations = findWebRequestSubscribers(EXTENSION_SRC, REPO_ROOT, {
      allowlist: ALLOWLIST,
    });

    if (violations.length > 0) {
      const lines = violations.map(
        (v) => `  - ${v.file} (${v.reason}): ${v.samples.join(', ')}`,
      );
      throw new Error(
        `invariant 7 violated — ${violations.length} file(s) outside the allowlist look like webRequest subscribers:\n${lines.join('\n')}\n\n` +
          `Allowed subscribers:\n${ALLOWLIST.map((p) => `  - ${p}`).join('\n')}\n\n` +
          `Route the offending logic through the heuristic correlator (subscribe to RequestLifecycleStore) instead of installing a second webRequest listener.`,
      );
    }
  });

  it('the allowlisted adapter actually subscribes (guards against the allowlist becoming a no-op)', () => {
    // If the legitimate owner stops subscribing, either someone moved
    // the responsibility elsewhere (caught by the previous test) or
    // the correlator pipeline is dead. Both warrant a loud failure.
    const adapterPath = resolve(REPO_ROOT, ALLOWLIST[0]);
    const source = readFileSync(adapterPath, 'utf8');
    expect(
      source.includes('addListener'),
      `${ALLOWLIST[0]} no longer calls .addListener — invariant 7's owner has gone inert.`,
    ).toBe(true);
    const namedEvents = WEBREQUEST_EVENT_NAMES.filter((name) => source.includes(name));
    expect(
      namedEvents.length,
      `${ALLOWLIST[0]} references none of the known webRequest event accessors — the file is no longer the lifecycle input adapter.`,
    ).toBeGreaterThan(0);
  });
});
