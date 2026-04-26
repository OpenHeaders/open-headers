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
import { ShortcutHintTitle } from '@components/ShortcutKbd';
import { useRuleMutator } from '@hooks/useRuleMutator';
import { useRules } from '@hooks/useRules';
import type { MutationResult } from '@hooks/useVariableMutator';
import type { V5 } from '@openheaders/core/types';
import { getHeaderOperationCapability, validateHeaderName, validateHeaderValue } from '@openheaders/core/utils';
import { App, Button, Select, Tag, Tooltip, theme } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePopoverPlacement } from '@/shared/use-popover-placement';
import { openWorkspace } from '@/shared/workspace-intent';
import type { RuleSnapshotHeaderMod } from '@/types/telemetry';
import { buildRuleIcon } from '@/workbench/components/shared/rule-icon';
import { TemplateInput } from '@/workbench/components/template-input';
import { buildChordsFromEvent, useShortcutLabel } from '@/workbench/hooks/useWorkspaceShortcuts';
import { useSettingValue } from '@/workbench/settings/hooks';
import type { HeaderAttribution, RuleAttributionContext } from '../data/header-attribution';
import type { RuleApplicability } from '../data/rule-applicability';
import { findRuleCollectionId } from '../data/rule-collection';
import { ResolvedHeaderValue } from './ResolvedHeaderValue';

export interface RuleHoverPopoverTarget {
  direction: 'request' | 'response';
  headerName: string;
  operation: V5.HeaderOperation;
}

