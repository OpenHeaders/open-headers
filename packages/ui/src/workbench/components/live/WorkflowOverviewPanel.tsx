/**
 * WorkflowOverviewPanel — the workflow view's docked panel while no step
 * is selected (the workflows redesign, Workflow panel): the workflow as
 * a whole. Its head — the name, how many steps, the description — and
 * under it one scrolling page of cards: its last run, what needs a look,
 * its steps in run order, its captures, and when it runs.
 *
 * Drawn at the step panel's sizes, as the whole workflow view is.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { type DraftWorkflow, isKnownStep, runVerdict } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { ConfigProvider, Input, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { captureUsesOf } from './capture-uses';
import { appendDraftStep } from './graph-edit';
import { Section } from './layout';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import type { OverviewStepFacts } from './StepOverviewRow';
import { KindTag } from './StepTags';
import {
  actionOfStep,
  doesOfStep,
  markOfStep,
  protocolOfStep,
  runRowDisplayOfStep,
  STEP_KIND_WORD,
  type StepMarkSources,
} from './step-facts';
import { usePanelSizes } from './use-panel-sizes';
import { useStepRequests } from './use-step-requests';
import { useWaitClock } from './use-wait-clock';
import type { WorkflowFormModel } from './use-workflow-form-model';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowAttentionCard, { type AttentionPhase } from './WorkflowAttentionCard';
import WorkflowCapturesCard, { type OverviewCapture } from './WorkflowCapturesCard';
import WorkflowLastRunCard from './WorkflowLastRunCard';
import WorkflowStepsCard from './WorkflowStepsCard';

const { Text } = Typography;

interface Props {
  /** The workflow's name, as its tab's header says it. */
  name: string;
  draft: DraftWorkflow;
  setDraft: (next: DraftWorkflow) => void;
  model: WorkflowFormModel;
  /** The workflow is read-only here: every control is off but the Enabled switch. */
  readOnly: boolean;
  onSelectStep: (stepUid: string) => void;
  /** The saved workflow on a surface that runs workflows — absent where there is no run to show. */
  workflow?: LiveWorkflow;
  run?: ShownWorkflowRun | null;
  /** The active environment's cache row: how the last run left each step while no run is kept. */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  /** The header's schedule word was pressed: bring the setting of when the workflow runs to the panel's top. */
  revealSettings?: boolean;
  onSettingsRevealed?: () => void;
}

