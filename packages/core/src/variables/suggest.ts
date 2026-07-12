/**
 * Variable-reference suggestion engine — pure, platform-agnostic.
 *
 * Feeds both the line-input popover (AntD `Mentions`) and the Monaco
 * completion provider. Splits into two functions so callers can cache
 * the full candidate list and re-filter on every keystroke without
 * re-walking their stores:
 *
 *   1. {@link buildSuggestions} — walk the registries once, produce
 *      every candidate tagged with scope + preview + priority.
 *   2. {@link filterSuggestions} — apply whatever the user typed after
 *      the most recent `{{`, sort by match quality, return display
 *      order.
 *
 * The engine's scope catalogue mirrors the resolver's — any new
 * namespace added to `SCOPE_NAMESPACES` should get an arm here. Scope
 * priority follows the resolver walk order (vault > env > collection >
 * workspace > live > step > file > dynamic).
 *
 * Pure function — no I/O, no React, no framework deps. See
 * `docs/VARIABLE_AUTOCOMPLETE_PLAN.md` for the full design.
 */

import { DYNAMIC_GENERATORS } from './dynamic';
import type { ScopeNamespace } from './namespaces';

// ── Types: the scope universe the engine knows about ──────────────

/**
 * Every namespace the suggester can offer. `file` is treated as
 * reserved here (shown disabled with a "coming soon" subtitle) until
 * the file-blob registry ships.
 */
export type SuggestionScope = ScopeNamespace;

// ── Types: the context a mount site supplies ──────────────────────

/**
 * Input-site context controlling what scopes are offered and how
 * previews are rendered. One instance per editor surface (rule editor,
 * request editor, workflow-step editor, variable-table cell).
 *
 * Defaults: every scope allowed except those implicitly gated
 * (`collection` requires `collectionId`; `step` requires
 * `workflowStep`). `allowed` lets mount sites explicitly gate scopes
 * off (e.g. a password field that shouldn't suggest anything).
 */
export interface SuggestionContext {
  /** When set, `collection.*` suggestions come from this collection's
   *  variables. Omitted → `collection` scope is hidden. */
  collectionId?: string;
  /** When set, `step.*` suggestions include captures from steps
   *  strictly BEFORE `currentStepIndex`. Omitted → `step` scope is
   *  hidden. */
  workflowStep?: {
    workflowUid: string;
    currentStepIndex: number;
    steps: ReadonlyArray<{
      id: string;
      captures: ReadonlyArray<{ name: string }>;
    }>;
  };
  /** Per-scope override. `false` hides the scope entirely; `true`
   *  forces it on if allowed by implicit gating. Omitted → each scope
   *  is offered when its implicit gate passes. */
  allowed?: Partial<Record<SuggestionScope, boolean>>;
  /** Mask every preview regardless of scope defaults — e.g. for a
   *  field whose host screen is known to be shared. */
  maskAll?: boolean;
}

// ── Types: registry entries callers hand in ───────────────────────

export interface VariableEntry {
  name: string;
  value: string;
  type?: 'default' | 'secret';
}

/**
 * Vault entries supplied to the suggester. Mirrors the discriminated
 * union on `VaultSecret` — `string` rows preview their value (masked),
 * `totp` rows preview a "TOTP code" badge so users see at a glance that
 * `{{vault.X}}` will resolve to a freshly-computed code each fire.
 *
 * The TOTP seed is intentionally absent from this surface. The
 * suggester runs in renderer contexts (popovers, Monaco) that should
 * never see seed material; the resolver produces codes from the seed
 * one layer down where the precomputed `TotpRegistry` lives.
 *
 * `client-certificate` rows are accepted (callers pass the raw vault
 * list) but never suggested — they are not template-resolvable, so no
 * PEM field crosses this surface either.
 */