export interface RuleHoverPopoverProps {
  anchorEl: HTMLElement;
  /** Live rule for editing. Null when the rule was deleted since the
   *  fire — the popover still renders the snapshot from `attribution`. */
  rule: V5.Rule | null;
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

const OPERATION_OPTIONS: { value: V5.HeaderOperation; label: string }[] = [
  // Mirror the workbench HeaderRuleFields labels so the popover and the
  // full editor agree on what each op is called.
  { value: 'override', label: 'Add / Replace' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
  { value: 'merge', label: 'Merge' },
];

const RULE_TYPE_LABEL: Record<V5.Rule['type'], string> = {
  header: 'Header',
  redirect: 'Redirect',
  block: 'Block',
  delay: 'Delay',
  inject: 'Inject',
  body: 'Body',
  mock: 'Mock',
  'query-param': 'Query Param',
};

interface ModDraft {
  operation: V5.HeaderOperation;
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
  ctx: RuleAttributionContext,
  mod: RuleSnapshotHeaderMod,
  currentResolvedValue: string | null,
): FutureKind {
  // No applicability provided (e.g. legacy caller path) — fall back
  // to the structural flags on `ctx` so the popover is still useful.
  if (!applicability) {
    if (ctx.currentRule == null) return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'rule-deleted' };
    if (ctx.currentMod == null) return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'mod-gone' };
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
    case 'will-fire':
    default: {
      // Live rule still fires — surface the drift cases relative to
      // the snapshot.
      if (ctx.currentMod?.operation === 'remove' && mod.operation !== 'remove') {
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
  const { rules, localCollections } = useRules();
  const mutator = useRuleMutator();

  const ctx = ruleCtxFromAttribution(attribution);

  // Pull the live rule from THIS popover's snapshot of `useRules()` so
  // the read + splice + write all happen against one baseline (same
  // race-protection pattern as the variable popover). When the rule
  // was deleted, both `rule` and the lookup return null — popover
  // degrades to read-only.
  const liveRule = useMemo<V5.Rule | null>(() => {
    if (rule) return rules.find((r) => r.uid === rule.uid) ?? rule;
    if (ctx) return rules.find((r) => r.uid === ctx.ruleUid) ?? null;
    return null;
  }, [rules, rule, ctx]);

  const collectionId = useMemo(
    () => (liveRule ? findRuleCollectionId(liveRule, localCollections) : undefined),
    [liveRule, localCollections],
  );

  const ruleType = liveRule?.type ?? ctx?.ruleType ?? 'header';
  const ruleName = liveRule?.name ?? ctx?.ruleName ?? '';
  const isHeader = ruleType === 'header' && !!target;
  const headerRule = isHeader && liveRule?.type === 'header' ? (liveRule as V5.HeaderRule) : null;

  // Locate the live mod the editor binds to. Prefer `ctx.currentMod`
  // (already resolved by header-attribution from the snapshot's mod
  // identity); fall back to a direction+name+operation walk for the
  // case where the row was opened from a path that didn't carry an
  // attribution (e.g. legacy hover).
  const currentMod: V5.HeaderModification | null = ctx?.currentMod ?? findFallbackMod(headerRule, target);

  const [draft, setDraft] = useState<ModDraft>(() => ({
    operation: currentMod?.operation ?? target?.operation ?? 'override',
    headerName: currentMod?.headerName ?? target?.headerName ?? '',
    value: currentMod?.value ?? '',
    mergeSeparator: currentMod?.mergeSeparator,
  }));
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Re-prime on rule version bump (another tab saved) only when the
  // user hasn't started editing yet. Mirrors the variable popover's
  // hydration race guard.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the underlying entry changes.
  useEffect(() => {
    if (draftDirty) return;
    if (!currentMod) return;
    setDraft({
      operation: currentMod.operation,
      headerName: currentMod.headerName,
      value: currentMod.value ?? '',
      mergeSeparator: currentMod.mergeSeparator,
    });
  }, [currentMod?.operation, currentMod?.headerName, currentMod?.value, currentMod?.mergeSeparator]);

  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH);

  const updateDraft = (patch: Partial<ModDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDraftDirty(true);
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
      next[idx] = isRemove
        ? { operation: 'remove', headerName: live.headerName }
        : live.operation === 'merge'
          ? {
              operation: 'merge',
              headerName: live.headerName,
              value: live.value,
              mergeSeparator: live.mergeSeparator,
            }
          : { operation: live.operation, headerName: live.headerName, value: live.value };
      const updates: Partial<V5.HeaderRule> = {
        action: {
          requestHeaders: target.direction === 'request' ? next : headerRule.action.requestHeaders,
          responseHeaders: target.direction === 'response' ? next : headerRule.action.responseHeaders,
        },
      };
      const result: MutationResult = await mutator.updateRule(headerRule.uid, updates, headerRule.version);
      surfaceResult(result, message, () => {
        setDraftDirty(false);
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
    draftDirty &&
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

  return (
    <div
      ref={popoverRef}
      role="dialog"
      data-rule-popover-root=""
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: 12,
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
        {!ruleDeleted && ctx?.edited && (
          <Tag color="gold" style={{ marginInlineEnd: 0, fontSize: 10 }}>
            Rule edited
          </Tag>
        )}
        {!ruleDeleted &&
          !ctx?.edited &&
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
          collectionId={collectionId}
          currentResolvedValue={currentResolvedValue ?? null}
          currentResolvedName={currentResolvedName ?? null}
          applicability={applicability ?? null}
        />
      )}

      {editable ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Select
              size="small"
              value={draft.operation}
              onChange={(op) => updateDraft({ operation: op })}
              options={OPERATION_OPTIONS}
              style={{ width: 100, flexShrink: 0 }}
              // Popover container's stacking context is z=1080. The
              // antd Select dropdown defaults below that — lift it
              // explicitly so the menu floats above the popover.
              dropdownStyle={{ zIndex: 1090 }}
            />
            <div style={{ width: 150, flexShrink: 0 }}>
              <TemplateInput
                size="small"
                value={draft.headerName}
                onChange={(v) => updateDraft({ headerName: v })}
                placeholder="Header Name"
                suggestionContext={{ collectionId }}
              />
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
            {draft.operation !== 'remove' && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <TemplateInput
                  size="small"
                  value={draft.value}
                  onChange={(v) => updateDraft({ value: v })}
                  placeholder={draft.operation === 'merge' ? 'Value to append' : 'Header Value'}
                  suggestionContext={{ collectionId }}
                />
              </div>
            )}
          </div>
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
                  onClick={() => updateDraft({ operation: capability.suggestion as V5.HeaderOperation })}
                  style={{ padding: '0 0 0 6px', height: 'auto', fontSize: 11 }}
                >
                  Switch to {capability.suggestion}
                </Button>
              )}
            </div>
          )}
        </>
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
}

interface SnapshotBlockProps {
  attribution: HeaderAttribution;
  ctx: RuleAttributionContext;
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
  collectionId,
  currentResolvedValue,
  currentResolvedName,
  applicability,
}: SnapshotBlockProps) {
  const { token } = theme.useToken();
  const mod = ctx.snapshotMod;
  const valueStyle: React.CSSProperties = {
    fontFamily: token.fontFamilyCode,
    fontSize: 12,
    wordBreak: 'break-all',
    lineHeight: 1.45,
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
    alignItems: 'baseline',
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

  const originalValue =
    attribution.kind === 'modified' || attribution.kind === 'removed' ? attribution.originalValue : null;
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
  const futureKind = computeFutureKind(applicability, ctx, mod, currentResolvedValue);
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
    !ctx.edited &&
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
  rule: V5.HeaderRule | null,
  target: RuleHoverPopoverTarget | undefined,
): V5.HeaderModification | null {
  if (!rule || !target) return null;
  const list = target.direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
  const lower = target.headerName.toLowerCase();
  const exact = list.find((m) => m.headerName.toLowerCase() === lower && m.operation === target.operation);
  if (exact) return exact;
  return list.find((m) => m.headerName.toLowerCase() === lower) ?? null;
}

function surfaceResult(
  result: MutationResult,
  message: ReturnType<typeof App.useApp>['message'],
  onSuccess: () => void,
): void {
  if (result.ok) {
    message.success('Rule updated');
    onSuccess();
    return;
  }
  switch (result.reason) {
    case 'stale-draft':
      message.warning('Rule changed elsewhere — close and reopen the popover.');
      return;
    case 'not-found':
      message.error('Rule not found — it may have been deleted.');
      return;
    case 'duplicate-name':
    case 'other':
      message.error(result.reason === 'other' ? (result.message ?? 'Save failed') : 'Save failed');
      return;
  }
}
