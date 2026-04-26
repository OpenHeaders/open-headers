/**
 * RuleHoverPopover — inline-edit popover for the single rule
 * modification that produced an attributed header row in the inspector.
 *
 * Mirrors `VariableHoverPopover`'s shape — header pill with the rule
 * name, an editable mod row (Operation / HeaderName / Value via the
 * shared TemplateInput so `{{vars}}` keep their hover popover even
 * inside this one), Save with the user's bound shortcut, an
 * Open-in-editor link.
 *
 * Save path: read the rule from this popover's own `useRules()`
 * snapshot, splice the edited mod into the matching direction's
 * modifications array, persist via `useRuleMutator.updateRule` with
 * the rule's loaded `version` for stale-draft detection. Read /
 * splice / write all happen against ONE snapshot — same race-avoidance
 * pattern the variable popover uses (see `useVariableMutator` doc).
 *
 * Non-header rules degrade to a one-line summary + the editor link
 * (no inline edit). Header attribution rows are the only ones that
 * anchor this popover today — other rule types appear in the bottom
 * "Matched Rules" panel where the editor link is the right affordance.
 */

import { SaveOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@components/ShortcutKbd';
import { useRuleMutator } from '@hooks/useRuleMutator';
import { useRules } from '@hooks/useRules';
import type { MutationResult } from '@hooks/useVariableMutator';
import type { V5 } from '@openheaders/core/types';
import { getHeaderOperationCapability, getHeaderSuggestions } from '@openheaders/core/utils';
import { App, AutoComplete, Button, Select, Tag, Tooltip, theme } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePopoverPlacement } from '@/shared/use-popover-placement';
import { openWorkspace } from '@/shared/workspace-intent';
import { buildRuleIcon } from '@/workbench/components/shared/rule-icon';
import { TemplateInput } from '@/workbench/components/template-input';
import { buildChordsFromEvent, useShortcutLabel } from '@/workbench/hooks/useWorkspaceShortcuts';
import { useSettingValue } from '@/workbench/settings/hooks';
import { findRuleCollectionId } from '../data/rule-collection';

export interface RuleHoverPopoverTarget {
  direction: 'request' | 'response';
  headerName: string;
  operation: V5.HeaderOperation;
}

export interface RuleHoverPopoverProps {
  anchorEl: HTMLElement;
  rule: V5.Rule;
  target?: RuleHoverPopoverTarget;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Host-controlled visibility for the open/close transition.
   *  Defaults to true so the popover can be used standalone. */
  visible?: boolean;
}

const POPOVER_WIDTH = 460;

