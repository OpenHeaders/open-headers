/**
 * RuleHoverPopover — inline-edit popover anchored to a header row in
 * the inspector.
 *
 * ## Two surfaces
 *
 *   1. Snapshot block (top, read-only) — "what happened on THIS request":
 *      renders the original (server) value and the value the rule
 *      applied at fire time, sourced from the immutable
 *      `RuleSnapshot` carried on the fire. Includes a small caption
 *      reminding the user this is a frozen capture.
 *   2. Editor block (bottom) — the live rule mod, identical to the
 *      previous popover surface. Saving here changes the rule for
 *      FUTURE requests; the snapshot above stays exactly as it was.
 *
 * The two surfaces together make the historical-vs-config split
 * explicit, matching the pattern debugging proxies and API-client
 * history all use — captured events are immutable, configuration is
 * mutable, the UI shows both.
 *
 * ## Edge cases
 *
 *   - Rule deleted between fire and view: editor disabled; snapshot
 *     still rendered with a "rule no longer exists" footnote.
 *   - Rule's mod array changed so we can't pinpoint a current mod:
 *     editor falls back to a "open in editor" affordance only;
 *     snapshot stays untouched.
 *   - Snapshot template contains `{{vars}}`: rendered via
 *     `ResolvedHeaderValue` so the user sees both the template and the
 *     resolved value (the value that hit the wire), without re-
 *     resolving against current env (we have the frozen value).
 *   - Non-header rules degrade to a one-line summary + the editor
 *     link.
 */

import { SaveOutlined } from '@ant-design/icons';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type {
  HeaderModification,
  HeaderOperation,
  HeaderRule,
  Rule,
  RuleSnapshotHeaderMod,
} from '@openheaders/core/types';
import { getHeaderOperationCapability, validateHeaderName, validateHeaderValue } from '@openheaders/core/utils';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useLiveRule } from '@openheaders/ui/context';
import {
  ConflictDiffChip,
  EntityField,
  EntityScopeProvider,
  PresenceBadge,
  RULE_FIELD,
  useEditorDirty,
  useLocalInstanceId,
  useSetActiveTabEntity,
} from '@openheaders/ui/shared/awareness';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { type RuleMutationResult, useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { useRuleConflicts } from '@openheaders/ui/workbench/components/rule-fields/use-rule-conflicts';
import { buildRuleIcon } from '@openheaders/ui/workbench/components/shared/rule-icon';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { buildChordsFromEvent, useShortcutLabel } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Button, Select, Tag, Tooltip, theme } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  findCurrentMod,
  type HeaderAttribution,
  isAttributionEdited,
  type RuleAttributionContext,
} from '../data/header-attribution';
import type { RuleApplicability } from '../data/rule-applicability';
import { findRuleCollectionId } from '../data/rule-collection';
import { ResolvedHeaderValue } from './ResolvedHeaderValue';

export interface RuleHoverPopoverTarget {
  direction: 'request' | 'response';
  headerName: string;
  operation: HeaderOperation;
}