export type VaultSecretEntry =
  | { kind: 'string'; name: string; value: string }
  | { kind: 'totp'; name: string; algorithm: string; digits: number; period: number; issuer?: string }
  | { kind: 'client-certificate'; name: string };

export interface EnvironmentEntry {
  uid: string;
  name: string;
  variables: ReadonlyArray<VariableEntry>;
}

export interface CollectionEntry {
  uid: string;
  variables: ReadonlyArray<VariableEntry>;
}

export interface LiveSuggestionEntry {
  value: string;
  stale?: boolean;
  /** When true, the backing recipe changed and the value is wrong-
   *  recipe until the (manual) workflow is re-run. Orthogonal to
   *  {@link stale}, which only signals expiry. */
  definitionallyStale?: boolean;
  workflowUid?: string;
}

/**
 * Snapshot of every user-scoped registry the suggester reads. Pull
 * from the same stores that feed the resolver — one source of truth.
 *
 * `step` has no registry: its suggestions come directly from
 * {@link SuggestionContext.workflowStep}. `dynamic` needs no registry —
 * its catalog is the built-in generator list. `file` is
 * reserved/disabled in v1 (shown with a "coming soon" subtitle).
 */
export interface SuggestionRegistries {
  vault: ReadonlyArray<VaultSecretEntry>;
  environments: ReadonlyArray<EnvironmentEntry>;
  /** Active env uid. Entries from this env win over the default fallback. */
  activeEnvironmentId: string | null;
  /** Default env uid — falls back when the active env lacks a name.
   *  `null` disables the fallback. */
  defaultEnvironmentId: string | null;
  collections: ReadonlyArray<CollectionEntry>;
  workspaceVariables: ReadonlyArray<VariableEntry>;
  liveRegistry: ReadonlyMap<string, LiveSuggestionEntry>;
}

// ── Types: output ─────────────────────────────────────────────────

/**
 * Preview-row shape. The UI decides how to render each kind:
 *   - `value` — show `value`, mask by default if `masked`.
 *   - `stale` — same as `value` but badge the row as stale so the
 *     user knows the backing workflow is past its expiry.
 *   - `reserved` — the scope isn't available yet; show `subtitle` and
 *     disable the row. Picking inserts the literal text anyway so the
 *     user's intent isn't lost; the resolver emits `reserved-namespace`
 *     at runtime.
 *   - `namespace` — an empty-but-usable scope, surfaced so the scope
 *     stays discoverable; show `subtitle`. Picking scaffolds
 *     `{{scope.}}` with the caret left inside (see the input's
 *     insert handler).
 *   - `step-runtime` — step captures have no value until the chain
 *     runs, so previews carry no value; the UI shows "Captured at
 *     runtime" or similar.
 *   - `dynamic` — a built-in generator; the value is freshly produced
 *     per resolution, so the preview carries the generator's
 *     description instead of a value.
 *
 * `definitionallyStale` rides the `value` / `stale` variants as an
 * orthogonal flag (a value can be expiry-stale, definitionally stale,
 * both, or neither): the UI badges "needs re-run" when it is set.
 */
export type SuggestionPreview =
  | { kind: 'value'; value: string; masked: boolean; definitionallyStale?: boolean }
  | { kind: 'stale'; value: string; masked: boolean; definitionallyStale?: boolean }
  | { kind: 'reserved'; subtitle: string }
  | { kind: 'namespace'; subtitle: string }
  | { kind: 'step-runtime' }
  | { kind: 'dynamic'; subtitle: string }
  /** Vault TOTP entry — UI shows "TOTP" badge + algorithm/digits/period
   *  hint. No `value` because the code is computed at request time. */
  | { kind: 'totp'; algorithm: string; digits: number; period: number; issuer?: string };

/**
 * One candidate for the popover. `reference` is the exact text the UI
 * inserts between `{{` and `}}` (e.g. `env.API_HOST`).
 */
