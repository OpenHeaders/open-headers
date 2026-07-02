/**
 * ResponseQuickEditor — the response-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Response tab's "Edit
 * override" CTA (or the Matched Rules panel) on a rule that fired for
 * the inspected request. Saving changes the rule for FUTURE requests;
 * the tab's Modified/Original capture stays exactly as it was.
 *
 * Compact by design: status select + content-type + a plain textarea
 * for the static body — heavy editing (dynamic JavaScript bodies,
 * response headers, GraphQL filters) belongs to the workbench, reached
 * via the footer link. Dynamic-body rules fall back to that link only,
 * mirroring the header popover's can't-pinpoint fallback.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ResponseRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { CONTENT_TYPE_OPTIONS, STATUS_CODES } from '@openheaders/ui/workbench/components/rule-fields/status-codes';
import { App, AutoComplete, Input, Select, Tag, theme } from 'antd';
import { QuickEditorShell } from './QuickEditorShell';
import { useResponseDraft } from './use-response-draft';
import { useResponseSave } from './use-response-save';

export interface ResponseQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

const STATUS_OPTIONS = [{ value: 0, label: 'Keep original status code' }, ...STATUS_CODES];

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

  const { draft, draftRef, updateDraft, isDirty } = useResponseDraft({
    currentAction: responseRule && !isDynamic ? responseRule.action : null,
  });

  const { saving, canSave, handleSave, saveLabel } = useResponseSave({
    responseRule,
    draftRef,
    isDirty,
    editable,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: liveRule.uid }, 'devpanel').then(() => onClose());
  };

  const isNetwork = responseRule?.action.responseSource === 'network';

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
        responseRule && (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color={isNetwork ? 'blue' : 'purple'}>
            {isNetwork ? 'Modify' : 'Mock'}
          </Tag>
        )
      }
      onOpenInEditor={openInEditor}
      save={editable ? { saving, canSave, saveLabel, onSave: () => void handleSave() } : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      {editable ? (
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
          {/* Status + Content-Type on one row; the body gets the full
              width below so JSON payloads have room to breathe. */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabelStyle}>Status Code</div>
              <EntityField path={RULE_FIELD.responseStatusCode}>
                <Select
                  size="small"
                  showSearch
                  value={draft.statusCode}
                  onChange={(code) => updateDraft({ statusCode: code })}
                  options={STATUS_OPTIONS}
                  style={{ width: '100%' }}
                  // Popover container's stacking context is z=1080 — lift
                  // the dropdown above it, same as the header popover.
                  dropdownStyle={{ zIndex: 1090 }}
                  filterOption={(input, option) => {
                    const label = String(option?.label ?? '');
                    return label.toLowerCase().includes(input.toLowerCase());
                  }}
                />
              </EntityField>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabelStyle}>Content-Type</div>
              <EntityField path={RULE_FIELD.responseContentType}>
                <AutoComplete
                  size="small"
                  value={draft.contentType}
                  onChange={(v) => updateDraft({ contentType: v })}
                  options={CONTENT_TYPE_OPTIONS}
                  placeholder="application/json"
                  style={{ width: '100%' }}
                  dropdownStyle={{ zIndex: 1090 }}
                  filterOption={(input, option) => {
                    const value = String(option?.value ?? '');
                    return value.toLowerCase().includes(input.toLowerCase());
                  }}
                />
              </EntityField>
            </div>
          </div>
          <div>
            <div style={fieldLabelStyle}>Response Body</div>
            <EntityField path={RULE_FIELD.responseBody}>
              <Input.TextArea
                value={draft.responseBody}
                onChange={(e) => updateDraft({ responseBody: e.target.value })}
                placeholder={'{"message": "custom response", "data": []}'}
                autoSize={{ minRows: 6, maxRows: 12 }}
                style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}
              />
            </EntityField>
          </div>
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          {responseRule
            ? 'This rule builds its response with JavaScript. Open in workspace to edit the script.'
            : 'Open in workspace to inspect or change this rule.'}
        </div>
      )}
    </QuickEditorShell>
  );
}
