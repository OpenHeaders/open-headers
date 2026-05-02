/**
 * Rule editor conflict tracker (Phase A A4).
 *
 * Computes per-path conflicts between (a) the form's uncommitted local
 * value, (b) the value the form was last seeded with (baseline), and
 * (c) the value an external surface most recently committed (theirs).
 *
 * A path is "in conflict" when:
 *   - the user has edited it locally (local !== base), AND
 *   - another surface has committed a different value (theirs !== local), AND
 *   - the user has not dismissed the chip for that path.
 *
 * Two-tier life cycle:
 *   - Baseline is captured by `setBaseline(rule)` on every form (re-)seed.
 *     The seed sites are the init effect and the live-update effect (which
 *     only fires when the form is clean — that path also clears dismissed).
 *   - Take-Theirs accepts the external value at one path: caller writes
 *     the value into the form, then calls `acceptTheirs(path, value)` so
 *     the baseline catches up and the chip dismisses.
 *
 * v1 scope is header-mod values + names — the dominant collision lane.
 * Scalar fields (redirectTo, delayMs, etc.) and nested set paths
 * (conditions) are additive: extend `extractBaseline` and `extractTheirs`
 * in lockstep.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RULE_FIELD } from '@/shared/awareness';

type PathMap = Record<string, string>;

interface BaselineState {
  /** Stable identity for the rule the baseline was captured from. */
  ruleSignature: string;
  paths: PathMap;
}

export interface PathConflict {
  base: string;
  theirs: string;
}

/** Bridge handed to per-field renderers so they can call into the tracker. */
export interface ConflictBridge {
  getConflict: (path: string, localValue: string) => PathConflict | null;
  onAcceptTheirs: (path: string, theirs: string) => void;
  onDismissConflict: (path: string) => void;
}

export interface RuleConflictsApi {
  /** Re-seed the baseline. Call from populateFormFromRule. */
  setBaseline: (rule: V5.Rule) => void;
  /** Lookup conflict for a path. Returns null when no conflict. */
  getConflict: (path: string, localValue: string) => PathConflict | null;
  /** Accept the external value at path: align baseline + dismiss. */
  acceptTheirs: (path: string, theirs: string) => void;
  /** Dismiss the chip without taking theirs. */
  dismiss: (path: string) => void;
  /** Clear all dismissed entries (e.g. on successful save). */
  clearDismissed: () => void;
}

export interface UseRuleConflictsArgs {
  liveRule: V5.Rule | null | undefined;
  isDirty: boolean;
  /** When false, getConflict returns null unconditionally. */
  enabled: boolean;
}

/**
 * Per-rule-type scalar paths. Use canonical schema paths
 * (`action.<field>`) rather than form-field ids so the keys stay
 * meaningful when other surfaces (popup, devpanel) start publishing
 * the same fields. Conditions (`conditions.<i>.values.<j>`) are
 * deferred — their form representation is its own investigation.
 */
const SCALAR_PATHS_BY_TYPE: Record<V5.Rule['type'], readonly string[]> = {
  header: [],
  redirect: ['action.redirectTo'],
  delay: ['action.delayMs'],
  inject: ['action.code', 'action.sourceUrl', 'action.injectType', 'action.source', 'action.position'],
  body: ['action.body', 'action.bodyType', 'action.resourceType'],
  mock: ['action.statusCode', 'action.responseBody', 'action.contentType', 'action.bodyType'],
  block: [],
  'query-param': [],
};

function readPath(rule: V5.Rule, path: string): string | null {
  if (path === 'name') return String(rule.name ?? '');
  if (path.startsWith('conditions.')) {
    // `conditions.<uid>.<leaf>` — set-row identity is the persisted uid.
    const m = /^conditions\.([a-z0-9]{8})\.(values|field|headerName)$/.exec(path);
    if (!m) return null;
    const uid = m[1];
    const leaf = m[2] as 'values' | 'field' | 'headerName';
    const c = rule.conditions.find((c) => c.uid === uid);
    if (!c) return null;
    if (leaf === 'values') return (c.values ?? []).join(', ');
    if (leaf === 'field') return String(c.type);
    if (leaf === 'headerName') return String(c.headerName ?? '');
    return null;
  }
  if (!path.startsWith('action.')) return null;
  const tail = path.slice('action.'.length);
  // Header-mod set paths: `requestHeaders|responseHeaders.<uid>.<leaf>`.
  const headerMod = /^(requestHeaders|responseHeaders)\.([a-z0-9]{8})\.(value|headerName|operation|mergeSeparator)$/.exec(tail);
  if (headerMod) {
    if (rule.type !== 'header') return null;
    const set = headerMod[1] as 'requestHeaders' | 'responseHeaders';
    const uid = headerMod[2];
    const leaf = headerMod[3] as 'value' | 'headerName' | 'operation' | 'mergeSeparator';
    const arr = set === 'requestHeaders' ? rule.action.requestHeaders : rule.action.responseHeaders;
    const item = (arr ?? []).find((h) => h.uid === uid);
    if (!item) return null;
    return String((item[leaf] as string | undefined) ?? '');
  }
  // Query-param set paths: `params.<uid>.<leaf>`.
  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) {
    if (rule.type !== 'query-param') return null;
    const uid = queryParam[1];
    const leaf = queryParam[2] as 'param' | 'value' | 'operation';
    const item = (rule.action.params ?? []).find((p) => p.uid === uid);
    if (!item) return null;
    return String((item[leaf] as string | undefined) ?? '');
  }
  // Mock response-header rows: `responseHeaders.<headerName>.<leaf>`.
  // Schema is `Record<string,string>` keyed by header name, so the name
  // is the row identity.
  const mockHeader = /^responseHeaders\.([^.]+)\.(name|value)$/.exec(tail);
  if (mockHeader) {
    if (rule.type !== 'mock') return null;
    const headerName = mockHeader[1];
    const leaf = mockHeader[2] as 'name' | 'value';
    const map = rule.action.responseHeaders ?? {};
    if (!(headerName in map)) return null;
    if (leaf === 'name') return headerName;
    return String(map[headerName] ?? '');
  }
  // Scalar action fields: `action.<field>`.
  const action = (rule as { action?: Record<string, unknown> }).action;
  if (!action || typeof action !== 'object') return null;
  const value = action[tail];
  if (value === undefined || value === null) return null;
  return String(value);
}