export interface RuleHoverPopoverProps {
  anchorEl: HTMLElement;
  /** Live rule for editing. Null when the rule was deleted since the
   *  fire — the popover still renders the snapshot from `attribution`. */
  rule: Rule | null;
  target?: RuleHoverPopoverTarget;
  /** Row attribution carrying the snapshot block's data. Optional only
   *  for non-header rule activity (Matched Rules panel) where the
   *  popover is summary-only. */
  attribution?: HeaderAttribution;
  /** Current resolution of the live mod's template against the active
   *  resolver. When it differs from `snapshotMod.valueResolved`, the
   *  snapshot block surfaces a "Future" line so the user can see how
   *  a variable change affects future requests. */
  currentResolvedValue?: string | null;
  /** Current resolution of the live mod's headerName template. When
   *  it differs from `snapshotMod.headerName`, the popover surfaces
   *  the name diff in the byline. */
  currentResolvedName?: string | null;
  /** Verdict on whether the live rule would still fire on a next
   *  request to this row's URL. When the verdict is anything other
   *  than `will-fire`, the Future row reflects the actual reason
   *  (rule disabled, conditions mismatch, unresolvable template). */
  applicability?: RuleApplicability | null;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

const POPOVER_WIDTH = 480;

const OPERATION_OPTIONS: { value: HeaderOperation; label: string }[] = [
  // Mirror the workbench HeaderRuleFields labels so the popover and the
  // full editor agree on what each op is called.
  { value: 'override', label: 'Add / Replace' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
  { value: 'merge', label: 'Merge' },
];

const RULE_TYPE_LABEL: Record<Rule['type'], string> = {
  header: 'Header',
  redirect: 'Redirect',
  block: 'Block',
  delay: 'Delay',
  inject: 'Inject',
  body: 'Body',
  mock: 'Mock',
  'query-param': 'Query Param',
  ws: 'WebSocket',
  sse: 'SSE',
};

interface ModDraft {
  operation: HeaderOperation;
  headerName: string;
  value: string;
  mergeSeparator?: string;
}

function ruleCtxFromAttribution(attribution: HeaderAttribution | undefined): RuleAttributionContext | null {
  if (!attribution) return null;
  if (attribution.kind === 'added' || attribution.kind === 'modified' || attribution.kind === 'removed') {
    return attribution.ctx;
  }
  return null;
}

function snapshotAppliedValue(mod: RuleSnapshotHeaderMod): string {
  return mod.valueResolved ?? mod.valueTemplate ?? '';
}

function tagLabelFor(kind: RuleApplicability['kind']): string {
  switch (kind) {
    case 'rule-disabled':
      return 'Disabled';
    case 'mod-gone':
      return 'Mod removed';
    case 'conditions-mismatch':
      return "Conditions don't match";
    case 'name-template-unresolved':
    case 'value-template-unresolved':
    case 'separator-template-unresolved':
      return "Won't fire";
    default:
      return '';
  }
}

function tagTitleFor(kind: RuleApplicability['kind']): string {
  switch (kind) {
    case 'rule-disabled':
      return "Rule's enabled flag is off — it will not fire on any future request.";
    case 'mod-gone':
      return 'The matching modification was removed from the rule.';
    case 'conditions-mismatch':
      return "Rule's conditions no longer cover this URL.";
    case 'name-template-unresolved':
      return "Header-name template can't be fully resolved (e.g. references a TOTP). DNR rejects literal template chars in header names.";
    case 'value-template-unresolved':
      return "Header-value template can't be fully resolved.";
    case 'separator-template-unresolved':
      return "Merge-separator template can't be fully resolved.";
    default:
      return '';
  }
}

interface FutureValueProps {
  kind: FutureKind;
  collectionId: string | undefined;
  token: GlobalToken;
  valueStyle: React.CSSProperties;
}

/**
 * Renders the right-hand side of the Future row. Each `FutureKind`
 * variant maps to a distinct affordance:
 *
 *   - resolved              — the live rule's resolved value
 *   - removed               — rule's op flipped to `remove`
 *   - mod-gone              — rule still exists but the mod was deleted
 *   - rule-deleted          — rule no longer in the registry
 *   - rule-disabled         — rule's enabled flag is off
 *   - conditions-mismatch   — rule's conditions no longer match this URL
 *   - name/value-template-unresolved — DNR builder will reject (TOTP etc.)
 */
function FutureValue({ kind, collectionId, token, valueStyle }: FutureValueProps) {
  const muted: React.CSSProperties = {
    ...valueStyle,
    fontStyle: 'italic',
    color: token.colorTextTertiary,
  };
  const struck: React.CSSProperties = { ...muted, textDecoration: 'line-through' };
  switch (kind.kind) {
    case 'resolved':
      return (
        <span style={valueStyle}>
          <ResolvedHeaderValue value={kind.value} collectionId={collectionId} />
        </span>
      );
    case 'removed':
      return <span style={struck}>removed</span>;
    case 'rule-deleted':
      return <span style={muted}>rule was deleted — won't fire</span>;
    case 'rule-disabled':
      return <span style={muted}>rule is disabled — won't fire</span>;
    case 'mod-gone':
      return <span style={muted}>this modification was removed from the rule</span>;
    case 'conditions-mismatch':
      return <span style={muted}>rule's conditions no longer match this URL</span>;
    case 'name-template-unresolved':
      return (
        <span style={muted} title={`Template: ${kind.template}`}>
          header name template can't be resolved — rule won't fire
        </span>
      );
    case 'value-template-unresolved':
      return (
        <span style={muted} title={`Template: ${kind.template}`}>
          value template can't be resolved — rule won't fire
        </span>
      );
    case 'separator-template-unresolved':
      return (
        <span style={muted} title={`Template: ${kind.template}`}>
          mergeSeparator template can't be resolved — rule won't fire
        </span>
      );
    default:
      return null;
  }
}

/**
 * Maps a `RuleApplicability` verdict + drift state into a tagged
 * Future-row description. Pulled out so the JSX stays declarative
 * and the branching logic lives in one place.
 */
type FutureKind =
  | { kind: 'none' }
  | { kind: 'rule-deleted' }
  | { kind: 'rule-disabled' }
  | { kind: 'mod-gone' }
  | { kind: 'conditions-mismatch' }
  | { kind: 'name-template-unresolved'; template: string }
  | { kind: 'value-template-unresolved'; template: string }
  | { kind: 'separator-template-unresolved'; template: string }
  | { kind: 'removed' }
  | { kind: 'resolved'; value: string };

function computeFutureKind(
  applicability: RuleApplicability | null,
  liveRule: Rule | null,
  currentMod: HeaderModification | null,
  mod: RuleSnapshotHeaderMod,
  currentResolvedValue: string | null,
): FutureKind {
  // No applicability provided (e.g. legacy caller path) — fall back
  // to the live rule + current mod for a coarse structural verdict.
  if (!applicability) {
    if (liveRule == null) return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'rule-deleted' };
    if (currentMod == null) return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'mod-gone' };
  }
  switch (applicability?.kind) {
    case 'rule-deleted':
      return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'rule-deleted' };
    case 'rule-disabled':
      return { kind: 'rule-disabled' };
    case 'mod-gone':
      return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'mod-gone' };
    case 'conditions-mismatch':
      return { kind: 'conditions-mismatch' };
    case 'name-template-unresolved':
      return { kind: 'name-template-unresolved', template: applicability.template };
    case 'value-template-unresolved':
      return { kind: 'value-template-unresolved', template: applicability.template };
    case 'separator-template-unresolved':
      return { kind: 'separator-template-unresolved', template: applicability.template };
    default: {
      // Live rule still fires — surface the drift cases relative to
      // the snapshot.
      if (currentMod?.operation === 'remove' && mod.operation !== 'remove') {
        return { kind: 'removed' };
      }
      if (
        mod.operation !== 'remove' &&
        currentResolvedValue != null &&
        mod.valueResolved != null &&
        mod.valueResolved !== currentResolvedValue &&
        isSnapshotResolutionReliable(mod)
      ) {
        return { kind: 'resolved', value: currentResolvedValue };
      }
      return { kind: 'none' };
    }
  }
}

/**
 * True when the snapshot's `valueResolved` is a reliable wire-value
 * baseline for drift comparison against the current resolution.
 *
 * Unreliable cases (skip drift detection):
 *   - `{{vault.TOTP_*}}`: TOTP codes never bake into compiled DNR
 *     rules (SW uses `reject` mode for deferred vault entries), so the
 *     snapshot's `valueResolved` is the literal template. The
 *     renderer's `defer` mode returns an empty string instead. Modes
 *     differ → naive comparison always shows drift, so we suppress.
 *   - Templates whose vars failed to resolve at fire time (broken ref,
 *     env not selected, etc.) — same shape: `valueResolved` ===
 *     `valueTemplate` AND template contains `{{`.
 */