const WorkflowOverviewPanel: React.FC<Props> = ({
  name,
  draft,
  setDraft,
  model,
  readOnly,
  onSelectStep,
  workflow,
  run,
  cacheRun,
  revealSettings = false,
  onSettingsRevealed,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { fontSize, theme: sizes } = usePanelSizes();
  const stepRequests = useStepRequests();
  const now = useWaitClock(run?.record ?? null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!revealSettings) return;
    const scroller = scrollerRef.current;
    const settings = settingsRef.current;
    if (scroller && settings) {
      scroller.scrollTop += settings.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    }
    onSettingsRevealed?.();
  }, [revealSettings, onSettingsRevealed]);

  const markSources: StepMarkSources = { run, cacheRun, now };
  const steps: OverviewStepFacts[] = draft.steps.map((step) => {
    const mark = markOfStep(step, markSources, t);
    const display = runRowDisplayOfStep(step, markSources, t);
    const action = actionOfStep(step);
    const sub =
      display !== undefined
        ? display.sub
        : mark.detail !== undefined
          ? { text: mark.detail, tone: 'danger' as const }
          : undefined;
    return {
      id: step.id,
      uid: step.uid,
      mark,
      protocol: protocolOfStep(step, draft.steps, stepRequests),
      kind: action !== undefined ? t(STEP_KIND_WORD[action]) : isKnownStep(step) ? '' : step.action,
      result: mark.text,
      does: doesOfStep(step, draft.steps, stepRequests, t),
      ...(sub !== undefined ? { sub } : {}),
    };
  });

  // Who reads what: every step's uses of the others' captures, read once for the panel.
  const usesByStep = draft.steps.map((step) => captureUsesOf(step, stepRequests));
  const captures: OverviewCapture[] = draft.steps.flatMap((step, index) =>
    isKnownStep(step)
      ? step.captures.map((capture) => ({
          stepId: step.id,
          name: capture.name,
          readers: draft.steps
            .filter(
              (_, at) =>
                at !== index &&
                usesByStep[at].some((use) => use.stepId === step.id && use.captureName === capture.name),
            )
            .map((reader) => reader.id),
        }))
      : [],
  );

  const ran = run != null || cacheRun != null;
  const attentionPhase: AttentionPhase = !ran
    ? 'never-run'
    : run != null && runVerdict(run.record) === 'running'
      ? 'running'
      : 'done';
  const stepCount = t('workbench.editors.live.overview.stepCount', { count: draft.steps.length });

  const handleAddStep = () => {
    const appended = appendDraftStep(draft);
    setDraft(appended.draft);
    const added = appended.draft.steps.at(-1);
    if (added !== undefined) onSelectStep(added.uid);
  };

  return (
    <ConfigProvider componentSize="small" theme={sizes}>
      <div className="oh-wf-step-panel" style={{ fontSize }}>
        <div className="oh-wf-step-head">
          <div className="oh-wf-step-head-row">
            <b className="oh-wf-step-name oh-wf-overview-name">{name}</b>
            <KindTag size="panel">{stepCount}</KindTag>
          </div>
          <div className="oh-wf-overview-hint">{t('workbench.editors.live.panel.noStep')}</div>
          <span data-field-path={LIVE_WORKFLOW_FIELD.description} style={{ display: 'contents' }}>
            <Input
              className="oh-wf-step-description"
              variant="borderless"
              placeholder={t('workbench.editors.live.form.descriptionPlaceholder')}
              value={draft.description}
              disabled={readOnly}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </span>
        </div>
        <div ref={scrollerRef} className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
          <ConfigProvider componentDisabled={readOnly}>
            <div className="oh-wf-panel-body">
              {workflow !== undefined && <WorkflowLastRunCard run={run ?? null} />}
              {(workflow !== undefined || model.workflowLevelErrors.length > 0) && (
                <WorkflowAttentionCard
                  steps={steps}
                  issues={model.workflowLevelErrors}
                  phase={attentionPhase}
                  onOpen={onSelectStep}
                />
              )}
              <WorkflowStepsCard
                steps={steps}
                readOnly={readOnly}
                onOpen={onSelectStep}
                onMove={model.moveStep}
                onAdd={handleAddStep}
              />
              <WorkflowCapturesCard captures={captures} />

              <div ref={settingsRef} data-field-path={LIVE_WORKFLOW_FIELD.refresh} data-testid="wf-panel-policy">
                <Section
                  title={
                    <>
                      {t('workbench.editors.live.form.runsSection')}
                      {model.holdsSession && (
                        <InfoTrigger
                          content={{
                            title: t('workbench.editors.live.form.runsSection'),
                            summary: t('workbench.editors.live.form.sessionPolicyInfo'),
                          }}
                        />
                      )}
                    </>
                  }
                >
                  {/* Fixed at Manual while the workflow holds a session step; a
                      policy that is not Manual yet stays open so it can be set. */}
                  <RefreshPolicyEditor
                    value={draft.refresh}
                    onChange={(refresh) => setDraft({ ...draft, refresh })}
                    availableCaptures={model.availableCaptures}
                    disabled={model.holdsSession && draft.refresh.kind === 'manual'}
                  />
                  {model.holdsSession && (
                    <Text type="secondary" style={{ fontSize: 11 }} data-testid="wf-form-session-verdict">
                      {t('workbench.editors.live.form.sessionNoLiveVariables')}
                    </Text>
                  )}
                </Section>
              </div>

              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div
                  data-field-path={LIVE_WORKFLOW_FIELD.enabled}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {/* A read-only workflow can still be switched off. */}
                  <ConfigProvider componentDisabled={false}>
                    <Switch
                      size="small"
                      aria-label={t('workbench.editors.live.form.enabledAria')}
                      checked={draft.enabled}
                      onChange={(enabled) => setDraft({ ...draft, enabled })}
                    />
                  </ConfigProvider>
                  <Text>
                    {draft.enabled
                      ? t('workbench.editors.live.form.enabled')
                      : t('workbench.editors.live.form.disabled')}
                  </Text>
                </div>
                <Tooltip title={t('workbench.editors.live.form.parallelTooltip')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Switch
                      aria-label={t('workbench.editors.live.form.parallelLabel')}
                      size="small"
                      checked={false}
                      disabled
                    />
                    <Text type="secondary">{t('workbench.editors.live.form.parallelLabel')}</Text>
                    <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                  </div>
                </Tooltip>
              </div>
            </div>
          </ConfigProvider>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default WorkflowOverviewPanel;
