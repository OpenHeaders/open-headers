/**
 * Create mode for `LiveVariableEditor` — name a new `{{live.X}}` binding
 * against an existing workflow + step + capture. Reached from the Live
 * Variables list page's "+ New live variable" button; on save the host
 * replaces the create tab with an edit tab (`onCreated`).
 */

import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveVariable } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell } from '@openheaders/ui/shared/editor-shell';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { App, Button, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import EditorHeader from '../shell/EditorHeader';
import { FieldRow, InlineNameDescription, Section } from './layout';
import { type CreateDraft, emptyCreateDraft } from './live-variable-drafts';
import LiveVariableToggles from './LiveVariableToggles';

const { Text, Title } = Typography;

export interface CreateProps {
  mode: 'create';
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Called when a new LV lands — host replaces the create tab with an edit tab. */
  onCreated: (lv: LiveVariable) => void;
  /** Opens a fresh workflow-create tab — surfaced as an empty-state CTA
   *  when no workflows exist yet to bind to. */
  onCreateWorkflow?: () => void;
}

const LiveVariableCreateMode: React.FC<CreateProps> = ({
  onDirtyChange,
  registerSaveRef,
  onCreated,
  onCreateWorkflow,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { workflows } = useLiveWorkflows();
  const { createVariable } = useLiveVariables();

  const [draft, setDraft] = useState<CreateDraft>(() => emptyCreateDraft());

  const isDirty = useMemo(() => {
    return (
      draft.name.trim().length > 0 ||
      draft.description.trim().length > 0 ||
      draft.workflowUid !== '' ||
      draft.captureName !== ''
    );
  }, [draft]);

  const handleSave = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) {
      message.error(t('workbench.editors.live.create.nameRequired'));
      return;
    }
    if (!draft.workflowUid || !draft.stepId || !draft.captureName) {
      message.error(t('workbench.editors.live.create.bindingRequired'));
      return;
    }
    const lv = await createVariable({
      name,
      workflowUid: draft.workflowUid,
      stepId: draft.stepId,
      captureName: draft.captureName,
      description: draft.description.trim() ? draft.description : undefined,
      requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
      enabled: draft.enabled,
    });
    if (!lv) {
      message.error(t('workbench.editors.live.create.createFailed'));
      return;
    }
    onCreated(lv);
  }, [draft, createVariable, message, onCreated, t]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);

  const shell = useEditorShell({
    entityType: LIVE_VARIABLE_ENTITY_TYPE,
    entityId: null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const selectedWorkflow = workflows.find((w) => w.uid === draft.workflowUid) ?? null;
  const selectedSteps = selectedWorkflow?.steps ?? [];
  const selectedStep = selectedSteps.find((s) => s.id === draft.stepId) ?? null;
  const selectedCaptures = selectedStep?.captures ?? [];

  const createHeaderTitle = (
    <>
      <ThunderboltOutlined style={{ fontSize: 14, color: token.colorPrimary }} />
      <Title level={5} style={{ margin: 0 }}>
        {t('workbench.editors.live.create.title')}
      </Title>
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={createHeaderTitle} shell={shell.headerProps} />
      <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: '16px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InlineNameDescription
              name={draft.name}
              description={draft.description}
              onChangeName={(name) => setDraft({ ...draft, name })}
              onChangeDescription={(description) => setDraft({ ...draft, description })}
              namePlaceholder={t('workbench.editors.live.create.namePlaceholder')}
            />
            <Text type="secondary" style={{ fontSize: 10, marginTop: -4 }}>
              {t('workbench.editors.live.create.referenceAs', { name: draft.name.trim() || 'NAME' })}
            </Text>

            <Section title={t('workbench.editors.live.variable.bindingSection')}>
              <FieldRow label={t('workbench.editors.live.variable.workflowLabel')}>
                {workflows.length === 0 && onCreateWorkflow ? (
                  // No workflow to bind to yet — make the empty state
                  // actionable instead of pointing at the sidebar. A live
                  // var captures from a workflow step, so creating one is
                  // the natural next move.
                  <Button
                    size="small"
                    type="dashed"
                    icon={<PlusOutlined />}
                    style={{ width: '100%' }}
                    onClick={onCreateWorkflow}
                  >
                    {t('workbench.editors.live.create.createWorkflow')}
                  </Button>
                ) : (
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="label"
                    placeholder={t('workbench.editors.live.variable.selectWorkflow')}
                    value={draft.workflowUid || undefined}
                    onChange={(workflowUid) => setDraft({ ...draft, workflowUid, stepId: '', captureName: '' })}
                    options={workflows.map((w) => ({ value: w.uid, label: w.name }))}
                    notFoundContent={<Text type="secondary">{t('workbench.editors.live.create.noWorkflows')}</Text>}
                  />
                )}
              </FieldRow>
              <FieldRow label={t('workbench.editors.live.variable.stepLabel')}>
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  placeholder={t('workbench.editors.live.variable.selectStep')}
                  disabled={!selectedWorkflow}
                  value={draft.stepId || undefined}
                  onChange={(stepId) => setDraft({ ...draft, stepId, captureName: '' })}
                  options={selectedSteps.map((s) => ({
                    value: s.id,
                    label: t('workbench.editors.live.variable.stepOption', { id: s.id, count: s.captures.length }),
                  }))}
                />
              </FieldRow>
              <FieldRow label={t('workbench.editors.live.variable.captureLabel')}>
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  placeholder={t('workbench.editors.live.variable.selectCapture')}
                  disabled={!selectedStep}
                  value={draft.captureName || undefined}
                  onChange={(captureName) => setDraft({ ...draft, captureName })}
                  options={selectedCaptures.map((c) => ({ value: c.name, label: c.name }))}
                />
              </FieldRow>
            </Section>

            <LiveVariableToggles
              enabled={draft.enabled}
              requireFreshOnRuleBuild={draft.requireFreshOnRuleBuild}
              onChangeEnabled={(enabled) => setDraft({ ...draft, enabled })}
              onChangeRequireFresh={(requireFreshOnRuleBuild) => setDraft({ ...draft, requireFreshOnRuleBuild })}
              marginTop={6}
            />
          </div>
        </div>
      </div>
    </div>
    </EntityScopeProvider>
  );
};

export default LiveVariableCreateMode;