export interface VariableSuggestion {
  reference: string;
  scope: SuggestionScope;
  /** Tail of the reference — `API_HOST` for `env.API_HOST`, or
   *  `login.sessionId` for `step.login.sessionId`. */
  name: string;
  preview: SuggestionPreview;
  /** Within a scope: higher is preferred. Stale / disabled entries
   *  drop below their fresh peers. */
  priority: number;
  /** When true, reserved-namespace / disabled-by-context entries. UI
   *  renders them dimmed + non-pickable (or pickable-but-flagged,
   *  depending on behavior). */
  disabled?: boolean;
  /** Sticky on the INITIAL (empty-query) list only — the `dynamic.`
   *  scaffold leads the list so the namespace is always discoverable;
   *  once the user types it competes by match rank like any scaffold. */
  pinned?: boolean;
  /** Optional backing-workflow uid for live suggestions — lets the UI
   *  jump to the workflow editor from the row. */
  workflowUid?: string;
  /** Tied to `workflowStep.steps[n].id` for step suggestions. Empty
   *  otherwise. */
  stepId?: string;
}

// ── Scope priority (resolver walk order, locked decision #10) ─────

const SCOPE_PRIORITY: Record<SuggestionScope, number> = {
  vault: 0,
  env: 1,
  collection: 2,
  workspace: 3,
  live: 4,
  step: 5,
  file: 6,
  dynamic: 7,
};

/** Priority baseline each entry gets before adjustments (stale, disabled). */
const BASE_PRIORITY = 100;
/** Live entries whose cache row is past its expiry drop this far below
 *  their fresh peers so they sort after equally-matching fresh entries. */
const STALE_PENALTY = 50;
/** Reserved-namespace entries (file) sink below every real
 *  suggestion regardless of match rank. */
const DISABLED_PENALTY = 200;

// ── Helpers ───────────────────────────────────────────────────────

function scopeAllowed(scope: SuggestionScope, context: SuggestionContext): boolean {
  if (context.allowed?.[scope] === false) return false;
  // Implicit gates — can't offer collection.* without knowing which collection,
  // and step.* is meaningless outside an active workflow step editor. `allowed`
  // can't force these on; the data just isn't there.
  if (scope === 'collection' && !context.collectionId) return false;
  if (scope === 'step' && !context.workflowStep) return false;
  return true;
}

function maskForScope(scope: SuggestionScope, entry: VariableEntry | null, maskAll: boolean): boolean {
  if (maskAll) return true;
  switch (scope) {
    case 'vault':
      return true;
    case 'live':
    case 'step':
      return true;
    case 'env':
    case 'collection':
    case 'workspace':
      return entry?.type === 'secret';
    default:
      return false;
  }
}

function valuePreview(value: string, masked: boolean, stale: boolean, definitionallyStale = false): SuggestionPreview {
  const kind = stale ? 'stale' : 'value';
  return definitionallyStale ? { kind, value, masked, definitionallyStale: true } : { kind, value, masked };
}

function buildEnvSuggestion(
  name: string,
  entry: VariableEntry,
  sourceOrder: number,
  fromActive: boolean,
  maskAll: boolean,
): VariableSuggestion {
  return {
    reference: `env.${name}`,
    scope: 'env',
    name,
    preview: valuePreview(entry.value, maskForScope('env', entry, maskAll), false),
    // Fallback-env entries sort below active-env entries by decrementing
    // priority an extra step. Within a bucket, insertion order controls.
    priority: BASE_PRIORITY - sourceOrder - (fromActive ? 0 : 1),
  };
}

// ── buildSuggestions ───────────────────────────────────────────────

/**
 * Build every candidate suggestion the input site could offer, in
 * stable scope-priority order. Caller re-filters by query via
 * {@link filterSuggestions}; both functions are pure, so callers can
 * memoize `buildSuggestions` by registry-signature and only re-run the
 * filter on keystrokes.
 */
