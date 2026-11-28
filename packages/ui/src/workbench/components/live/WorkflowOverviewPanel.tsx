/**
 * WorkflowOverviewPanel — the workflow view's docked panel while no step
 * is selected (the workflows redesign, Workflow panel): the workflow as
 * a whole. Its head — the name, how many steps — and under it one
 * scrolling page of cards: its last run, what needs a look, its steps in
 * run order, its captures, how each environment stands, its settings,
 * and last its description.
 *
 * A saved workflow where it runs has a second page behind a tab of the
 * head: History, the runs this page saw. A run pressed there is the one
 * the whole view draws.
 *
 * Drawn at the step panel's sizes, as the whole workflow view is.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { type DraftWorkflow, isKnownStep, runVerdict } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { ConfigProvider } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { captureUsesOf } from './capture-uses';
import DescriptionCard from './DescriptionCard';
import { addPickedStep } from './graph-edit';
import type { OverviewStepFacts } from './StepOverviewRow';
import { KindTag } from './StepTags';
import type { StepPick } from './step-picker';
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
import type { KeptWorkflowRun } from '../../data/workflow-run-store';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowAttentionCard, { type AttentionPhase } from './WorkflowAttentionCard';
import WorkflowCapturesCard, { type OverviewCapture } from './WorkflowCapturesCard';
import WorkflowEnvironmentsCard from './WorkflowEnvironmentsCard';
import WorkflowHistoryCard from './WorkflowHistoryCard';
import WorkflowLastRunCard from './WorkflowLastRunCard';
import WorkflowSettingsCard from './WorkflowSettingsCard';
import WorkflowStepsCard from './WorkflowStepsCard';

/** The pages of the workflow's panel. */
export type WorkflowPanelTab = 'overview' | 'history';

interface Props {
  /** The workflow's name, as its tab's header says it. */
  name: string;
  draft: DraftWorkflow;
  setDraft: (next: DraftWorkflow) => void;
  model: WorkflowFormModel;
  /** The workflow is read-only here: every control is off but the Enabled switch. */
  readOnly: boolean;
  onSelectStep: (stepUid: string) => void;
  /** The Steps card's picker added a step: it takes the panel. */
  onStepAdded: (stepUid: string) => void;
  /** The page the panel is on. A workflow with no History is on its Overview, whatever this says. */
  tab: WorkflowPanelTab;
  onTabChange: (tab: WorkflowPanelTab) => void;
  /** The saved workflow on a surface that runs workflows — absent where there is no run to show. */
  workflow?: LiveWorkflow;
  /** The run the view draws. */
  run?: ShownWorkflowRun | null;
  /** The workflow's runs this page saw, the newest first — what its History lists. */
  keptRuns: readonly KeptWorkflowRun[];
  /** A run of the History was pressed: the view draws it. */
  onPickRun: (runId: string) => void;
  /** The active environment's cache row: how the last run left each step while no run is kept. */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  /** Every environment's cache row of the workflow — absent for a draft never saved, which has run nowhere. */
  runs?: LiveWorkflowRunSnapshot[];
  /** How many live variables read the workflow. */
  boundCount?: number;
  /** The header's schedule word was pressed: bring the workflow's settings into view. */
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
  onStepAdded,
  tab,
  onTabChange,
  workflow,
  run,
  keptRuns,
  onPickRun,
  cacheRun,
  runs,
  boundCount = 0,
  revealSettings = false,
  onSettingsRevealed,
}) => {
  const t = useT();
  const { fontSize, theme: sizes } = usePanelSizes();
  const stepRequests = useStepRequests();
  const now = useWaitClock(run?.record ?? null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLElement>(null);

  const hasHistory = workflow !== undefined;
  const page: WorkflowPanelTab = hasHistory ? tab : 'overview';

  useEffect(() => {
    if (!revealSettings) return;
    // The settings are a card of the Overview: go there first.
    if (page !== 'overview') {
      onTabChange('overview');
      return;
    }
    const scroller = scrollerRef.current;
    const settings = settingsRef.current;
    if (scroller && settings) {
      scroller.scrollTop += settings.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    }
    onSettingsRevealed?.();
  }, [revealSettings, page, onTabChange, onSettingsRevealed]);

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
  const tabs: Array<{ id: WorkflowPanelTab; label: string; count?: number }> = [
    { id: 'overview', label: t('workbench.editors.live.panel.tabOverview') },
    { id: 'history', label: t('workbench.editors.live.panel.tabHistory'), count: keptRuns.length },
  ];

  const handleAddStep = (pick: StepPick) => {
    const added = addPickedStep(draft, pick);
    setDraft(added.draft);
    onStepAdded(added.stepUid);
  };

  return (
    <ConfigProvider componentSize="small" theme={sizes}>
      <div className="oh-wf-step-panel" style={{ fontSize }}>
        <div className={hasHistory ? 'oh-wf-step-head oh-wf-step-head--tabs' : 'oh-wf-step-head'}>
          <div className="oh-wf-step-head-row">
            <b className="oh-wf-step-name oh-wf-overview-name">{name}</b>
            <KindTag size="panel">{stepCount}</KindTag>
          </div>
          <div className="oh-wf-overview-hint">{t('workbench.editors.live.panel.noStep')}</div>
          {hasHistory && (
            <div className="oh-wf-tabs" role="tablist">
              {tabs.map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className="oh-wf-tab"
                  aria-selected={page === id}
                  data-testid={`wf-panel-tab-${id}`}
                  onClick={() => onTabChange(id)}
                >
                  {label}
                  {count !== undefined && (
                    <span className="oh-wf-tab-count" data-testid="wf-history-count">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={scrollerRef} className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
          <ConfigProvider componentDisabled={readOnly}>
            {page === 'history' ? (
              <div className="oh-wf-panel-body">
                <WorkflowHistoryCard
                  runs={keptRuns}
                  shownRunId={run != null && !run.refused ? run.record.runId : null}
                  onPick={onPickRun}
                />
              </div>
            ) : (
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
                  stepChoices={model.stepChoices}
                  onAdd={handleAddStep}
                />
                <WorkflowCapturesCard captures={captures} />
                {runs !== undefined && (
                  <WorkflowEnvironmentsCard
                    runs={runs}
                    refresh={draft.refresh}
                    boundCount={boundCount}
                    verdictOnly={model.holdsSession}
                  />
                )}
                <WorkflowSettingsCard
                  ref={settingsRef}
                  refresh={draft.refresh}
                  onRefreshChange={(refresh) => setDraft({ ...draft, refresh })}
                  enabled={draft.enabled}
                  onEnabledChange={(enabled) => setDraft({ ...draft, enabled })}
                  availableCaptures={model.availableCaptures}
                  holdsSession={model.holdsSession}
                />
                <DescriptionCard
                  testId="wf-description"
                  line={t('workbench.editors.live.description.workflowLine')}
                  value={draft.description}
                  onChange={(description) => setDraft({ ...draft, description })}
                  fieldPath={LIVE_WORKFLOW_FIELD.description}
                />
              </div>
            )}
          </ConfigProvider>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default WorkflowOverviewPanel;
