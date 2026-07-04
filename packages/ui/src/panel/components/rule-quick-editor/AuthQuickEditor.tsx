/**
 * AuthQuickEditor — the auth-rule plug-in body of the shared
 * `QuickEditorShell`. Edit mode: opened from the Matched Rules panel
 * (or any fired-rule hover) on an auth rule that fired for the
 * inspected request. Both credential fields are template-resolvable —
 * the intended shape keeps the real secret in the vault
 * (`{{vault.*}}`), and the panel resolver's deferred-vault mode reports
 * those references as resolvable without computing the secret here.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { AuthRule, Rule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { App, Typography, theme } from 'antd';
import { useMemo } from 'react';
import { buildAuthRuleUpdate, type AuthQuickEditDraft } from '../../data/rule-create/quick-rule-edit';
import { findRuleCollectionId } from '../../data/rule-create/rule-collection';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useActionDraft } from './use-action-draft';
import { useConditionsDraft } from './use-conditions-draft';
import { useQuickEditSave } from './use-quick-edit-save';

const { Text } = Typography;

export interface AuthQuickEditorProps {
  anchorEl: HTMLElement;
  /** Live rule at open time — refreshed from the sync mirror below. */
  rule: Rule;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function AuthQuickEditor({
  anchorEl,
  rule,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: AuthQuickEditorProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });

  const liveRuleFromMirror = useLiveRule(rule.uid, workspaceId);
  const liveRule = liveRuleFromMirror ?? rule;
  const authRule: AuthRule | null = liveRule.type === 'auth' ? liveRule : null;
  const editable = !!authRule;

  const { localCollections } = useRules();
  const collectionId = useMemo(
    () => findRuleCollectionId(liveRule, localCollections),
    [liveRule, localCollections],
  );

  const canonical = useMemo<AuthQuickEditDraft | null>(
    () => (authRule ? { username: authRule.action.username, password: authRule.action.password } : null),
    [authRule],
  );
  const { draft, draftRef, updateDraft, isDirty: fieldDirty } = useActionDraft({ canonical });

  const condDraft = useConditionsDraft({ canonical: authRule?.conditions ?? null });
  const isDirty = fieldDirty || condDraft.isDirty;

  // Credentials that don't resolve gate Save — a published auth rule
  // with an unresolvable template would silently never answer the
  // challenge. `{{vault.*}}` references resolve via the resolver's
  // deferred-vault mode, so vault-backed secrets pass the gate without
  // being computed here. Same gate shape as `RedirectQuickEditor`.
  const resolver = useVariableResolver();
  const credentialsResolve = useMemo(() => {
    const context = collectionId ? { collectionId } : undefined;
    return (
      resolver.resolveTemplate(draft.username ?? '', context).errors.length === 0 &&
      resolver.resolveTemplate(draft.password ?? '', context).errors.length === 0
    );
  }, [resolver, draft.username, draft.password, collectionId]);

  const { saving, canSave, handleSave, saveLabel } = useQuickEditSave({
    ruleUid: authRule?.uid ?? null,
    // `ruleUid` gates the save flow, so the null branch is unreachable.
    buildUpdates: () =>
      authRule
        ? buildAuthRuleUpdate(authRule, draftRef.current, condDraft.isDirty ? condDraft.conditionsRef.current : undefined)
        : {},
    isDirty,
    editable,
    valid: credentialsResolve,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void openWorkspace({ kind: 'edit-rule', uid: liveRule.uid }, 'devpanel').then(() => onClose());
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 12,
    display: 'block',
    marginBottom: 4,
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={liveRule}
      ruleType={liveRule.type}
      ruleName={liveRule.name}
      liveRuleUid={liveRule.uid}
      isDirty={isDirty}
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
      {editable ? (
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={liveRule.uid}>
          <Text type="secondary" style={fieldLabelStyle}>
            Username
          </Text>
          <div style={{ width: '100%', minWidth: 0, marginBottom: 10 }}>
            <EntityField path={RULE_FIELD.authUsername}>
              <TemplateInput
                size="small"
                wrap
                maxRows={4}
                resizable
                allowClear
                value={draft.username ?? ''}
                onChange={(v) => updateDraft({ username: v })}
                placeholder="e.g. dev-user or {{env.PROXY_USER}}"
                suggestionContext={{ collectionId }}
                flagUnresolved
                style={{ width: '100%' }}
              />
            </EntityField>
          </div>
          <Text type="secondary" style={fieldLabelStyle}>
            Password
          </Text>
          <div style={{ width: '100%', minWidth: 0 }}>
            <EntityField path={RULE_FIELD.authPassword}>
              <TemplateInput
                size="small"
                wrap
                maxRows={4}
                resizable
                allowClear
                value={draft.password ?? ''}
                onChange={(v) => updateDraft({ password: v })}
                placeholder="e.g. {{vault.STAGING_PW}}"
                suggestionContext={{ collectionId }}
                flagUnresolved
                style={{ width: '100%' }}
              />
            </EntityField>
          </div>
          {credentialsResolve ? (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
              Answers server (401) and proxy (407) authentication challenges on matching requests.
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 11, color: token.colorWarning, lineHeight: 1.4 }}>
              Variable missing — hover the red reference to create it and enable Save.
            </div>
          )}
        </EntityScopeProvider>
      ) : (
        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
          Open in workspace to inspect or change this rule.
        </div>
      )}
    </QuickEditorShell>
  );
}