export function buildSuggestions(registries: SuggestionRegistries, context: SuggestionContext): VariableSuggestion[] {
  const out: VariableSuggestion[] = [];
  const maskAll = context.maskAll === true;

  // 1. vault
  if (scopeAllowed('vault', context)) {
    let order = 0;
    for (const secret of registries.vault) {
      // Client-certificate entries are not template-resolvable — never
      // suggest a `{{vault.X}}` reference that could only fail.
      if (secret.kind === 'client-certificate') continue;
      const preview: SuggestionPreview =
        secret.kind === 'totp'
          ? {
              kind: 'totp',
              algorithm: secret.algorithm,
              digits: secret.digits,
              period: secret.period,
              ...(secret.issuer ? { issuer: secret.issuer } : {}),
            }
          : valuePreview(secret.value, maskForScope('vault', null, maskAll), false);
      out.push({
        reference: `vault.${secret.name}`,
        scope: 'vault',
        name: secret.name,
        preview,
        priority: BASE_PRIORITY - order,
      });
      order++;
    }
  }

  // 2. env — merge active + default, active wins on name collision.
  if (scopeAllowed('env', context)) {
    const seen = new Set<string>();
    const active = registries.environments.find((e) => e.uid === registries.activeEnvironmentId) ?? null;
    const fallback =
      registries.defaultEnvironmentId && registries.defaultEnvironmentId !== registries.activeEnvironmentId
        ? (registries.environments.find((e) => e.uid === registries.defaultEnvironmentId) ?? null)
        : null;
    let order = 0;
    if (active) {
      for (const v of active.variables) {
        if (v.value === '') continue;
        if (seen.has(v.name)) continue;
        seen.add(v.name);
        out.push(buildEnvSuggestion(v.name, v, order, true, maskAll));
        order++;
      }
    }
    if (fallback) {
      for (const v of fallback.variables) {
        if (v.value === '') continue;
        if (seen.has(v.name)) continue;
        seen.add(v.name);
        out.push(buildEnvSuggestion(v.name, v, order, false, maskAll));
        order++;
      }
    }
  }

  // 3. collection — only when mounted under a collection.
  if (scopeAllowed('collection', context) && context.collectionId) {
    const coll = registries.collections.find((c) => c.uid === context.collectionId);
    if (coll) {
      let order = 0;
      for (const v of coll.variables) {
        if (v.value === '') continue;
        out.push({
          reference: `collection.${v.name}`,
          scope: 'collection',
          name: v.name,
          preview: valuePreview(v.value, maskForScope('collection', v, maskAll), false),
          priority: BASE_PRIORITY - order,
        });
        order++;
      }
    }
  }

  // 4. workspace
  if (scopeAllowed('workspace', context)) {
    let order = 0;
    for (const v of registries.workspaceVariables) {
      if (v.value === '') continue;
      out.push({
        reference: `workspace.${v.name}`,
        scope: 'workspace',
        name: v.name,
        preview: valuePreview(v.value, maskForScope('workspace', v, maskAll), false),
        priority: BASE_PRIORITY - order,
      });
      order++;
    }
  }

  // 5. live
  if (scopeAllowed('live', context)) {
    let order = 0;
    for (const [name, entry] of registries.liveRegistry) {
      const stale = entry.stale === true;
      out.push({
        reference: `live.${name}`,
        scope: 'live',
        name,
        preview: valuePreview(
          entry.value,
          maskForScope('live', null, maskAll),
          stale,
          entry.definitionallyStale === true,
        ),
        priority: BASE_PRIORITY - order - (stale ? STALE_PENALTY : 0),
        workflowUid: entry.workflowUid,
      });
      order++;
    }
  }

  // 6. step — only within an active workflow step context; only prior steps.
  if (scopeAllowed('step', context) && context.workflowStep) {
    const { steps, currentStepIndex } = context.workflowStep;
    const cutoff = Math.min(currentStepIndex, steps.length);
    let order = 0;
    for (let i = 0; i < cutoff; i++) {
      const step = steps[i];
      if (!step) continue;
      for (const capture of step.captures) {
        out.push({
          reference: `step.${step.id}.${capture.name}`,
          scope: 'step',
          name: `${step.id}.${capture.name}`,
          preview: { kind: 'step-runtime' },
          priority: BASE_PRIORITY - order,
          stepId: step.id,
        });
        order++;
      }
    }
  }

  // Namespace scaffolds — every user-creatable scope the site allows
  // surfaces UNCONDITIONALLY (even when the scope already contributed
  // concrete entries above), so the bottom of the list is a stable
  // "add a variable in scope X" block: the display tiers sort scaffolds
  // below every concrete value and above the reserved rows. Picking one
  // scaffolds `{{scope.}}` (see the input's insert handler). The set
  // mirrors the "Add to" create scopes.
  const SCAFFOLD_SCOPES: Array<{ ns: ScopeNamespace; subtitle: string }> = [
    { ns: 'vault', subtitle: 'Add a secret' },
    { ns: 'env', subtitle: 'Add an environment variable' },
    { ns: 'collection', subtitle: 'Add a collection variable' },
    { ns: 'workspace', subtitle: 'Add a workspace variable' },
  ];
  for (const { ns, subtitle } of SCAFFOLD_SCOPES) {
    if (!scopeAllowed(ns, context)) continue;
    out.push({
      reference: `${ns}.`,
      scope: ns,
      name: '',
      preview: { kind: 'namespace', subtitle },
      priority: BASE_PRIORITY - DISABLED_PENALTY + 1,
    });
  }

  // 7. file — reserved/disabled in v1.
  // `file` lives in SCOPE_NAMESPACES in the resolver, but the plan
  // treats it as reserved until a full file-blob registry ships (v2).
  if (scopeAllowed('file', context)) {
    out.push({
      reference: 'file.',
      scope: 'file',
      name: '',
      preview: { kind: 'reserved', subtitle: 'File references coming soon' },
      priority: BASE_PRIORITY - DISABLED_PENALTY,
      disabled: true,
    });
  }

  // 8. dynamic — one pinned `dynamic.` scaffold plus one concrete row
  // per built-in generator. The scaffold is the always-visible entry
  // point (sticky first row); the generator rows stay hidden until the
  // query commits to the scope (see `filterSuggestions`), so the
  // top-level list isn't flooded with nine rows. Values regenerate per
  // resolution, so previews carry the description instead of a value.
  if (scopeAllowed('dynamic', context)) {
    out.push({
      reference: 'dynamic.',
      scope: 'dynamic',
      name: '',
      preview: { kind: 'namespace', subtitle: 'Built-in generators — uuid, timestamp, …' },
      priority: BASE_PRIORITY,
      pinned: true,
    });
    let order = 0;
    for (const g of DYNAMIC_GENERATORS) {
      out.push({
        reference: `dynamic.${g.name}`,
        scope: 'dynamic',
        name: g.name,
        preview: { kind: 'dynamic', subtitle: g.description },
        priority: BASE_PRIORITY - order,
      });
      order++;
    }
  }

  return out;
}

