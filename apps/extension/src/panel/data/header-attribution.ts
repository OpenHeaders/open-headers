/**
 * Correlates HAR headers with Open Headers rule actions to produce an
 * "attributed" view of each header direction.
 *
 * Background: Chrome's `onRequestFinished` HAR entries contain only
 * the headers observed on the wire. Any request/response header
 * modifications applied by the extension via `declarativeNetRequest`
 * (or merge-by-content-script) may or may not appear there. Since our
 * panel owns both the HAR and the rule registry, we can merge the two
 * and show users exactly what their workbench did to this request — which
 * Chrome's Network tab physically cannot do for all cases.
 *
 * The result is a flat list of `AnnotatedHeader`s in a stable order:
 *   1. Server-origin headers, in their original order.
 *   2. Headers our workbench added (not present in the HAR at all), one
 *      row per unique name (last-fire-wins for attribution).
 *   3. Headers our workbench appended via `add`, one row per firing rule
 *      (duplicates are intentional — that's DNR's append semantic).
 *
 * ## Dedup workbench
 *
 * The same rule sometimes appears twice in `fires` (once confirmed by
 * Chrome's `onRuleMatchedDebug`, once inferred from URL matching) —
 * that's duplicate *evidence* for a single application. We dedupe
 * by `ruleUid` before processing so the UI doesn't render the same
 * injection twice.
 *
 * Across *different* workbench touching the same header, the later-arriving
 * fire wins (matches DNR's same-priority-last-registered semantics).
 * The user sees one row per unique header name.
 *
 * Name matching is case-insensitive per RFC 9110 §5.1.
 */

import type { V5 } from '@openheaders/core/types';
import type { InspectorFire } from './types';

export type HeaderAttribution =
  | { kind: 'server' }
  | { kind: 'added'; rule: V5.Rule; operation: 'override' | 'add' }
  | { kind: 'modified'; rule: V5.Rule; operation: 'override' | 'merge'; originalValue: string }
  | { kind: 'removed'; rule: V5.Rule }
  /**
   * Injected / overridden by an Open Headers *system* feature rather
   * than a user-defined rule. Rendered yellow in the UI so users can
   * distinguish it from their own rule-based modifications (blue).
   *
   * Two sources today:
   *   - `cache-bypass`: panel's "Disable Cache" toolbar toggle, via a
   *     DNR session rule that fires on every request in the tab.
   *   - `live-rules`: Live Rules Mode (the `rulesEngine.liveRulesMode`
   *     setting). Fires automatically on requests that match a header
   *     rule whose own mods don't touch `Cache-Control` — prevents a
   *     cached response from hiding the rule's effect.
   */
  | { kind: 'system'; source: 'cache-bypass' | 'live-rules'; label: string };

export interface AnnotatedHeader {
  name: string;
  value: string;
  attribution: HeaderAttribution;
}

export type HeaderDirection = 'request' | 'response';

interface HarHeader {
  name: string;
  value: string;
}

/**
 * Optional context for system-feature attribution. Injected headers
 * whose name *and* value match an entry here are tagged with the
 * corresponding system `kind: 'system'` attribution instead of
 * passing through as `server` (or sticking with a user-rule
 * attribution that accidentally matched the same name).
 */
export interface SystemHeaderContext {
  /** "Disable Cache" toolbar toggle is on for the inspected tab. */
  cacheBypassEnabled?: boolean;
  /**
   * A user header rule with header modifications fired on this request
   * and did not itself touch `Cache-Control` — so Live Rules Mode
   * injected the cache-bypass headers for freshness. Cache-Control /
   * Pragma on the request direction should be attributed to `live-rules`
   * rather than the server.
   */
  liveRulesFired?: boolean;
}

const CACHE_BYPASS_HEADERS: ReadonlySet<string> = new Set(['cache-control', 'pragma']);

function systemAttributionFor(name: string, value: string, ctx: SystemHeaderContext): HeaderAttribution | null {
  if (!CACHE_BYPASS_HEADERS.has(name.toLowerCase()) || !value.toLowerCase().includes('no-cache')) return null;
  // Panel toggle takes precedence over per-rule Live Rules Mode — they
  // produce identical headers on the wire, but the user flipped the
  // toggle explicitly, so that label is more informative.
  if (ctx.cacheBypassEnabled) return { kind: 'system', source: 'cache-bypass', label: 'Bypass HTTP Cache' };
  if (ctx.liveRulesFired) return { kind: 'system', source: 'live-rules', label: 'Live Rules' };
  return null;
}