function isSnapshotResolutionReliable(mod: RuleSnapshotHeaderMod): boolean {
  if (mod.valueTemplate === undefined) return true;
  if (!mod.valueTemplate.includes('{{')) return true;
  return mod.valueTemplate !== mod.valueResolved;
}

export function RuleHoverPopover({
  anchorEl,
  rule,
  target,
  attribution,
  currentResolvedValue,
  currentResolvedName,
  applicability,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: RuleHoverPopoverProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  // The panel doesn't mount `<RuleProvider>` (it doesn't need the
  // full CRUD surface), so `useRules()` returns its empty default for
  // `localCollections` here. Pre-existing limitation for collection-
  // scoped variable resolution inside the popover — addressed
  // separately. The LIVE RULE itself must be reactive: pull it from
  // the rule sync mirror via `useLiveRule(uid)` (works regardless of
  // provider mount).
  const { localCollections } = useRules();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const localInstanceId = useLocalInstanceId();

  const ctx = ruleCtxFromAttribution(attribution);

  // Reactive live rule — subscribes to the rule sync mirror for this
  // uid. Updates the popover whenever ANY surface (workbench, popup,
  // another devpanel) commits a change to this rule. Falls back to
  // the static `rule` prop only when there's no uid to subscribe to
  // (legacy hover paths without attribution).
  const targetRuleUid = rule?.uid ?? ctx?.ruleUid ?? null;
  const liveRuleFromMirror = useLiveRule(targetRuleUid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule ?? null;

  const collectionId = useMemo(
    () => (liveRule ? findRuleCollectionId(liveRule, localCollections) : undefined),
    [liveRule, localCollections],
  );

  const ruleType = liveRule?.type ?? ctx?.ruleType ?? 'header';
  const ruleName = liveRule?.name ?? ctx?.ruleName ?? '';
  const isHeader = ruleType === 'header' && !!target;
  const headerRule = isHeader && liveRule?.type === 'header' ? (liveRule as HeaderRule) : null;

  // Locate the live mod via the shared `findCurrentMod` helper. Pure,
  // reactive against `liveRule` — when another surface commits a new
  // value, `liveRule` updates, currentMod recomputes, and the re-prime
  // effect catches up the form. Falls back to direction+name+operation
  // when the row was opened without an attribution context (legacy
  // hover paths).
  const currentMod = useMemo<HeaderModification | null>(() => {
    if (ctx) return findCurrentMod(liveRule, ctx);
    return findFallbackMod(headerRule, target);
  }, [liveRule, ctx, headerRule, target]);
  // "Has the rule been edited since fire?" — derived reactively against
  // `liveRule` via the shared helper. Drives the "Rule edited" tag and
  // suppresses var-drift signals (we only show drift when the structural
  // template is unchanged).
  const ruleEdited = useMemo(() => (ctx ? isAttributionEdited(liveRule, ctx) : false), [liveRule, ctx]);

  const [draft, setDraft] = useState<ModDraft>(() => ({
    operation: currentMod?.operation ?? target?.operation ?? 'override',
    headerName: currentMod?.headerName ?? target?.headerName ?? '',
    value: currentMod?.value ?? '',
    mergeSeparator: currentMod?.mergeSeparator,
  }));
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const liveRuleUid = liveRule?.uid ?? null;
  // Devpanel popover edits one specific header mod. Identity is the mod's
  // persisted uid (stable through reorders / list mutations the user might
  // make in the workbench at the same time). Used by the EntityField
  // wrappers below — the path they publish must match the workbench's
  // for the same row.
  const headerModUid = currentMod?.uid ?? null;

  // ── Derived dirty (matches `shared/forms/index.ts` convention) ──
  //
  // Compare draft to currentMod via a stable fingerprint. Self-heals
  // on every revert path:
  //   - Manual revert (typed back to original): fingerprints align,
  //     dirty clears.
  //   - External save lands: currentMod refreshes via `useRules` →
  //     fingerprints align (assuming user isn't editing) → dirty
  //     clears. The re-prime effect below also catches this case
  //     when the user happens to be editing (gate stays on isDirty).
  //   - Save commit: broadcast lands carrying values we just submitted
  //     → currentMod matches draft → dirty clears.
  const draftFingerprint = useMemo(
    () =>
      stableStringify({
        operation: draft.operation,
        headerName: draft.headerName,
        value: draft.value,
        mergeSeparator: draft.mergeSeparator ?? null,
      }),
    [draft],
  );
  const currentModFingerprint = useMemo(
    () =>
      currentMod
        ? stableStringify({
            operation: currentMod.operation,
            headerName: currentMod.headerName,
            value: currentMod.value ?? '',
            mergeSeparator: currentMod.mergeSeparator ?? null,
          })
        : null,
    [currentMod],
  );
  // `lastPrimedFingerprint` is the baseline the draft was last synced
  // from (init / re-prime / take-theirs / save echo). Comparing against
  // it (NOT against the live `currentMod`) is what distinguishes "user
  // has untouched edits" from "form is briefly stale because a
  // broadcast just landed". Without this, an external save would flip
  // `isDirty` true on a clean popover, gate the re-prime effect, and
  // leave the draft stuck on the old value. Mirrors the workbench
  // pattern (see `RuleEditor`).
  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty =
    lastPrimedFingerprint !== null && currentModFingerprint !== null && draftFingerprint !== lastPrimedFingerprint;

  // ── Surface awareness wiring ────────────────────────────────────
  //
  // The single `<SurfaceAwarenessPublisher>` mounted at the devpanel
  // root composes the surface's awareness claim from three workspace
  // contexts. The popover contributes:
  //   - `ActiveTabEntity` — set when visible+rule, cleared on unmount
  //   - `ActiveFieldFocus` — published by `<EntityField>` wrappers
  //     around the headerName/value inputs (below in JSX)
  //   - `ActiveEditorDirty` — `useEditorDirty(scope, isDirty)` writes
  //     when this popover IS the active tab entity
  const setActiveTabEntity = useSetActiveTabEntity();
  useEffect(() => {
    if (!visible || !liveRuleUid) return;
    setActiveTabEntity({ entityType: RULE_ENTITY_TYPE, entityId: liveRuleUid });
    return () => {
      setActiveTabEntity(null);
    };
  }, [visible, liveRuleUid, setActiveTabEntity]);
  useEditorDirty({ entityType: RULE_ENTITY_TYPE, entityId: liveRuleUid }, isDirty);

  // Conflict tracker — same hook the workbench uses, so a `<ConflictDiffChip>`
  // ("External change available — base / theirs") shows up next to the
  // headerName / value inputs whenever another surface commits a
  // divergent value while the popover holds an unsaved edit. Re-seed
  // the baseline whenever the rule changes structure (rule-signature
  // dep inside the hook handles incremental seeding); user must
  // explicitly Take Theirs / Keep Mine on each conflicted path.
  const conflicts = useRuleConflicts({
    liveRule: liveRule ?? null,
    isDirty,
    enabled: !!liveRuleUid,
  });
  const { setBaseline: setConflictBaseline } = conflicts;
  // Per-row chip data — recomputed against the current draft each
  // render. Returns null when no peer divergence at that path.
  const headerNamePath =
    headerModUid && target ? RULE_FIELD.headerMod(target.direction, headerModUid, 'headerName') : null;
  const valuePath = headerModUid && target ? RULE_FIELD.headerMod(target.direction, headerModUid, 'value') : null;
  const headerNameConflict = headerNamePath ? conflicts.getConflict(headerNamePath, draft.headerName) : null;
  const valueConflict = valuePath ? conflicts.getConflict(valuePath, draft.value) : null;

  // Re-prime on rule version bump (another tab saved) only when the
  // user hasn't started editing yet. Gate is the derived `isDirty`
  // (against `lastPrimedFingerprint`, NOT current canonical — see
  // baseline state above for the architectural rationale). Re-prime
  // also seeds the conflict tracker's baseline; doing it here (NOT on
  // every `liveRule` change) keeps `getConflict`'s `base` pinned to
  // the value the popover was last synced from, so when an external
  // save lands while the user has unsaved typing, base != theirs and
  // the diff chip renders correctly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the underlying entry changes.
  useEffect(() => {
    if (isDirty) return;
    if (!currentMod) return;
    setDraft({
      operation: currentMod.operation,
      headerName: currentMod.headerName,
      value: currentMod.value ?? '',
      mergeSeparator: currentMod.mergeSeparator,
    });
    if (currentModFingerprint) setLastPrimedFingerprint(currentModFingerprint);
    if (liveRule) setConflictBaseline(liveRule);
  }, [currentMod?.operation, currentMod?.headerName, currentMod?.value, currentMod?.mergeSeparator]);

  // Auto-rebase: as soon as the draft converges with the current
  // canonical (manual revert / take-theirs / save echo), snap the
  // baseline so dirty clears without imperative bookkeeping. Same
  // pattern as `RuleEditor`. The conflict baseline catches up here
  // too — if the user took theirs / reverted, the chip should hide.
  useEffect(() => {
    if (currentModFingerprint === null) return;
    if (draftFingerprint !== currentModFingerprint) return;
    if (lastPrimedFingerprint === currentModFingerprint) return;
    setLastPrimedFingerprint(currentModFingerprint);
    if (liveRule) setConflictBaseline(liveRule);
  }, [draftFingerprint, currentModFingerprint, lastPrimedFingerprint, liveRule, setConflictBaseline]);

  // Render into the inspector root so the root's `overflow: hidden` clips the
  // popover to the pane and its always-on-top footer covers any graze — the
  // same containment the toolbar/View menus get. Positioned absolute + bounded
  // to the pane (not the window), so it can't spill past the footer, and
  // pinned (no scroll re-anchor) so it stays put as the list scrolls.
  const boundsEl = useMemo(() => anchorEl.closest<HTMLElement>('.dt-panel-root'), [anchorEl]);
  // The panel status bar — the cap tracks its real top so the popover's bottom
  // stays above it on resize, on BOTH sides (the `above` placement, used when
  // the row is near the bottom, has no footer awareness on its own).
  const footerEl = useMemo(() => boundsEl?.querySelector<HTMLElement>(':scope > .rules-statusbar') ?? null, [boundsEl]);
  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH, {
    trackScroll: false,
    boundsEl,
    footerEl,
    // Anchor once, then stay put (like the static toolbar popovers) so the
    // panel reflowing during a resize can't jitter it; only the footer-tracked
    // `maxHeight` keeps updating, shrinking the popover to clear the footer.
    staticAfterMeasure: true,
  });

  const updateDraft = (patch: Partial<ModDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    // Dirty derives from draft vs currentMod equality — no imperative
    // flag needed.
  };

  const handleSave = async () => {
    if (!headerRule || !currentMod || !target) return;
    const live = draftRef.current;
    setSaving(true);
    try {
      const list =
        target.direction === 'request' ? headerRule.action.requestHeaders : headerRule.action.responseHeaders;
      const idx = list.indexOf(currentMod);
      if (idx === -1) {
        message.warning('Rule changed elsewhere — close and reopen the popover.');
        return;
      }
      const next = list.slice();
      const isRemove = live.operation === 'remove';
      // Preserve the row's persisted uid on edit — the synthesizer keys
      // identity by it, so a fresh uid here would tombstone + re-add and
      // lose the synchronized HLC chain.
      const uid = currentMod.uid;
      next[idx] = isRemove
        ? { uid, operation: 'remove', headerName: live.headerName }
        : live.operation === 'merge'
          ? {
              uid,
              operation: 'merge',
              headerName: live.headerName,
              value: live.value,
              mergeSeparator: live.mergeSeparator,
            }
          : { uid, operation: live.operation, headerName: live.headerName, value: live.value };
      const updates: Partial<HeaderRule> = {
        action: {
          requestHeaders: target.direction === 'request' ? next : headerRule.action.requestHeaders,
          responseHeaders: target.direction === 'response' ? next : headerRule.action.responseHeaders,
        },
      };
      const result: RuleMutationResult = await mutator.updateRule(headerRule.uid, updates);
      surfaceResult(result, message, () => {
        // Dirty auto-clears when the broadcast lands and currentMod
        // matches draft. No explicit reset needed.
        conflicts.clearDismissed();
        onClose();
      });
    } finally {
      setSaving(false);
    }
  };

  // Save shortcut listener — mirrors variable popover so Cmd/Ctrl+S
  // saves regardless of focused element while the popover is mounted.
  const saveLabel = useShortcutLabel('save');
  const saveChord = useSettingValue('keyboard.save');
  const handleSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (typeof saveChord !== 'string' || !saveChord) return;
    const onKey = (e: KeyboardEvent) => {
      const chords = buildChordsFromEvent(e);
      if (chords.includes(saveChord)) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [saveChord]);

  const editable = isHeader && !!currentMod && !!headerRule;

  // Full draft validation — same validators core uses for the workbench
  // editor and `isRuleComplete`. Templates pass through (resolved at
  // runtime; structural validity isn't decidable at edit time).
  const isResponse = target?.direction === 'response';
  const trimmedName = draft.headerName.trim();
  const nameValidation =
    editable && trimmedName && !trimmedName.includes('{{')
      ? validateHeaderName(trimmedName, isResponse)
      : { valid: true as const, message: '' };
  const valueValidation =
    editable && draft.operation !== 'remove' && draft.value && !draft.value.includes('{{')
      ? validateHeaderValue(draft.value, trimmedName)
      : { valid: true as const, message: '' };
  const capability =
    editable && target ? getHeaderOperationCapability(target.direction, draft.operation, draft.headerName) : null;

  // Save is gated on every error: empty name, invalid name, invalid
  // value, capability violation. Mirrors the workbench editor's
  // `isRuleComplete` contract — broken edits never reach the rule
  // store.
  const canSave =
    editable &&
    isDirty &&
    !saving &&
    trimmedName.length > 0 &&
    nameValidation.valid &&
    valueValidation.valid &&
    (!capability || capability.allowed);
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  const openInEditor = () => {
    const uid = liveRule?.uid ?? ctx?.ruleUid;
    if (!uid) return;
    void openWorkspace({ kind: 'edit-rule', uid }, 'devpanel').then(() => onClose());
  };

  const ruleDeleted = !liveRule && !!ctx;

  const popoverNode = (
    <div
      ref={popoverRef}
      role="dialog"
      data-rule-popover-root=""
      className="dt-popover-scroll"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        // Absolute inside the inspector root (so its overflow clips us); fixed
        // when there's no container to portal into (degraded fallback).
        position: boundsEl ? 'absolute' : 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: 12,
        // Footer-tracked cap (both sides): `usePopoverPlacement` measures the
        // status bar's real top and shrinks this on resize so the bottom stays
        // above the footer and the content scrolls inside, whether the popover
        // opened below the row or flipped above it.
        maxHeight: position.maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        visibility: measured ? 'visible' : 'hidden',
        opacity: measured && visible ? 1 : 0,
        transform: measured && visible ? 'scale(1)' : 'scale(0.96)',
        transformOrigin: `${position.side === 'above' ? 'bottom' : 'top'} left`,
        transition: 'opacity 120ms ease-out, transform 120ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {buildRuleIcon({
            ruleType,
            rule: liveRule ?? undefined,
            isActive: liveRule?.enabled ?? true,
            compactArrow: true,
            size: 14,
          })}
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
          title={ruleName}
        >
          {ruleName}
        </span>
        {liveRuleUid && (
          <PresenceBadge entityType={RULE_ENTITY_TYPE} entityId={liveRuleUid} excludeInstanceId={localInstanceId} />
        )}
        {!ruleDeleted && ruleEdited && (
          <Tag color="gold" style={{ marginInlineEnd: 0, fontSize: 10 }}>
            Rule edited
          </Tag>
        )}
        {!ruleDeleted &&
          !ruleEdited &&
          ctx &&
          ((isSnapshotResolutionReliable(ctx.snapshotMod) &&
            currentResolvedValue != null &&
            ctx.snapshotMod.valueResolved != null &&
            ctx.snapshotMod.valueResolved !== currentResolvedValue) ||
            (!ctx.snapshotMod.headerName.includes('{{') &&
              currentResolvedName != null &&
              currentResolvedName !== ctx.snapshotMod.headerName)) && (
            <Tag color="gold" style={{ marginInlineEnd: 0, fontSize: 10 }}>
              Variable changed
            </Tag>
          )}
        {ruleDeleted && (
          <Tag color="red" style={{ marginInlineEnd: 0, fontSize: 10 }}>
            Deleted
          </Tag>
        )}
        {!ruleDeleted &&
          applicability &&
          applicability.kind !== 'will-fire' &&
          applicability.kind !== 'rule-deleted' && (
            <Tag color="red" style={{ marginInlineEnd: 0, fontSize: 10 }} title={tagTitleFor(applicability.kind)}>
              {tagLabelFor(applicability.kind)}
            </Tag>
          )}
        <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>{RULE_TYPE_LABEL[ruleType]}</Tag>
      </div>

      {ctx && attribution && (
        <SnapshotBlock
          attribution={attribution}
          ctx={ctx}
          liveRule={liveRule}
          currentMod={currentMod}
          ruleEdited={ruleEdited}
          collectionId={collectionId}
          currentResolvedValue={currentResolvedValue ?? null}
          currentResolvedName={currentResolvedName ?? null}
          applicability={applicability ?? null}
        />
      )}

      {editable ? (
        // EntityScope binds the inner EntityField wrappers to the
        // popover's rule. headerModUid is the row's persisted uid;
        // when null (rule deleted, or non-editable target), the
        // EntityField wrappers stay silent on focus.
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRuleUid}>
          {/* Top row: operation + name + (merge sep). Editable VALUE moved
              below so a long token-style value gets a wide multiline
              surface and never pushes the operation/name into a wrap. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Select
              size="small"
              value={draft.operation}
              onChange={(op) => updateDraft({ operation: op })}
              options={OPERATION_OPTIONS}
              // Width sized so the longest option label ("Add / Replace")
              // fits without truncation. Earlier 100 px clipped to "Add /
              // Re…", which obscured what the operation was.
              style={{ width: 140, flexShrink: 0 }}
              // Popover container's stacking context is z=1080. The
              // antd Select dropdown defaults below that — lift it
              // explicitly so the menu floats above the popover.
              dropdownStyle={{ zIndex: 1090 }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              {headerModUid && target ? (
                <EntityField path={RULE_FIELD.headerMod(target.direction, headerModUid, 'headerName')}>
                  <TemplateInput
                    size="small"
                    value={draft.headerName}
                    onChange={(v) => updateDraft({ headerName: v })}
                    placeholder="Header Name"
                    suggestionContext={{ collectionId }}
                  />
                </EntityField>
              ) : (
                <TemplateInput
                  size="small"
                  value={draft.headerName}
                  onChange={(v) => updateDraft({ headerName: v })}
                  placeholder="Header Name"
                  suggestionContext={{ collectionId }}
                />
              )}
              {headerNameConflict && headerNamePath && (
                <ConflictDiffChip
                  theirs={headerNameConflict.theirs}
                  base={headerNameConflict.base}
                  local={draft.headerName ?? ''}
                  remote={headerNameConflict.remote}
                  onTakeTheirs={() => {
                    setDraft((prev) => ({ ...prev, headerName: headerNameConflict.theirs }));
                    conflicts.acceptTheirs(headerNamePath, headerNameConflict.theirs);
                  }}
                  onKeepMine={() => conflicts.dismiss(headerNamePath)}
                />
              )}
            </div>
            {draft.operation === 'merge' && (
              <input
                type="text"
                value={draft.mergeSeparator ?? ''}
                onChange={(e) => updateDraft({ mergeSeparator: e.target.value })}
                placeholder="; "
                title="Merge separator"
                style={{
                  width: 36,
                  textAlign: 'center',
                  fontFamily: token.fontFamilyCode,
                  fontSize: 12,
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadius,
                  padding: '0 4px',
                  height: 24,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
          {draft.operation !== 'remove' && (
            // Multiline value surface. Long token-style values
            // (Bearer JWTs, base64 blobs) used to overflow horizontally
            // and corrupted the {{ref}} highlight rendering. Cap the
            // visible area at ~4 lines and scroll vertically inside.
            // `--oh-multiline-cap` is declared in panel.css :root.
            <div
              style={{ marginTop: 6, width: '100%', minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 4 }}
            >
              {headerModUid && target ? (
                <EntityField path={RULE_FIELD.headerMod(target.direction, headerModUid, 'value')}>
                  <TemplateInput
                    size="small"
                    multiline
                    value={draft.value}
                    onChange={(v) => updateDraft({ value: v })}
                    placeholder={draft.operation === 'merge' ? 'Value to append' : 'Header Value'}
                    suggestionContext={{ collectionId }}
                    style={{ width: '100%', maxHeight: 'var(--oh-multiline-cap, 96px)', minHeight: 32 }}
                  />
                </EntityField>
              ) : (
                <TemplateInput
                  size="small"
                  multiline
                  value={draft.value}
                  onChange={(v) => updateDraft({ value: v })}
                  placeholder={draft.operation === 'merge' ? 'Value to append' : 'Header Value'}
                  suggestionContext={{ collectionId }}
                  style={{ width: '100%', maxHeight: 'var(--oh-multiline-cap, 96px)', minHeight: 32 }}
                />
              )}
              {valueConflict && valuePath && (
                <ConflictDiffChip
                  theirs={valueConflict.theirs}
                  base={valueConflict.base}
                  local={draft.value ?? ''}
                  remote={valueConflict.remote}
                  onTakeTheirs={() => {
                    setDraft((prev) => ({ ...prev, value: valueConflict.theirs }));
                    conflicts.acceptTheirs(valuePath, valueConflict.theirs);
                  }}
                  onKeepMine={() => conflicts.dismiss(valuePath)}
                />
              )}
            </div>
          )}
          {/* Inline validation errors. Capability errors keep the
              "Switch to <suggestion>" affordance so the user can fix
              it in one click. Name / value errors are read-only. */}
          {!nameValidation.valid && (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorError, lineHeight: 1.4 }}>
              {nameValidation.message || 'Invalid header name.'}
            </div>
          )}
          {!valueValidation.valid && (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorError, lineHeight: 1.4 }}>
              {valueValidation.message || 'Invalid header value.'}
            </div>
          )}
          {capability && !capability.allowed && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: token.colorError,
                lineHeight: 1.4,
              }}
            >
              {capability.reason}
              {capability.suggestion && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => updateDraft({ operation: capability.suggestion as HeaderOperation })}
                  style={{ padding: '0 0 0 6px', height: 'auto', fontSize: 11 }}
                >
                  Switch to {capability.suggestion}
                </Button>
              )}
            </div>
          )}
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {ruleDeleted
            ? 'This rule has been deleted. The capture above shows what it did when it fired.'
            : ruleType === 'header' && !target
              ? 'Open in workspace to inspect or change this rule.'
              : ruleType === 'header'
                ? 'The matching modification has been removed from the rule. Open in workspace to recreate or adjust it.'
                : `${RULE_TYPE_LABEL[ruleType]} rules are edited in the workbench.`}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          gap: 8,
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={openInEditor}
          style={{ padding: 0, fontSize: 11 }}
          disabled={!liveRule}
        >
          Open in workspace →
        </Button>
        {editable && (
          <Tooltip
            title={<ShortcutHintTitle label={saveLabel}>Save</ShortcutHintTitle>}
            placement="bottomRight"
            zIndex={1090}
          >
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!canSave}
              onClick={() => void handleSave()}
              style={{
                fontSize: 11,
                ...(canSave ? { background: '#f5722d', borderColor: '#f5722d' } : {}),
              }}
            >
              Save
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  // Portal into the inspector root so the root's `overflow: hidden` clips the
  // popover and its footer covers any graze. Fall back to inline render (fixed
  // positioning) when no container resolves.
  return boundsEl ? createPortal(popoverNode, boundsEl) : popoverNode;
}