// ── filterSuggestions ──────────────────────────────────────────────

/**
 * Three match ranks, per locked decision #10:
 *   0 — exact (case-sensitive) prefix of the reference.
 *   1 — case-insensitive prefix.
 *   2 — case-insensitive substring anywhere in the reference.
 * Lower rank wins. Non-matches are dropped.
 */
type MatchRank = 0 | 1 | 2;

/** Display tier for the sort: concrete values first, empty-scope
 *  discovery rows next, reserved "coming soon" rows last. */
function displayTier(s: VariableSuggestion): 0 | 1 | 2 {
  if (s.preview.kind === 'reserved') return 2;
  if (s.preview.kind === 'namespace') return 1;
  return 0;
}

function matchRank(reference: string, name: string, query: string): MatchRank | null {
  if (query === '') return 0;
  // Prefix matches are checked against BOTH the full reference
  // (`env.API_URL`) and the name tail (`API_URL`). A user typing `api`
  // into an empty picker is almost always searching by name, not by
  // scope; but typing `env.` or `vault.TOK` should narrow by scope via
  // the reference. Covering both keeps the common cases fluid.
  if (reference.startsWith(query) || name.startsWith(query)) return 0;
  const qLower = query.toLowerCase();
  if (reference.toLowerCase().startsWith(qLower) || name.toLowerCase().startsWith(qLower)) return 1;
  if (reference.toLowerCase().includes(qLower)) return 2;
  return null;
}

