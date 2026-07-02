/**
 * RuleHoverPopover — inline-edit popover anchored to a header row in
 * the inspector. The header-mod plug-in body of the shared
 * `QuickEditorShell` (which owns placement, title row, awareness and
 * the footer).
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

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { HeaderModification, HeaderOperation, HeaderRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import {
  ConflictDiffChip,
  EntityField,
  EntityScopeProvider,
  RULE_FIELD,
} from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { useRuleConflicts } from '@openheaders/ui/workbench/components/rule-fields/use-rule-conflicts';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { App, Button, Select, Tag, theme } from 'antd';
import { useMemo, useRef } from 'react';
import {
  findCurrentMod,
  type HeaderAttribution,
  isAttributionEdited,
} from '../data/header-attribution';
import type { RuleApplicability } from '../data/rule-applicability';
import { findRuleCollectionId } from '../data/rule-collection';
import { QuickEditorShell, RULE_TYPE_LABEL } from './rule-quick-editor/QuickEditorShell';
import { isSnapshotResolutionReliable, ruleCtxFromAttribution, tagLabelFor, tagTitleFor } from './rule-hover-format';
import { SnapshotBlock } from './SnapshotBlock';
import { useModDraft } from './use-mod-draft';
import { useRuleHoverSave } from './use-rule-hover-save';

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

const OPERATION_OPTIONS: { value: HeaderOperation; label: string }[] = [
  // Mirror the workbench HeaderRuleFields labels so the popover and the
  // full editor agree on what each op is called.
  { value: 'override', label: 'Add / Replace' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
  { value: 'merge', label: 'Merge' },
];

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
  // The panel mounts `<RuleProvider surfaceId="panel">` (App.tsx), so
  // `useRules()` returns the workspace's collections here — collection-
  // scoped variables (`{{collection.X}}`) resolve in the Inspector just
  // like the workbench. The live rule is still pulled reactively from
  // the rule sync mirror via `useLiveRule(uid)`, which updates the
  // popover on commits from any surface.
  const { localCollections } = useRules();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

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

  // Baseline coordination ref — the seam between the draft hook (whose
  // re-prime / auto-rebase effects advance the conflict tracker's
  // baseline) and `useRuleConflicts` (which consumes the hook's
  // `isDirty`, so it must be called after it). The tracker's setter is
  // wired in below; the hook's effects fire post-render, by which time
  // the ref is populated. Same seam as `RuleEditor`'s `setBaselineRef`.
  const setConflictBaselineRef = useRef<(r: Rule) => void>(() => undefined);
  const { draft, setDraft, draftRef, updateDraft, isDirty } = useModDraft({
    currentMod,
    target,
    liveRule,
    setConflictBaselineRef,
  });

  const liveRuleUid = liveRule?.uid ?? null;
  // Devpanel popover edits one specific header mod. Identity is the mod's
  // persisted uid (stable through reorders / list mutations the user might
  // make in the workbench at the same time). Used by the EntityField
  // wrappers below — the path they publish must match the workbench's
  // for the same row.
  const headerModUid = currentMod?.uid ?? null;

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
  setConflictBaselineRef.current = conflicts.setBaseline;
  // Per-row chip data — recomputed against the current draft each
  // render. Returns null when no peer divergence at that path.
  const headerNamePath =
    headerModUid && target ? RULE_FIELD.headerMod(target.direction, headerModUid, 'headerName') : null;
  const valuePath = headerModUid && target ? RULE_FIELD.headerMod(target.direction, headerModUid, 'value') : null;
  const headerNameConflict = headerNamePath ? conflicts.getConflict(headerNamePath, draft.headerName) : null;
  const valueConflict = valuePath ? conflicts.getConflict(valuePath, draft.value) : null;

  const editable = isHeader && !!currentMod && !!headerRule;

  const { saving, canSave, nameValidation, valueValidation, capability, handleSave, saveLabel } = useRuleHoverSave({
    headerRule,
    currentMod,
    target,
    draft,
    draftRef,
    isDirty,
    editable,
    mutator,
    message,
    clearDismissed: conflicts.clearDismissed,
    onClose,
  });

  const openInEditor = () => {
    const uid = liveRule?.uid ?? ctx?.ruleUid;
    if (!uid) return;
    void openWorkspace({ kind: 'edit-rule', uid }, 'devpanel').then(() => onClose());
  };

  const ruleDeleted = !liveRule && !!ctx;

  const tags = (
    <>
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
    </>
  );

  const snapshot = ctx && attribution && (
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
  );

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={liveRule}
      ruleType={ruleType}
      ruleName={ruleName}
      liveRuleUid={liveRuleUid}
      isDirty={isDirty}
      tags={tags}
      snapshot={snapshot}
      onOpenInEditor={openInEditor}
      save={editable ? { saving, canSave, saveLabel, onSave: () => void handleSave() } : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
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
    </QuickEditorShell>
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
