/**
 * Rule editor conflict tracker.
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
 * Optional remote attribution is best-effort: when a peer surface still
 * has `fieldFocus` on the same path, the awareness mirror provides the
 * peer's surface label + recency. If the peer saved + moved on, the chip
 * shows "Saved value" without attribution.
 *
 * The hook is rule-specific in its baseline projection (`extractBaseline`,
 * `readPath`); the consumed types and downstream UI primitives
 * (`ConflictBridge`, `ConflictDiffChip`, `EntityConflictBanner`,
 * `EntityConflictDialog`) are entity-agnostic. New entities follow the
 * same shape — see `apps/extension/src/shared/conflicts/types.ts`.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import type { V5 } from '@openheaders/core/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RULE_FIELD, useOptionalLocalInstanceId } from '@/shared/awareness';
import type { ConflictBridge, ConflictRemoteInfo, PathConflict } from '@/shared/conflicts';
import { getActiveAwarenessMirror } from '@/context/awareness-mirror';

type PathMap = Record<string, string>;

interface BaselineState {
  /** Stable identity for the rule the baseline was captured from. */
  ruleSignature: string;
  paths: PathMap;
}

export type { ConflictBridge, ConflictRemoteInfo, PathConflict };

const RULE_ENTITY_TYPE = 'rule';

export interface RuleConflictsApi {
  /** Re-seed the baseline. Call from populateFormFromRule. */
  setBaseline: (rule: V5.Rule) => void;
  /** Lookup conflict for a path. Returns null when no conflict. */
  getConflict: (path: string, localValue: string) => PathConflict | null;
  /** All active conflicts on the entity, keyed by path. `form` is the
   *  same path-keyed projection of the local form values that
   *  `extractBaseline` produces — caller computes it.
   *
   *  Optional `formSetOrders` supplies the form's ordered uid arrays
   *  per set-modeled path. Required for `'set-reorder'` detection
   *  (path keys are insertion-order sensitive in the live rule but
   *  order is lost when the form gets projected to a path map). */
  getAllConflicts: (
    form: PathMap,
    formSetOrders?: ReadonlyMap<string, readonly string[]>,
  ) => Map<string, PathConflict>;
  /** Per-row set conflict for a single (setPath, uid). Used by inline
   *  row chips to surface "saved version removed this row" without
   *  the caller having to project the whole form. */
  getSetConflict: (setPath: string, uid: string, formContainsUid: boolean) => PathConflict | null;
  /** Accept the external value at path: align baseline + dismiss. */
  acceptTheirs: (path: string, theirs: string) => void;
  /** Dismiss the chip without taking theirs. */
  dismiss: (path: string) => void;
  /** Clear all dismissed entries (e.g. on successful save). */
  clearDismissed: () => void;
  /** Project the live rule into the same path-keyed shape as the
   *  baseline. Useful for entity-level diff dialog rendering. */
  projectRule: (rule: V5.Rule) => PathMap;
}

export interface UseRuleConflictsArgs {
  liveRule: V5.Rule | null | undefined;
  isDirty: boolean;
  /** When false, getConflict returns null unconditionally. */
  enabled: boolean;
}

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
  const queryParam = /^params\.([a-z0-9]{8})\.(param|value|operation)$/.exec(tail);
  if (queryParam) {
    if (rule.type !== 'query-param') return null;
    const uid = queryParam[1];
    const leaf = queryParam[2] as 'param' | 'value' | 'operation';
    const item = (rule.action.params ?? []).find((p) => p.uid === uid);
    if (!item) return null;
    return String((item[leaf] as string | undefined) ?? '');
  }
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
  const action = (rule as { action?: Record<string, unknown> }).action;
  if (!action || typeof action !== 'object') return null;
  const value = action[tail];
  if (value === undefined || value === null) return null;
  return String(value);
}

