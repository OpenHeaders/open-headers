/**
 * HeaderQuickCreate — the header create-mode body of the shared
 * `QuickEditorShell`. Opened from a server header row's Override button
 * on the Headers tab, pre-filled with that row's name and value
 * (operation Add / Replace). Save mints the rule AND publishes it in
 * one gesture into the workspace's first collection; the footer link
 * hands the CURRENT draft state off to the workbench for full options.
 *
 * Same field layout as the edit body (`RuleHoverPopover`): operation
 * select, template-aware name input, merge separator, multiline
 * template-aware value — minus the snapshot block (nothing fired), the
 * awareness wrappers and the conflict chips (no entity exists yet).
 */

import type { HeaderRuleDraft } from '@openheaders/core/types';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { DetectedValueInput } from '@openheaders/ui/workbench/components/value-editors';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Button, Select, Tag, theme } from 'antd';
import { useRef, useState } from 'react';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import {
  type HeaderDirection,
  type HeaderQuickDraft,
  mergeQuickIntoHeaderDraft,
  seedHeaderQuickDraft,
} from '../../data/rule-create/header-rule-create';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { HEADER_OPERATION_OPTIONS } from './header-operation-options';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useHeaderCreateSave } from './use-header-create-save';
import { useQuickCreateConditions } from './use-quick-create-conditions';
import { useQuickCreateDestination } from './use-quick-create-destination';

export interface HeaderQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-header draft built by the CTA (`rule-draft-bridge`). */
  draft: HeaderRuleDraft;
  direction: HeaderDirection;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function HeaderQuickCreate({
  anchorEl,
  draft,
  direction,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: HeaderQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Seed frozen per popover session (the host remounts per identity);
  // the name pre-fills from it and stays editable via the shell's title.
  const [seed] = useState<HeaderQuickDraft>(() => seedHeaderQuickDraft(draft, direction));
  const [name, setName] = useState(() =>
    generateSmartRuleName(
      { kind: 'header', url: draft.url ?? '', headerName: seed.headerName, headerOperation: seed.operation },
      rules,
    ),
  );
  const [quick, setQuick] = useState<HeaderQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const updateQuick = (patch: Partial<HeaderQuickDraft>) => {
    setQuick((prev) => ({ ...prev, ...patch }));
  };
  const quickDirty = stableStringify(quick) !== stableStringify(seed);

  const cond = useQuickCreateConditions(draft, strategy);
  const isDirty = quickDirty || cond.isDirty;

  const dest = useQuickCreateDestination(draft.url);
  const collectionId = dest.collectionId;

  const { saving, canSave, nameValidation, valueValidation, capability, handleSave, saveLabel } = useHeaderCreateSave({
    quick,
    quickRef,
    direction,
    name,
    destination: dest.forSave,
    workspaceId,
    conditionsRef: cond.conditionsRef,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoHeaderDraft(draft, quickRef.current, direction))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="header"
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={isDirty}
      destination={<QuickDestinationRow api={dest} />}
      conditions={<QuickConditionsRow value={cond.conditions} onChange={cond.setConditions} />}
      tags={
        <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color={direction === 'response' ? 'purple' : 'blue'}>
          {direction === 'response' ? 'Response' : 'Request'}
        </Tag>
      }
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      {/* Same row split as the edit body: operation + name on top, the
          multiline value below so long values never wrap the controls. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Select
          size="small"
          value={quick.operation}
          onChange={(op) => updateQuick({ operation: op })}
          options={HEADER_OPERATION_OPTIONS}
          style={{ width: 140, flexShrink: 0 }}
          dropdownStyle={{ zIndex: 1090 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <TemplateInput
            size="small"
            wrap
            maxRows={4}
            resizable
            allowClear
            value={quick.headerName}
            onChange={(v) => updateQuick({ headerName: v })}
            placeholder="Header Name"
            suggestionContext={{ collectionId }}
          />
        </div>
        {quick.operation === 'merge' && (
          <input
            type="text"
            value={quick.mergeSeparator ?? ''}
            onChange={(e) => updateQuick({ mergeSeparator: e.target.value })}
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
      {quick.operation !== 'remove' && (
        <div style={{ marginTop: 6, width: '100%', minWidth: 0 }}>
          <DetectedValueInput
            editorVariant="compact"
            size="small"
            wrap
            maxRows={4}
            resizable
            allowClear
            value={quick.value}
            onChange={(v) => updateQuick({ value: v })}
            placeholder={quick.operation === 'merge' ? 'Value to append' : 'Header Value'}
            suggestionContext={{ collectionId }}
            style={{ width: '100%' }}
          />
        </div>
      )}
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
        <div style={{ marginTop: 6, fontSize: 11, color: token.colorError, lineHeight: 1.4 }}>
          {capability.reason}
          {capability.suggestion && (
            <Button
              type="link"
              size="small"
              onClick={() => updateQuick({ operation: capability.suggestion })}
              style={{ padding: '0 0 0 6px', height: 'auto', fontSize: 11 }}
            >
              Switch to {capability.suggestion}
            </Button>
          )}
        </div>
      )}
    </QuickEditorShell>
  );
}