export function attributeHeaders(
  harHeaders: readonly HarHeader[],
  fires: readonly InspectorFire[],
  direction: HeaderDirection,
  rulesByUid: ReadonlyMap<string, V5.Rule>,
  systemCtx: SystemHeaderContext = {},
): AnnotatedHeader[] {
  // ── Server rows ───────────────────────────────────────────
  // Preserved in output order. `serverIndex` maps lowercase name →
  // first-occurrence index for O(1) lookup. `serverOriginal` locks
  // the *original* value at construction so repeated modifications
  // don't corrupt `originalValue` on subsequent writes.
  //
  // Request-direction headers are the only place we apply system
  // attribution today — the "Disable Cache" DNR rule injects into
  // request headers. Tagging here (rather than after fires-processing)
  // means a user rule that also touches Cache-Control still wins
  // attribution: fires overwrite the row in the same way they do for
  // any other server row.
  const serverRows: AnnotatedHeader[] = harHeaders.map((h) => {
    const systemAttr = direction === 'request' ? systemAttributionFor(h.name, h.value, systemCtx) : null;
    return {
      name: h.name,
      value: h.value,
      attribution: (systemAttr ?? { kind: 'server' }) as HeaderAttribution,
    };
  });
  const serverIndex = new Map<string, number>();
  const serverOriginal = new Map<number, string>();
  for (let i = 0; i < serverRows.length; i++) {
    const key = serverRows[i].name.toLowerCase();
    if (!serverIndex.has(key)) serverIndex.set(key, i);
    serverOriginal.set(i, serverRows[i].value);
  }

  // ── Rule-added rows ──────────────────────────────────────
  // `override` / `merge` collapses to one row per name (last-write-
  // wins). `add` is kept separate because DNR's `append` semantic
  // intentionally produces duplicate header lines.
  const addedByName = new Map<string, AnnotatedHeader>();
  const appendedRows: AnnotatedHeader[] = [];

  // ── Dedupe fires by ruleUid ──────────────────────────────
  // Chrome's `onRuleMatchedDebug` and our URL-pattern inference can
  // both record the same rule — one is authoritative, the other is
  // inferred, both describe the same single application. Walk once
  // per unique ruleUid in arrival order so precedence stays
  // deterministic.
  const seen = new Set<string>();
  const uniqueFires: InspectorFire[] = [];
  for (const fire of fires) {
    if (seen.has(fire.ruleUid)) continue;
    seen.add(fire.ruleUid);
    uniqueFires.push(fire);
  }

  for (const fire of uniqueFires) {
    const rule = rulesByUid.get(fire.ruleUid);
    if (!rule || rule.type !== 'header') continue;
    const mods = direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;

    for (const mod of mods) {
      const key = mod.headerName.toLowerCase();
      const serverIdx = serverIndex.get(key);

      if (mod.operation === 'remove') {
        if (serverIdx != null) {
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: serverRows[serverIdx].value,
            attribution: { kind: 'removed', rule },
          };
        }
        // Remove any previously-added row for this name too — a later
        // `remove` annihilates earlier injections.
        addedByName.delete(key);
        continue;
      }

      if (mod.operation === 'override') {
        if (serverIdx != null) {
          const originalValue = serverOriginal.get(serverIdx) ?? serverRows[serverIdx].value;
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: mod.value ?? '',
            attribution: { kind: 'modified', rule, operation: 'override', originalValue },
          };
        } else {
          addedByName.set(key, {
            name: mod.headerName,
            value: mod.value ?? '',
            attribution: { kind: 'added', rule, operation: 'override' },
          });
        }
        continue;
      }

      if (mod.operation === 'add') {
        appendedRows.push({
          name: mod.headerName,
          value: mod.value ?? '',
          attribution: { kind: 'added', rule, operation: 'add' },
        });
        continue;
      }

      if (mod.operation === 'merge') {
        const sep = mod.mergeSeparator ?? (key === 'cookie' || key === 'set-cookie' ? '; ' : ', ');
        if (serverIdx != null) {
          const originalValue = serverOriginal.get(serverIdx) ?? serverRows[serverIdx].value;
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: originalValue + sep + (mod.value ?? ''),
            attribution: { kind: 'modified', rule, operation: 'merge', originalValue },
          };
        } else {
          // Merge onto a previously-added row if the same name was
          // already injected by an earlier fire; otherwise start fresh.
          const existing = addedByName.get(key);
          const existingValue = existing?.value ?? '';
          const mergedValue = existingValue ? `${existingValue}${sep}${mod.value ?? ''}` : (mod.value ?? '');
          addedByName.set(key, {
            name: mod.headerName,
            value: mergedValue,
            attribution: { kind: 'added', rule, operation: 'override' },
          });
        }
      }
    }
  }

  return [...serverRows, ...addedByName.values(), ...appendedRows];
}
