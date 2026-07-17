/**
 * MessageQuickEditor — the shared ws/sse plug-in body of the
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on a WebSocket or SSE message rule that
 * fired for the inspected connection. Surfaces the payload for
 * modify/inject operations; `drop` has no payload (the workbench strips
 * it on save), so its quick edit is conditions-only, like Block.
 * Operation, direction/event name, filter and inject trigger stay in
 * the workbench.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule, SseRule, WsRule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { App, Tag, theme } from 'antd';
import { useMemo } from 'react';
import {
  buildSseRuleUpdate,
  buildWsRuleUpdate,
  type MessageQuickEditDraft,
  seedMessageDraft,
} from '../../data/rule-create/quick-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

// JSON format example — raw by design across the rule editors.
const PAYLOAD_EXAMPLE = '{"key": "value"}';

const OPERATION_LABEL_KEY = {
  modify: 'workbench.editors.rule.fields.message.opReplace',
  inject: 'workbench.editors.rule.fields.message.opInject',
  drop: 'workbench.editors.rule.fields.message.opDrop',
} as const;

export interface MessageQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function MessageQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: MessageQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const messageRule: WsRule | SseRule | null =
    liveRule.type === 'ws' || liveRule.type === 'sse' ? liveRule : null;
  const editable = !!messageRule;
  const unit = messageRule?.type === 'sse' ? 'event' : 'frame';
  const operation = messageRule?.action.operation;

  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );

  // The payload maps to its formatted VIEW (once per rule version — the
  // memo, never per keystroke); the Save builders re-encode it against
  // the stored wire text, so an untouched view keeps the stored bytes.
  const canonical = useMemo<MessageQuickEditDraft | null>(
    () => (messageRule ? seedMessageDraft(messageRule) : null),
    [messageRule],
  );
  const showFormatHint = useMemo(
    () =>
      canonical !== null &&
      canonical.payload !== null &&
      messageRule !== null &&
      canonical.payload !== (messageRule.action.payload ?? ''),
    [canonical, messageRule],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: messageRule?.conditions ?? null });
  const isDirty = fieldDirty || condDraft.isDirty;

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: messageRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () => {
      if (!messageRule) return {};
      const conditions = condDraft.isDirty ? condDraft.conditionsRef.current : undefined;
      return messageRule.type === 'ws'
        ? buildWsRuleUpdate(messageRule, draftRef.current, conditions)
        : buildSseRuleUpdate(messageRule, draftRef.current, conditions);
    },
    isDirty,
    editable,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: liveRule.uid }, 'devpanel').then(() => onClose());
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 2,
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={liveRule}
      ruleType={liveRule.type}
      ruleName={liveRule.name}
      liveRuleUid={liveRule.uid}
      isDirty={isDirty}
      tags={
        operation ? (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>{t(OPERATION_LABEL_KEY[operation])}</Tag>
        ) : undefined
      }
      conditions={
        editable ? (
          <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
            <QuickConditionsRow value={condDraft.conditions} onChange={condDraft.setConditions} />
          </EntityScopeProvider>
        ) : undefined
      }
      onOpenInEditor={openInEditor}
      save={editable ? { saving, canSave, saveLabel, onSave: () => void handleSave() } : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      {editable && draft.payload !== null ? (
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
          <div style={fieldLabelStyle}>
            {operation === 'inject'
              ? t(
                  unit === 'event'
                    ? 'workbench.editors.rule.fields.message.injectedEvent'
                    : 'workbench.editors.rule.fields.message.injectedFrame',
                )
              : t(
                  unit === 'event'
                    ? 'workbench.editors.rule.fields.message.replacementEvent'
                    : 'workbench.editors.rule.fields.message.replacementFrame',
                )}
          </div>
          <EntityField path={RULE_FIELD.messagePayload}>
            <TemplateInput
              multiline
              maxRows={12}
              resizable
              allowClear
              value={draft.payload ?? ''}
              onChange={(v) => updateDraft({ payload: v })}
              placeholder={PAYLOAD_EXAMPLE}
              suggestionContext={{ collectionId }}
              style={{
                width: '100%',
                minHeight: 120,
                fontFamily: token.fontFamilyCode,
                fontSize: 12,
              }}
            />
          </EntityField>
          <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
            {operation === 'inject'
              ? t(
                  liveRule.type === 'sse'
                    ? 'panel.quickEditor.message.injectedStreamsHint'
                    : 'panel.quickEditor.message.injectedConnectionsHint',
                )
              : t(
                  unit === 'event'
                    ? 'panel.quickEditor.message.replacedEventsHint'
                    : 'panel.quickEditor.message.replacedFramesHint',
                )}
            {showFormatHint && <> {t('panel.quickEditor.formatAwareBody.hint')}</>}
          </div>
        </EntityScopeProvider>
      ) : editable ? (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {`${t(
            unit === 'event'
              ? 'panel.quickEditor.message.droppedEventsHint'
              : 'panel.quickEditor.message.droppedFramesHint',
          )} ${t('panel.quickEditor.retargetHint')}`}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {t('panel.quickEditor.openToInspect')}
        </div>
      )}
    </QuickEditorShell>
  );
}