/**
 * Apply the user's partial input (everything between the trailing
 * `{{` and the caret) to the candidate list, returning matches in
 * display order:
 *
 *   0. On an EMPTY query only: pinned rows (the `dynamic.` scaffold)
 *      above everything — the initial list keeps the entry point
 *      sticky; typing makes it compete by rank like any scaffold.
 *   1. Lower {@link MatchRank} first (exact prefix > ci prefix > ci
 *      substring).
 *   2. Scope priority ascending (vault above env above collection, …).
 *   3. Higher suggestion priority within scope first (fresh live
 *      above stale, ordinal index, etc.).
 *   4. Alphabetical by reference as a stable tiebreaker.
 *
 * Empty query returns everything (caller is expected to inject recent
 * references at the top before / after calling this).
 */
export function filterSuggestions(all: ReadonlyArray<VariableSuggestion>, query: string): VariableSuggestion[] {
  const trimmed = query;
  const ranked: Array<{ rank: MatchRank; s: VariableSuggestion }> = [];
  for (const s of all) {
    // Namespace scaffolds drop out once the query commits to a scope
    // (contains a `.`): by then the user is naming a variable inside
    // that scope, not browsing scopes.
    if (s.preview.kind === 'namespace' && trimmed.includes('.')) continue;
    // Generator rows stay hidden while the query is empty — the pinned
    // `dynamic.` scaffold is the browse entry point; committing to it
    // (or typing a match) reveals the catalog.
    if (s.preview.kind === 'dynamic' && trimmed === '') continue;
    // Never surface reserved rows just because their prefix matches —
    // they only appear when the query is empty or matches something
    // before the dot. We still accept matches on the `file.` prefix so
    // the user can DISCOVER the reserved state.
    const rank = matchRank(s.reference, s.name, trimmed);
    if (rank === null) continue;
    ranked.push({ rank, s });
  }

  // Pinned rows (the `dynamic.` scaffold) lead the INITIAL list only —
  // once the user types, they compete by match rank like any scaffold.
  const pinActive = trimmed === '';

  ranked.sort((a, b) => {
    if (pinActive) {
      const pinA = a.s.pinned === true ? 0 : 1;
      const pinB = b.s.pinned === true ? 0 : 1;
      if (pinA !== pinB) return pinA - pinB;
    }
    if (a.rank !== b.rank) return a.rank - b.rank;
    // Concrete values rank above empty-scope discovery rows, which rank
    // above reserved "coming soon" rows — a real value is always the
    // likelier pick than a scope category.
    const ta = displayTier(a.s);
    const tb = displayTier(b.s);
    if (ta !== tb) return ta - tb;
    const pa = SCOPE_PRIORITY[a.s.scope];
    const pb = SCOPE_PRIORITY[b.s.scope];
    if (pa !== pb) return pa - pb;
    if (a.s.priority !== b.s.priority) return b.s.priority - a.s.priority;
    return a.s.reference.localeCompare(b.s.reference);
  });

  return ranked.map((r) => r.s);
}

// ── Public re-exports for tests and callers ──────────────────────

export { SCOPE_PRIORITY };