const OPERATION_OPTIONS: { value: V5.HeaderOperation; label: string }[] = [
  { value: 'override', label: 'Override' },
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

/** Find the modification entry inside the rule that produced the row.
 *  Match by direction + name + operation (case-insensitive name). For
 *  multiple appends with the same name, the first match wins — there's
 *  no per-fire identity to disambiguate further, and editing any of
 *  them is what the user expects. */
function findHeaderMod(
  rule: V5.HeaderRule,
  target: RuleHoverPopoverTarget,
): { index: number; mod: V5.HeaderModification } | null {
  const list = target.direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
  const lower = target.headerName.toLowerCase();
  const idx = list.findIndex((m) => m.headerName.toLowerCase() === lower && m.operation === target.operation);
  if (idx === -1) {
    const fallbackIdx = list.findIndex((m) => m.headerName.toLowerCase() === lower);
    if (fallbackIdx === -1) return null;
    return { index: fallbackIdx, mod: list[fallbackIdx] };
  }
  return { index: idx, mod: list[idx] };
}

export function RuleHoverPopover({
  anchorEl,
  rule,
  target,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: RuleHoverPopoverProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { rules, localCollections } = useRules();
  const mutator = useRuleMutator();

  // Pull the live rule from THIS popover's snapshot so the read +
  // splice + write all happen against one baseline. Same race
  // protection as the variable popover; see `useRuleMutator` doc.
  const liveRule = useMemo(() => rules.find((r) => r.uid === rule.uid) ?? rule, [rules, rule]);
  const collectionId = useMemo(() => findRuleCollectionId(liveRule, localCollections), [liveRule, localCollections]);

  const isHeader = liveRule.type === 'header' && !!target;
  const headerRule = isHeader ? (liveRule as V5.HeaderRule) : null;
  const targetMod = headerRule && target ? findHeaderMod(headerRule, target) : null;

  const [draft, setDraft] = useState<ModDraft>(() => ({
    operation: targetMod?.mod.operation ?? target?.operation ?? 'override',
    headerName: targetMod?.mod.headerName ?? target?.headerName ?? '',
    value: targetMod?.mod.value ?? '',
    mergeSeparator: targetMod?.mod.mergeSeparator,
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
    if (!targetMod) return;
    setDraft({
      operation: targetMod.mod.operation,
      headerName: targetMod.mod.headerName,
      value: targetMod.mod.value ?? '',
      mergeSeparator: targetMod.mod.mergeSeparator,
    });
  }, [targetMod?.mod.operation, targetMod?.mod.headerName, targetMod?.mod.value, targetMod?.mod.mergeSeparator]);

  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH);

  const updateDraft = (patch: Partial<ModDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDraftDirty(true);
  };

  const handleSave = async () => {
    if (!headerRule || !targetMod) return;
    const live = draftRef.current;
    setSaving(true);
    try {
      const direction = target!.direction;
      const list = direction === 'request' ? headerRule.action.requestHeaders : headerRule.action.responseHeaders;
      const next = list.slice();
      const isRemove = live.operation === 'remove';
      next[targetMod.index] = isRemove
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
          requestHeaders: direction === 'request' ? next : headerRule.action.requestHeaders,
          responseHeaders: direction === 'response' ? next : headerRule.action.responseHeaders,
        },
      };
      const result: MutationResult = await mutator.updateRule(rule.uid, updates, liveRule.version);
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

  const editable = isHeader && !!targetMod;
  const canSave = editable && draftDirty && !saving && draft.headerName.trim().length > 0;
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  const capability = editable
    ? getHeaderOperationCapability(target!.direction, draft.operation, draft.headerName)
    : null;

  const headerSuggestions = editable
    ? getHeaderSuggestions(target!.direction, draft.operation).map((h) => ({ value: h, label: h }))
    : [];

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: rule.uid }, 'devpanel').then(() => onClose());
  };

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
        // Visibility = AND of:
        //   `measured` — placement hook has seen layout settle across
        //     two frames (open transition guard, prevents flicker).
        //   `visible` — host hasn't started the close animation
        //     (close transition guard, mirrors the open transition).
        // Either being false fades opacity / transform to 0; both
        // true reveals at full opacity. The CSS transition handles
        // the animation in both directions.
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
            ruleType: liveRule.type,
            rule: liveRule,
            isActive: liveRule.enabled,
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
          title={liveRule.name}
        >
          {liveRule.name}
        </span>
        <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>{RULE_TYPE_LABEL[liveRule.type]}</Tag>
      </div>

      {editable ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Select
              size="small"
              value={draft.operation}
              onChange={(op) => updateDraft({ operation: op })}
              options={OPERATION_OPTIONS}
              style={{ width: 100, flexShrink: 0 }}
            />
            <AutoComplete
              size="small"
              value={draft.headerName}
              onChange={(name) => updateDraft({ headerName: name })}
              options={headerSuggestions}
              filterOption={(input, option) =>
                (option?.value ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Header Name"
              style={{ width: 150, flexShrink: 0 }}
            />
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
          {capability && !capability.allowed && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: token.colorWarning,
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
          {liveRule.type === 'header'
            ? 'Open in editor to edit this rule.'
            : `${RULE_TYPE_LABEL[liveRule.type]} rules are edited in the workbench.`}
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
        <Button type="link" size="small" onClick={openInEditor} style={{ padding: 0, fontSize: 11 }}>
          Open in editor →
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