function extractBaseline(rule: V5.Rule): PathMap {
  const paths: PathMap = {};
  paths.name = String(rule.name ?? '');
  // Conditions — itemId-keyed by `c.uid` so reorders don't shift the
  // baseline. `values` collapses the multi-value array to a comma-joined
  // string for the diff chip; granular per-value diffs are deferred until
  // the editor surfaces them as separate inputs.
  for (const c of rule.conditions ?? []) {
    paths[RULE_FIELD.condition(c.uid, 'values')] = (c.values ?? []).join(', ');
    paths[RULE_FIELD.condition(c.uid, 'field')] = String(c.type);
  }
  if (rule.type === 'header') {
    const dirs: Array<'request' | 'response'> = ['request', 'response'];
    for (const dir of dirs) {
      const list = dir === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
      for (const h of list ?? []) {
        paths[RULE_FIELD.headerMod(dir, h.uid, 'value')] = String(h.value ?? '');
        paths[RULE_FIELD.headerMod(dir, h.uid, 'headerName')] = String(h.headerName ?? '');
      }
    }
  }
  if (rule.type === 'query-param') {
    for (const p of rule.action.params ?? []) {
      paths[RULE_FIELD.queryParam(p.uid, 'param')] = String(p.param ?? '');
      paths[RULE_FIELD.queryParam(p.uid, 'value')] = String(p.value ?? '');
    }
  }
  if (rule.type === 'mock') {
    for (const [headerName, headerValue] of Object.entries(rule.action.responseHeaders ?? {})) {
      paths[RULE_FIELD.mockHeader(headerName, 'name')] = headerName;
      paths[RULE_FIELD.mockHeader(headerName, 'value')] = String(headerValue ?? '');
    }
  }
  for (const path of SCALAR_PATHS_BY_TYPE[rule.type] ?? []) {
    const value = readPath(rule, path);
    if (value !== null) paths[path] = value;
  }
  return paths;
}

/**
 * Lookup the live ("theirs") value at `path` against the live rule. Uses
 * the same path string an editing surface produces, so the lookup is
 * symmetric with `extractBaseline`.
 */
function lookupTheirs(rule: V5.Rule, path: string): string | null {
  return readPath(rule, path);
}

export function useRuleConflicts(args: UseRuleConflictsArgs): RuleConflictsApi {
  const { liveRule, isDirty, enabled } = args;
  const baselineRef = useRef<BaselineState | null>(null);
  // Dismissed set tracked as state so the chip re-renders on dismiss.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // Override map: paths the user has accepted Theirs on. Their baseline
  // is updated to the accepted value so the chip stops appearing.
  const [overrides, setOverrides] = useState<PathMap>({});

  const setBaseline = useCallback((rule: V5.Rule) => {
    baselineRef.current = {
      ruleSignature: rule.uid,
      paths: extractBaseline(rule),
    };
    // Functional updates with same-value bailout: only mint a new
    // empty Set/{} when there's actually something to clear. Without
    // this, every `setBaseline` call would change `dismissed` /
    // `overrides` to a fresh-but-equivalent reference, which cascades:
    // → state change → `getConflict` rebuilds (it depends on dismissed/
    //   overrides) → `conflicts` memo rebuilds → any consumer that
    //   depends on the whole `conflicts` object recomputes → effects
    //   that depend on those consumers re-fire → setBaseline runs again
    //   → loop. Idempotent reset breaks the cycle at the source.
    setDismissed((prev) => (prev.size === 0 ? prev : new Set()));
    setOverrides((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, []);

  const acceptTheirs = useCallback((path: string, theirs: string) => {
    setOverrides((prev) => ({ ...prev, [path]: theirs }));
    setDismissed((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const dismiss = useCallback((path: string) => {
    setDismissed((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissed(new Set());
    setOverrides({});
  }, []);

  const getConflict = useCallback(
    (path: string, localValue: string): PathConflict | null => {
      if (!enabled || !isDirty || !liveRule) return null;
      if (dismissed.has(path)) return null;
      const baseline = baselineRef.current;
      if (!baseline) return null;
      // Always prefer override-baseline when the user accepted theirs at this path.
      const base = overrides[path] ?? baseline.paths[path];
      if (base === undefined) return null;
      const theirs = lookupTheirs(liveRule, path);
      if (theirs === null) return null;
      // No conflict if the form matches theirs already.
      if (localValue === theirs) return null;
      // No conflict if the user hasn't actually edited this path locally.
      if (localValue === base) return null;
      // No conflict if theirs equals base — nothing externally changed at this path.
      if (theirs === base) return null;
      return { base, theirs };
    },
    [enabled, isDirty, liveRule, dismissed, overrides],
  );

  return useMemo(
    () => ({ setBaseline, getConflict, acceptTheirs, dismiss, clearDismissed }),
    [setBaseline, getConflict, acceptTheirs, dismiss, clearDismissed],
  );
}
