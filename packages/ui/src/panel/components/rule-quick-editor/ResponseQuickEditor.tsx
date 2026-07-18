/**
 * ResponseQuickEditor — the response-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Response tab's "Edit
 * override" CTA (or the Matched Rules panel) on a rule that fired for
 * the inspected request. Saving changes the rule for FUTURE requests;
 * the tab's Modified/Original capture stays exactly as it was.
 *
 * Compact by design: status select + content-type + the shared
 * format-aware body editor (tab-document parity, via
 * `ResponseQuickFields`) — heavy editing (dynamic JavaScript bodies,
 * response headers, GraphQL filters) belongs to the workbench, reached
 * via the footer link. Dynamic-body rules fall back to that link only,
 * mirroring the header popover's can't-pinpoint fallback.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ResponseRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { App, Tag, theme } from 'antd';
import { useMemo } from 'react';
import { buildResponseRuleWireUpdate, type ResponseQuickDraft } from '../../data/rule-create/response-rule-edit';
import { useOpenRuleEditorDocument } from '../../data/rule-editor-document-intent';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { ResponseQuickFields } from './ResponseQuickFields';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

export interface ResponseQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function ResponseQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: ResponseQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  // Reactive live rule — subscribes to the rule sync mirror so commits
  // from any surface (workbench, popup, another devpanel) update the
  // popover; the static prop only seeds the first render.
  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const responseRule: ResponseRule | null = liveRule.type === 'response' ? liveRule : null;

  const isDynamic = responseRule?.action.bodyType === 'dynamic';
  const editable = !!responseRule && !isDynamic;

  // The draft record lives in WIRE space (the body editor formats its
  // own view and encodes per edit — tab-document parity), so derived
  // dirty and the Save payload read the stored text unchanged.
  const canonical = useMemo<ResponseQuickDraft | null>(
    () =>
      responseRule && !isDynamic
        ? {
            statusCode: responseRule.action.statusCode,
            contentType: responseRule.action.contentType,
            responseBody: responseRule.action.responseBody,
          }
        : null,
    [responseRule, isDynamic],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldsDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: editable ? (responseRule?.conditions ?? null) : null });
  const isDirty = fieldsDirty || condDraft.isDirty;

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: editable && responseRule ? responseRule.uid : null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      responseRule
        ? buildResponseRuleWireUpdate(
            responseRule,
            draftRef.current,
            condDraft.isDirty ? condDraft.conditionsRef.current : undefined,
          )
        : {},
    isDirty,
    editable,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: liveRule.uid }, 'devpanel').then(() => onClose());
  };

  // In-panel escalation: the rule opens as an edit-mode editor-tab
  // document; unsaved form state rides along verbatim (both surfaces'
  // form values are wire text). Editable rules only — dynamic-body
  // rules keep their workspace-only escalation.
  const openRuleEditorDocument = useOpenRuleEditorDocument();
  const openInTab =
    openRuleEditorDocument === null || !editable || responseRule === null
      ? undefined
      : () => {
          openRuleEditorDocument({
            mode: 'edit',
            ruleUid: responseRule.uid,
            ruleName: responseRule.name,
            ...(isDirty
              ? {
                  handOff: {
                    statusCode: draftRef.current.statusCode,
                    contentType: draftRef.current.contentType,
                    responseBody: draftRef.current.responseBody,
                    ...(condDraft.isDirty ? { conditions: condDraft.conditionsRef.current } : {}),
                  },
                }
              : {}),
          });
          onClose();
        };

  const isNetwork = responseRule?.action.responseSource === 'network';

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={liveRule}
      ruleType={liveRule.type}
      ruleName={liveRule.name}
      liveRuleUid={liveRule.uid}
      isDirty={isDirty}
      tags={
        responseRule && (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color={isNetwork ? 'blue' : 'purple'}>
            {isNetwork ? t('panel.quickEditor.response.tagModify') : t('panel.quickEditor.response.tagMock')}
          </Tag>
        )
      }
      conditions={
        editable ? (
          <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
            <QuickConditionsRow value={condDraft.conditions} onChange={condDraft.setConditions} />
          </EntityScopeProvider>
        ) : undefined
      }
      onOpenInEditor={openInEditor}
      onOpenInTab={openInTab}
      save={editable ? { saving, canSave, saveLabel, onSave: () => void handleSave() } : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      {editable ? (
        <ResponseQuickFields draft={draft} updateDraft={updateDraft} entityUid={liveRule.uid} />
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {responseRule ? t('panel.quickEditor.response.dynamicBody') : t('panel.quickEditor.openToInspect')}
        </div>
      )}
    </QuickEditorShell>
  );
}