interface SnapshotBlockProps {
  attribution: HeaderAttribution;
  ctx: RuleAttributionContext;
  /** Live rule from the renderer mirror — passed in so SnapshotBlock
   *  shows the freshest "future" view without reaching into a stale
   *  attribution-cached field. */
  liveRule: Rule | null;
  /** Live mod (or null if removed) — derived once in the parent via
   *  `findCurrentMod(liveRule, ctx)`. */
  currentMod: HeaderModification | null;
  /** Whether the live rule diverges from the snapshot — derived once
   *  in the parent via `isAttributionEdited(liveRule, ctx)`. */
  ruleEdited: boolean;
  collectionId: string | undefined;
  /** Live resolution of the current rule's value template. Only
   *  rendered when it differs from the snapshot's `valueResolved`. */
  currentResolvedValue: string | null;
  /** Live resolution of the current rule's headerName template.
   *  Used to surface name drift (var referenced by name resolves
   *  differently now). */
  currentResolvedName: string | null;
  /** Live-rule firing verdict — drives the Future row's content. */
  applicability: RuleApplicability | null;
}

/**
 * Read-only "what happened on this request" block.
 *
 * Layout:
 *   - Original (server, or "(absent — added by rule)")
 *   - Applied for this request — the snapshot's resolved value, plus
 *     a small monospaced template hint when the template differs from
 *     the resolved value (i.e. the user wrote `{{vars}}`).
 *
 * Clearly labeled as a snapshot so users understand the editor below
 * does NOT retroactively change this — it's a frozen capture.
 */
