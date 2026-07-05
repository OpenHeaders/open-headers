/**
 * MessageQuickCreate — the ws/sse create-mode body of the shared
 * `QuickEditorShell`. Opened from the Messages grid's per-frame
 * "Override" action (seeded from the hovered frame,
 * `buildWsDraftFromFrame`), the EventStream grid's per-event action
 * (`buildSseDraftFromEvent`), or either toolbar's connection-scoped
 * override. Save mints the rule AND publishes it in one gesture; the
 * footer link hands the CURRENT draft state off to the workbench for
 * full options. The controls carry the workbench message editor's
 * vocabulary (`MessageRuleFields`): Replace / Inject / Drop, the
 * Every-frame / Contains / Regex filter, and the inject trigger — plus
 * the per-kind selector: ws direction, sse event name.
 */

import type { SseRuleDraft, WsDirection, WsRuleDraft } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Input, Radio, Select, theme } from 'antd';
import { useRef, useState } from 'react';
import {
  buildMessageRuleSeed,
  type MessageQuickDraft,
  type MessageQuickDraftBase,
  messageQuickDraftValid,
  mergeQuickIntoMessageDraft,
  seedMessageQuickDraft,
} from '../../data/rule-create/message-rule-create';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateConditions } from './use-quick-create-conditions';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

export interface MessageQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured frame/event draft built by the row action (`rule-draft-bridge`). */
  draft: WsRuleDraft | SseRuleDraft;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function MessageQuickCreate({
  anchorEl,
  draft,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: MessageQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() => generateSmartRuleName({ kind: draft.type, url: draft.url ?? '' }, rules));
  const [seed] = useState<MessageQuickDraft>(() => seedMessageQuickDraft(draft));
  const [quick, setQuick] = useState<MessageQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const quickDirty = stableStringify(quick) !== stableStringify(seed);

  const cond = useQuickCreateConditions(draft, strategy);
  const isDirty = quickDirty || cond.isDirty;

  const dest = useQuickCreateDestination(draft.url);
  const collectionId = dest.collectionId;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildMessageRuleSeed(quickRef.current, name, cond.conditionsRef.current),
    destination: dest.forSave,
    workspaceId,
    valid: messageQuickDraftValid(quick),
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoMessageDraft(draft, quickRef.current))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  const patch = (p: Partial<MessageQuickDraftBase>) => setQuick((q) => ({ ...q, ...p }));
  const patchDirection = (direction: WsDirection) => setQuick((q) => (q.kind === 'ws' ? { ...q, direction } : q));
  const patchEventName = (eventName: string) => setQuick((q) => (q.kind === 'sse' ? { ...q, eventName } : q));

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 2,
  };

  const unit = quick.kind === 'sse' ? 'event' : 'frame';
  const showFilterValue = quick.filterType !== 'none';

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType={draft.type}
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={isDirty}
      destination={<QuickDestinationRow api={dest} />}
      conditions={<QuickConditionsRow value={cond.conditions} onChange={cond.setConditions} />}
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Radio.Group
          size="small"
          value={quick.operation}
          onChange={(e) => patch({ operation: e.target.value })}
          options={[
            { value: 'modify', label: 'Replace' },
            { value: 'inject', label: 'Inject' },
            { value: 'drop', label: 'Drop' },
          ]}
          optionType="button"
        />
        {quick.kind === 'ws' && (
          <Select
            size="small"
            style={{ width: 130 }}
            value={quick.direction}
            onChange={patchDirection}
            options={[
              { value: 'receive', label: 'Incoming ⬇' },
              { value: 'send', label: 'Outgoing ⬆' },
            ]}
          />
        )}
      </div>
      {quick.kind === 'sse' && (
        <div style={{ marginBottom: 10 }}>
          <div style={fieldLabelStyle}>Event name</div>
          <Input
            size="small"
            value={quick.eventName}
            onChange={(e) => patchEventName(e.target.value)}
            placeholder="Empty = default message events"
          />
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <div style={fieldLabelStyle}>{quick.kind === 'sse' ? 'Data filter' : 'Frame filter'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            size="small"
            style={{ width: 130 }}
            value={quick.filterType}
            onChange={(v) => patch({ filterType: v })}
            options={[
              { value: 'none', label: `Every ${unit}` },
              { value: 'contains', label: 'Contains' },
              { value: 'regex', label: 'Regex' },
            ]}
          />
          {showFilterValue && (
            <Input
              size="small"
              style={{ flex: 1 }}
              value={quick.filterValue}
              onChange={(e) => patch({ filterValue: e.target.value })}
              placeholder={quick.filterType === 'regex' ? 'e.g. "type":\\s*"heartbeat"' : 'e.g. heartbeat'}
            />
          )}
        </div>
      </div>
      {quick.operation === 'inject' && (
        <div style={{ marginBottom: 10 }}>
          <div style={fieldLabelStyle}>Inject when</div>
          <Radio.Group
            size="small"
            value={quick.injectTrigger}
            onChange={(e) => patch({ injectTrigger: e.target.value })}
            options={[
              { value: 'open', label: quick.kind === 'sse' ? 'Stream opens' : 'Connection opens' },
              { value: 'message', label: `A matching ${unit} arrives` },
            ]}
          />
        </div>
      )}
      {quick.operation !== 'drop' ? (
        <>
          <div style={fieldLabelStyle}>{quick.operation === 'inject' ? `Injected ${unit}` : `Replacement ${unit}`}</div>
          <TemplateInput
            multiline
            maxRows={12}
            resizable
            allowClear
            value={quick.payload}
            onChange={(v) => patch({ payload: v })}
            placeholder={'{"key": "value"}'}
            suggestionContext={{ collectionId }}
            style={{
              width: '100%',
              minHeight: 120,
              fontFamily: token.fontFamilyCode,
              fontSize: 12,
            }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
            {quick.operation === 'inject'
              ? `Injected on matching ${quick.kind === 'sse' ? 'streams' : 'connections'} before listeners see it.`
              : `Matching ${unit}s are replaced with this payload before they are seen.`}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          Matching {unit}s are dropped before they are seen.
        </div>
      )}
    </QuickEditorShell>
  );
}
