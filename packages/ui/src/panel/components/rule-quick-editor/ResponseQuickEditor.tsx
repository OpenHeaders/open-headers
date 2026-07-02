/**
 * ResponseQuickEditor — the response-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Response tab's "Edit
 * override" CTA (or the Matched Rules panel) on a rule that fired for
 * the inspected request. Saving changes the rule for FUTURE requests;
 * the tab's Modified/Original capture stays exactly as it was.
 *
 * Compact by design: status select + content-type + a plain textarea
 * for the static body (shared with create mode via
 * `ResponseQuickFields`) — heavy editing (dynamic JavaScript bodies,
 * response headers, GraphQL filters) belongs to the workbench, reached
 * via the footer link. Dynamic-body rules fall back to that link only,
 * mirroring the header popover's can't-pinpoint fallback.
 */

import type { ResponseRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { App, Tag, theme } from 'antd';
import { QuickEditorShell } from './QuickEditorShell';
import { ResponseQuickFields } from './ResponseQuickFields';
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
        <ResponseQuickFields draft={draft} updateDraft={updateDraft} entityUid={liveRule.uid} />
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