function SnapshotBlock({
  attribution,
  ctx,
  liveRule,
  currentMod,
  ruleEdited,
  collectionId,
  currentResolvedValue,
  currentResolvedName,
  applicability,
}: SnapshotBlockProps) {
  const { token } = theme.useToken();
  const mod = ctx.snapshotMod;
  // Long token-style values (Bearer JWTs, base64 blobs, cookies) used
  // to render at full height inside the snapshot block — for a 3 KB
  // JWT that meant the popover was 800 px tall and pushed the editable
  // form below the fold. Cap the visible area at ~4 lines with inner
  // vertical scroll. `display: inline-block` is required for max-height
  // / overflow to take on a span; `flex: 1; minWidth: 0` lets the value
  // shrink to the row's available width inside the flex parent and
  // wrap rather than overflow horizontally.
  const valueStyle: React.CSSProperties = {
    fontFamily: token.fontFamilyCode,
    fontSize: 12,
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
    display: 'inline-block',
    flex: 1,
    minWidth: 0,
    // Same cap as the editable value field below — see panel.css :root.
    maxHeight: 'var(--oh-multiline-cap, 96px)',
    overflowY: 'auto',
    overflowX: 'hidden',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    flexShrink: 0,
    minWidth: 64,
    paddingTop: 1,
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    // `flex-start` (was: baseline) — baseline misaligns when the value
    // is a multi-line scrollable block.
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
  };
  const blockStyle: React.CSSProperties = {
    background: token.colorFillQuaternary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    padding: '6px 10px',
    marginBottom: 8,
  };

  const opLabel = (() => {
    switch (mod.operation) {
      case 'override':
        return attribution.kind === 'added' ? 'inject' : 'override';
      case 'add':
        return 'append';
      case 'merge':
        return 'merge';
      case 'remove':
        return 'remove';
    }
  })();

  // `originalValue` is absent on a corroborated mod over a post-rewrite
  // capture (the pre-rule value was never recorded) — normalize to null.
  const originalValue =
    attribution.kind === 'modified' || attribution.kind === 'removed' ? (attribution.originalValue ?? null) : null;
  const cancelledInjection =
    attribution.kind === 'removed' && attribution.source === 'injection' ? attribution.injectingRule : undefined;
  const appliedValue = snapshotAppliedValue(mod);

  // Now / Future framing:
  //   - "Now"    — what this request actually got (the snapshot).
  //   - "Future" — what the live rule would produce for the next request.
  //
  // Future content is driven by the parent-computed `applicability`
  // verdict — anything other than `will-fire` short-circuits the
  // resolved-value preview with a specific reason (rule disabled,
  // conditions mismatch, unresolvable template). For `will-fire`,
  // we surface the value- or op-drift cases.
  const futureKind = computeFutureKind(applicability, liveRule, currentMod, mod, currentResolvedValue);
  const showFutureRow = futureKind.kind !== 'none';

  // Hide the `Original` row when it would be identical to `Now`. Common
  // case: request-direction overrides where Chrome's HAR captured the
  // post-rule value as the "server" value, so `originalValue` ===
  // `appliedValue`. The row would carry no information.
  const showOriginalRow = originalValue !== null && (mod.operation === 'remove' || originalValue !== appliedValue);

  // Name drift: same reliability gate as value drift — if the
  // snapshot's resolved name still contains `{{`, resolution failed at
  // fire time (TOTP in name, broken ref) and we have no honest
  // baseline to compare against. Skip the drift signal in that case.
  const nameDrifted =
    !ruleEdited &&
    !mod.headerName.includes('{{') &&
    currentResolvedName != null &&
    currentResolvedName !== mod.headerName;

  // Mutated-headline byline: one short line summarizing op + direction +
  // header name. When the user wrote a `{{var}}` in the name, also
  // show the template alongside the resolved name so the user sees
  // both representations.
  const headline = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: token.colorTextSecondary,
        marginBottom: 4,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 600 }}>{opLabel}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>{mod.direction}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span style={{ fontFamily: token.fontFamilyCode }}>{mod.headerName}</span>
      {mod.headerNameTemplate && (
        <span
          style={{ fontFamily: token.fontFamilyCode, opacity: 0.6 }}
          title="Template before variable resolution at fire time"
        >
          ({mod.headerNameTemplate})
        </span>
      )}
      {nameDrifted && currentResolvedName != null && (
        <>
          <span style={{ opacity: 0.6 }}>→</span>
          <span
            style={{ fontFamily: token.fontFamilyCode, color: token.colorWarning }}
            title="Same template — a referenced variable now resolves to a different header name"
          >
            {currentResolvedName}
          </span>
        </>
      )}
      {cancelledInjection && (
        <>
          <span style={{ opacity: 0.6 }}>·</span>
          <span style={{ fontStyle: 'italic' }}>cancels "{cancelledInjection.ruleName}"</span>
        </>
      )}
    </div>
  );

  return (
    <div style={blockStyle}>
      {headline}

      {/* Original: server's pre-rule value or the value of the rule
       *  whose injection was cancelled. Hidden when it would equal
       *  Now — typical for request-direction overrides where Chrome's
       *  HAR has already captured the post-rule value as the
       *  "server" baseline. */}
      {showOriginalRow && (
        <div style={rowStyle}>
          <span style={labelStyle}>Original</span>
          <span style={valueStyle}>{originalValue}</span>
        </div>
      )}

      {/* Now: what this request actually got. */}
      <div style={rowStyle}>
        <span style={labelStyle}>Now</span>
        {mod.operation === 'remove' ? (
          <span
            style={{
              ...valueStyle,
              fontStyle: 'italic',
              color: token.colorTextTertiary,
              textDecoration: 'line-through',
            }}
          >
            removed
          </span>
        ) : appliedValue ? (
          <span style={valueStyle}>
            <ResolvedHeaderValue value={appliedValue} collectionId={collectionId} />
          </span>
        ) : (
          <span style={{ ...valueStyle, fontStyle: 'italic', color: token.colorTextTertiary }}>(empty)</span>
        )}
      </div>

      {/* Future: what the next request would get. Driven by the
       *  applicability verdict so we surface specific reasons (rule
       *  disabled, conditions mismatch, unresolvable template) rather
       *  than cheerfully previewing a value that wouldn't actually fire. */}
      {showFutureRow && (
        <div style={rowStyle} title="What the next matching request would get">
          <span style={{ ...labelStyle, color: token.colorWarning }}>Future</span>
          <FutureValue kind={futureKind} collectionId={collectionId} token={token} valueStyle={valueStyle} />
        </div>
      )}

      {/* Optional: TOTP / unreliable-resolution disclosure. */}
      {!isSnapshotResolutionReliable(mod) && (
        <div
          style={{
            marginTop: 2,
            fontSize: 10,
            fontStyle: 'italic',
            color: token.colorTextTertiary,
            lineHeight: 1.3,
          }}
        >
          TOTP / deferred refs are resolved at request time and not captured here.
        </div>
      )}

      {/* Sibling mods: other actions on the same rule that fired on
       *  this same request. Surfaced compactly so the user knows the
       *  rule has a wider footprint than this single row. Each entry
       *  is read-only here — to edit, the user hovers that header's
       *  row in the inspector list. */}
      {ctx.siblingMods.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: `1px dashed ${token.colorBorderSecondary}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: token.colorTextTertiary,
              marginBottom: 4,
            }}
          >
            Also by this rule on this request
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ctx.siblingMods.map((s, i) => (
              <SiblingModRow key={`${s.direction}|${s.headerName}|${s.operation}|${i}`} mod={s} token={token} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SiblingModRow({ mod, token }: { mod: RuleSnapshotHeaderMod; token: GlobalToken }) {
  const opGlyph = (() => {
    switch (mod.operation) {
      case 'override':
        return '↻';
      case 'add':
        return '+';
      case 'merge':
        return '⊕';
      case 'remove':
        return '−';
    }
  })();
  const value = mod.operation === 'remove' ? null : (mod.valueResolved ?? mod.valueTemplate ?? '');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        fontFamily: token.fontFamilyCode,
        fontSize: 11,
        color: token.colorTextSecondary,
        lineHeight: 1.4,
      }}
      title={`${mod.direction} ${mod.operation} ${mod.headerName}${value !== null ? ` = ${value}` : ''}`}
    >
      <span style={{ color: token.colorTextTertiary, width: 12, textAlign: 'center', flexShrink: 0 }}>{opGlyph}</span>
      <span style={{ color: token.colorTextTertiary, fontSize: 10, flexShrink: 0 }}>
        {mod.direction === 'request' ? 'req' : 'res'}
      </span>
      <span style={{ flexShrink: 0 }}>{mod.headerName}</span>
      {value !== null && (
        <>
          <span style={{ color: token.colorTextTertiary }}>:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        </>
      )}
    </div>
  );
}

/**
 * Fallback mod lookup for callers that didn't supply an attribution
 * (e.g. legacy hover paths). Mirrors the previous behavior of finding
 * a current mod by direction + name + operation.
 */
function findFallbackMod(
  rule: HeaderRule | null,
  target: RuleHoverPopoverTarget | undefined,
): HeaderModification | null {
  if (!rule || !target) return null;
  const list = target.direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
  const lower = target.headerName.toLowerCase();
  const exact = list.find((m) => m.headerName.toLowerCase() === lower && m.operation === target.operation);
  if (exact) return exact;
  return list.find((m) => m.headerName.toLowerCase() === lower) ?? null;
}

function surfaceResult(
  result: RuleMutationResult,
  message: ReturnType<typeof App.useApp>['message'],
  onSuccess: () => void,
): void {
  if (result.ok) {
    message.success('Rule updated');
    onSuccess();
    return;
  }
  switch (result.reason) {
    case 'not-found':
      message.error('Rule not found — it may have been deleted.');
      return;
    case 'other':
      message.error(result.message ?? 'Save failed');
      return;
  }
}