function extractBaseline(rule: V5.Rule): PathMap {
  const paths: PathMap = {};
  paths.name = String(rule.name ?? '');
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

function lookupTheirs(rule: V5.Rule, path: string): string | null {
  return readPath(rule, path);
}

// ── Set-membership extraction ──────────────────────────────────────
//
// Detect "saved version added a row" / "saved version removed a row"
// against the form. The conflict tracker keys these by `set:<setPath>.<uid>`
// so they don't collide with the existing leaf paths.

interface SetMember {
  uid: string;
  /** Compact human summary used in the dialog table. */
  summary: string;
  /** Full row object — the resolver re-inserts this into the form. */
  payload: unknown;
}

const SET_PATHS_BY_TYPE: Partial<Record<V5.Rule['type'], readonly { setPath: string; getter: (r: V5.Rule) => readonly SetMember[] }[]>> = {
  header: [
    {
      setPath: 'action.requestHeaders',
      getter: (r) =>
        r.type === 'header'
          ? (r.action.requestHeaders ?? []).map((h) => ({
              uid: h.uid,
              summary: `${h.headerName}: ${h.value ?? ''}`,
              payload: h,
            }))
          : [],
    },
    {
      setPath: 'action.responseHeaders',
      getter: (r) =>
        r.type === 'header'
          ? (r.action.responseHeaders ?? []).map((h) => ({
              uid: h.uid,
              summary: `${h.headerName}: ${h.value ?? ''}`,
              payload: h,
            }))
          : [],
    },
  ],
  'query-param': [
    {
      setPath: 'action.params',
      getter: (r) =>
        r.type === 'query-param'
          ? (r.action.params ?? []).map((p) => ({
              uid: p.uid,
              summary: `${p.param}=${p.value ?? ''}`,
              payload: p,
            }))
          : [],
    },
  ],
};

const CONDITIONS_SET = {
  setPath: 'conditions',
  getter: (r: V5.Rule): readonly SetMember[] =>
    (r.conditions ?? []).map((c) => ({
      uid: c.uid,
      summary: c.headerName ? `${c.type} ${c.headerName} ${c.values?.join(', ') ?? ''}` : `${c.type} ${c.values?.join(', ') ?? ''}`,
      payload: c,
    })),
};

interface SetMemberSnapshot {
  setPath: string;
  byUid: Map<string, SetMember>;
}

function snapshotSets(rule: V5.Rule): readonly SetMemberSnapshot[] {
  const out: SetMemberSnapshot[] = [];
  for (const def of SET_PATHS_BY_TYPE[rule.type] ?? []) {
    const byUid = new Map<string, SetMember>();
    for (const m of def.getter(rule)) byUid.set(m.uid, m);
    out.push({ setPath: def.setPath, byUid });
  }
  const byUid = new Map<string, SetMember>();
  for (const m of CONDITIONS_SET.getter(rule)) byUid.set(m.uid, m);
  out.push({ setPath: CONDITIONS_SET.setPath, byUid });
  return out;
}

/** Build a transient `V5.Rule`-shaped probe from a path-keyed form
 *  projection so set-extraction can reuse `snapshotSets`. The shape
 *  comes from `extractBaseline`'s output keys; we need only the set
 *  membership (uids), not the full schema, so a minimal reconstruction
 *  is enough for diff purposes. */
function snapshotSetsFromForm(form: PathMap, rule: V5.Rule): readonly SetMemberSnapshot[] {
  const collect = (prefix: string): Set<string> => {
    const uids = new Set<string>();
    for (const key of Object.keys(form)) {
      if (!key.startsWith(`${prefix}.`)) continue;
      const tail = key.slice(prefix.length + 1);
      const m = /^([a-z0-9]{8})\./.exec(tail);
      if (m) uids.add(m[1]);
    }
    return uids;
  };
  const out: SetMemberSnapshot[] = [];
  const formAsRule = (uid: string, prefix: string): SetMember => {
    // Form-side summary: pull leaves out of the projection by uid.
    const leafLookup = (leaf: string) => form[`${prefix}.${uid}.${leaf}`];
    if (prefix === 'action.requestHeaders' || prefix === 'action.responseHeaders') {
      return {
        uid,
        summary: `${leafLookup('headerName') ?? ''}: ${leafLookup('value') ?? ''}`,
        payload: { uid, headerName: leafLookup('headerName'), value: leafLookup('value') },
      };
    }
    if (prefix === 'action.params') {
      return {
        uid,
        summary: `${leafLookup('param') ?? ''}=${leafLookup('value') ?? ''}`,
        payload: { uid, param: leafLookup('param'), value: leafLookup('value') },
      };
    }
    return { uid, summary: uid, payload: { uid } };
  };
  for (const def of SET_PATHS_BY_TYPE[rule.type] ?? []) {
    const uids = collect(def.setPath);
    const byUid = new Map<string, SetMember>();
    for (const uid of uids) byUid.set(uid, formAsRule(uid, def.setPath));
    out.push({ setPath: def.setPath, byUid });
  }
  // Conditions: keyed by uid via `conditions.<uid>.field|values`.
  {
    const uids = collect('conditions');
    const byUid = new Map<string, SetMember>();
    for (const uid of uids) byUid.set(uid, { uid, summary: form[`conditions.${uid}.field`] ?? uid, payload: { uid } });
    out.push({ setPath: 'conditions', byUid });
  }
  return out;
}

const SET_KEY_PREFIX = 'set:';
const REORDER_KEY_PREFIX = 'reorder:';
function setKey(setPath: string, uid: string): string {
  return `${SET_KEY_PREFIX}${setPath}.${uid}`;
}
function reorderKey(setPath: string): string {
  return `${REORDER_KEY_PREFIX}${setPath}`;
}
export function isSetConflictKey(key: string): boolean {
  return key.startsWith(SET_KEY_PREFIX);
}
export function isReorderConflictKey(key: string): boolean {
  return key.startsWith(REORDER_KEY_PREFIX);
}
export function decodeSetConflictKey(key: string): { setPath: string; uid: string } | null {
  if (!isSetConflictKey(key)) return null;
  const rest = key.slice(SET_KEY_PREFIX.length);
  const m = /^(.+)\.([a-z0-9]{8})$/.exec(rest);
  if (!m) return null;
  return { setPath: m[1], uid: m[2] };
}
export function decodeReorderConflictKey(key: string): { setPath: string } | null {
  if (!isReorderConflictKey(key)) return null;
  return { setPath: key.slice(REORDER_KEY_PREFIX.length) };
}

function describeRemote(
  presence: readonly AwarenessState[],
  now: number,
): ConflictRemoteInfo | undefined {
  if (presence.length === 0) return undefined;
  // Most-recent peer wins when several are in the candidate set.
  const sorted = [...presence].sort((a, b) => b.lastActivityHlc.physicalMs - a.lastActivityHlc.physicalMs);
  const top = sorted[0];
  const agoMs = Math.max(0, now - top.lastActivityHlc.physicalMs);
  return {
    surfaceKind: top.identity.surfaceKind,
    surfaceLabel: top.identity.label,
    instanceId: top.identity.instanceId,
    agoMs,
  };
}

/**
 * Cascade peer lookup so attribution survives the saving peer moving
 * on. The signal weakens as we broaden the scope, but a best-guess
 * attribution beats going silent — the user always wants to see "this
 * came from somewhere", even when that somewhere is their own other
 * tab they forgot about.
 *
 *   1. Peer focused on this exact field — strongest signal.
 *   2. Peer focused on this entity (different field) — still likely
 *      the same author who just navigated within the editor.
 *   3. Any peer alive on this workspace, most-recently-active first —
 *      catches "saved + closed tab" and cross-surface rename cases.
 *
 * The local surface is excluded at every tier; same-user-different-tab
 * is NOT excluded — that's the most useful case to surface ("you
 * edited this from another tab and forgot").
 */
function findRemoteAttribution(
  mirror: ReturnType<typeof getActiveAwarenessMirror>,
  entityId: string,
  path: string,
  localInstanceId: string | undefined,
  now: number,
): ConflictRemoteInfo | undefined {
  const opts = { excludeInstanceId: localInstanceId };
  const fieldPeers = mirror.getPresenceForField({ type: RULE_ENTITY_TYPE, id: entityId, path }, opts);
  if (fieldPeers.length > 0) return describeRemote(fieldPeers, now);
  const entityPeers = mirror.getPresenceForEntity({ type: RULE_ENTITY_TYPE, id: entityId }, opts);
  if (entityPeers.length > 0) return describeRemote(entityPeers, now);
  const all = mirror.getPresence().filter((p) => p.identity.instanceId !== localInstanceId);
  return describeRemote(all, now);
}

export function useRuleConflicts(args: UseRuleConflictsArgs): RuleConflictsApi {
  const { liveRule, isDirty, enabled } = args;
  const baselineRef = useRef<BaselineState | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [overrides, setOverrides] = useState<PathMap>({});
  const localInstanceId = useOptionalLocalInstanceId();

  // Awareness re-render trigger. The mirror is the source of truth for
  // remote attribution — consumers re-read on every notification rather
  // than caching state, so the lookup stays cheap (just a Map filter).
  // Subscribe to ANY presence change (not just this entity's bucket)
  // because the cascade in `findRemoteAttribution` falls through to
  // "any peer alive on the workspace" when the saving peer no longer
  // focuses the entity — that signal lives on the global subscription.
  const [, bumpAwareness] = useState(0);
  useEffect(() => {
    if (!enabled || !liveRule) return;
    const mirror = getActiveAwarenessMirror();
    return mirror.subscribe(() => {
      bumpAwareness((n) => n + 1);
    });
  }, [enabled, liveRule?.uid]);

  const setBaseline = useCallback((rule: V5.Rule) => {
    baselineRef.current = {
      ruleSignature: rule.uid,
      paths: extractBaseline(rule),
    };
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

  const projectRule = useCallback((rule: V5.Rule) => extractBaseline(rule), []);

  const getSetConflict = useCallback(
    (setPath: string, uid: string, formContainsUid: boolean): PathConflict | null => {
      if (!enabled || !isDirty || !liveRule) return null;
      const baseline = baselineRef.current;
      if (!baseline) return null;
      const key = setKey(setPath, uid);
      if (dismissed.has(key)) return null;

      const liveSets = snapshotSets(liveRule);
      const liveSnap = liveSets.find((s) => s.setPath === setPath);
      const liveMember = liveSnap?.byUid.get(uid);

      const baselineSnap = snapshotSetsFromForm(baseline.paths, liveRule).find((s) => s.setPath === setPath);
      const baseMember = baselineSnap?.byUid.get(uid);

      // saved-removed: was in baseline + form, gone from live.
      if (!liveMember && baseMember && formContainsUid) {
        const mirror = getActiveAwarenessMirror();
        const remote = findRemoteAttribution(mirror, liveRule.uid, key, localInstanceId, Date.now());
        const conflict: PathConflict = {
          kind: 'set-remove',
          base: baseMember.summary,
          theirs: '',
          rowPayload: baseMember.payload,
        };
        if (remote) conflict.remote = remote;
        return conflict;
      }
      // set-add can't surface inline (the row doesn't exist in form),
      // so we don't return one here — the entity-level dialog handles
      // it.
      return null;
    },
    [enabled, isDirty, liveRule, dismissed, localInstanceId],
  );

  const getConflict = useCallback(
    (path: string, localValue: string): PathConflict | null => {
      if (!enabled || !isDirty || !liveRule) return null;
      if (dismissed.has(path)) return null;
      const baseline = baselineRef.current;
      if (!baseline) return null;
      const base = overrides[path] ?? baseline.paths[path];
      if (base === undefined) return null;
      const theirs = lookupTheirs(liveRule, path);
      if (theirs === null) return null;
      if (localValue === theirs) return null;
      if (localValue === base) return null;
      if (theirs === base) return null;
      const mirror = getActiveAwarenessMirror();
      const remote = findRemoteAttribution(mirror, liveRule.uid, path, localInstanceId, Date.now());
      return remote ? { base, theirs, remote } : { base, theirs };
    },
    [enabled, isDirty, liveRule, dismissed, overrides, localInstanceId],
  );

  const getAllConflicts = useCallback(
    (form: PathMap, formSetOrders?: ReadonlyMap<string, readonly string[]>): Map<string, PathConflict> => {
      const out = new Map<string, PathConflict>();
      const baseline = baselineRef.current;
      if (!baseline) return out;
      if (!liveRule || !enabled || !isDirty) return out;

      // Set-level membership diffs. Only meaningful when peers diverge
      // structurally (added/removed entire rows) — handled separately
      // from leaf scalars so the dialog can render them with their own
      // affordances.
      const liveSets = snapshotSets(liveRule);
      const formSets = snapshotSetsFromForm(form, liveRule);
      // Baseline membership is derived from baseline keys' uids.
      const baselineFormProjection: PathMap = baseline.paths;
      const baselineSets = snapshotSetsFromForm(baselineFormProjection, liveRule);
      const baselineByPath = new Map(baselineSets.map((s) => [s.setPath, s.byUid]));
      const formByPath = new Map(formSets.map((s) => [s.setPath, s.byUid]));
      const mirror = getActiveAwarenessMirror();
      const now = Date.now();

      for (const live of liveSets) {
        const liveBy = live.byUid;
        const baseBy = baselineByPath.get(live.setPath) ?? new Map<string, SetMember>();
        const formBy = formByPath.get(live.setPath) ?? new Map<string, SetMember>();
        const allUids = new Set<string>([...liveBy.keys(), ...baseBy.keys(), ...formBy.keys()]);

        // Reorder detection — only meaningful when membership matches
        // exactly between live and form (otherwise add/remove
        // already covers the divergence). Order matters for header
        // mods (DNR last-write-wins on same header name) and for any
        // future entity where execution order is semantic.
        const formOrder = formSetOrders?.get(live.setPath);
        if (formOrder && liveBy.size > 1 && liveBy.size === formBy.size) {
          let sameMembership = true;
          for (const uid of liveBy.keys()) {
            if (!formBy.has(uid)) {
              sameMembership = false;
              break;
            }
          }
          if (sameMembership) {
            const liveOrder = Array.from(liveBy.keys());
            const orderMatches =
              liveOrder.length === formOrder.length &&
              liveOrder.every((uid, idx) => uid === formOrder[idx]);
            if (!orderMatches) {
              const key = reorderKey(live.setPath);
              if (!dismissed.has(key)) {
                const summarize = (uids: readonly string[]) =>
                  uids
                    .map((uid) => {
                      const member = liveBy.get(uid);
                      // Use the row's headerName / param name when available,
                      // otherwise fall back to the uid for compactness.
                      const summary = member?.summary ?? uid;
                      // Trim the value half ("X-Auth: token..." → "X-Auth")
                      // so the comma list stays readable.
                      const labelOnly = summary.split(/[:=]/)[0]?.trim() || uid;
                      return labelOnly;
                    })
                    .join(' → ');
                const remote = findRemoteAttribution(mirror, liveRule.uid, key, localInstanceId, now);
                const conflict: PathConflict = {
                  kind: 'set-reorder',
                  base: summarize(formOrder),
                  theirs: summarize(liveOrder),
                  rowPayload: { savedOrder: liveOrder },
                };
                if (remote) conflict.remote = remote;
                out.set(key, conflict);
              }
            }
          }
        }

        for (const uid of allUids) {
          const liveMember = liveBy.get(uid);
          const baseMember = baseBy.get(uid);
          const formMember = formBy.get(uid);
          // saved-added: present in live, absent from baseline, absent from form
          if (liveMember && !baseMember && !formMember) {
            const key = setKey(live.setPath, uid);
            if (dismissed.has(key)) continue;
            const remote = findRemoteAttribution(mirror, liveRule.uid, key, localInstanceId, now);
            const conflict: PathConflict = {
              kind: 'set-add',
              base: '',
              theirs: liveMember.summary,
              rowPayload: liveMember.payload,
            };
            if (remote) conflict.remote = remote;
            out.set(key, conflict);
            continue;
          }
          // saved-removed: absent from live, present in baseline, present in form
          if (!liveMember && baseMember && formMember) {
            const key = setKey(live.setPath, uid);
            if (dismissed.has(key)) continue;
            const remote = findRemoteAttribution(mirror, liveRule.uid, key, localInstanceId, now);
            const conflict: PathConflict = {
              kind: 'set-remove',
              base: baseMember.summary,
              theirs: '',
              rowPayload: formMember.payload,
            };
            if (remote) conflict.remote = remote;
            out.set(key, conflict);
            continue;
          }
        }
      }

      // Walk the union of baseline keys + form keys so newly-introduced
      // local rows still show in the aggregator (form has paths the
      // baseline doesn't yet know about, e.g. a newly-added header row).
      const keys = new Set<string>([...Object.keys(baseline.paths), ...Object.keys(form)]);
      for (const key of keys) {
        const local = form[key] ?? baseline.paths[key] ?? '';
        const conflict = getConflict(key, local);
        if (conflict) out.set(key, conflict);
      }
      return out;
    },
    [getConflict],
  );

  return useMemo(
    () => ({
      setBaseline,
      getConflict,
      getAllConflicts,
      getSetConflict,
      acceptTheirs,
      dismiss,
      clearDismissed,
      projectRule,
    }),
    [setBaseline, getConflict, getAllConflicts, getSetConflict, acceptTheirs, dismiss, clearDismissed, projectRule],
  );
}
