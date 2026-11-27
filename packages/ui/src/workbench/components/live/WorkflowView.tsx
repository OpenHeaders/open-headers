/**
 * WorkflowView — a workflow's one screen (the workflows redesign): the
 * graph on the left, and docked on the right a panel that shows the
 * selected step, or the workflow as a whole while none is selected.
 *
 * The two share one grid whose panel track is a custom property: the
 * divider's drag writes that property and nothing else, so a resize of
 * the pane is the layout engine's alone. An editor pane too narrow for
 * the two side by side stacks them — the graph above, the panel under
 * it — and the stylesheet alone decides which it is
 * (`.oh-workflow-view`, the workbench's editor stylesheet): both
 * dividers are always mounted, and the layout shows the one it uses.
 *
 * The run the two draw is the latest, until a run is picked from the
 * workflow's History: then the graph and the panel draw that one, and a
 * line at the panel's head says which, with the way back.
 *
 * The draft's undo and redo are the view's: its shortcut acts wherever
 * focus is in the view, a field that takes typing aside.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { type DraftWorkflow, runVerdict } from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { Sash, type SashSession } from '@openheaders/ui/shared/dock-layout';
import type React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { buildChordsFromEvent } from '../../hooks/useWorkspaceShortcuts';
import type { StepRequestOpeners } from './step-facts';
import { type DraftHistoryControls, isTextEntry, REDO_CHORDS, UNDO_CHORD } from './use-draft-history';
import { useWorkflowFormModel } from './use-workflow-form-model';
import { type ShownWorkflowRun, useWorkflowRunPick, useWorkflowRuns } from './use-workflow-run';
import WorkflowGraphBody from './WorkflowGraphBody';
import WorkflowOverviewPanel, { type WorkflowPanelTab } from './WorkflowOverviewPanel';
import WorkflowShownRunBar from './WorkflowShownRunBar';
import WorkflowStepPanel from './WorkflowStepPanel';

const PANEL_WIDTH_VAR = '--oh-workflow-panel-width';
const PANEL_HEIGHT_VAR = '--oh-workflow-panel-height';
const PANEL_WIDTH_MIN = 360;
const PANEL_HEIGHT_MIN = 160;
/** What a drag of a divider leaves the graph, along the divider's axis. */
const GRAPH_WIDTH_MIN = 320;
const GRAPH_HEIGHT_MIN = 120;

/**
 * Where each divider was last dragged to — kept for this page's life,
 * for every workflow's view. `null` leaves the stylesheet's own default.
 */
const dragged: { width: number | null; height: number | null } = { width: null, height: null };

function applyTrack(root: HTMLElement, name: string, px: number | null): void {
  if (px === null) root.style.removeProperty(name);
  else root.style.setProperty(name, `${px}px`);
}

function applyDragged(root: HTMLElement): void {
  applyTrack(root, PANEL_WIDTH_VAR, dragged.width);
  applyTrack(root, PANEL_HEIGHT_VAR, dragged.height);
}

interface Props {
  /** The workflow's name, as its tab's header says it. */
  name: string;
  draft: DraftWorkflow;
  setDraft: (next: DraftWorkflow) => void;
  /** The draft's undo and redo. */
  history: DraftHistoryControls;
  /** The workflow is read-only here — it holds a step of an action the model does not know. */
  readOnly?: boolean;
  /** The selected step, by uid — a step keeps its selection through a rename. */
  selectedStepUid: string | null;
  onSelectStep: (stepUid: string | null) => void;
  /** The saved workflow on a surface that runs workflows — absent where there is no run to show. */
  workflow?: LiveWorkflow;
  /** The workflow's latest run on this page — what the view draws while no run is picked from its History. */
  run?: ShownWorkflowRun | null;
  /**
   * The active environment's cache row: the graph's marks while no run is
   * kept, and the values a step captured — `undefined` for a draft never
   * saved.
   */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  /** Every environment's cache row of the workflow — absent for a draft never saved. */
  runs?: LiveWorkflowRunSnapshot[];
  boundVars?: LiveVariable[];
  /** What opens a request's own tab — a step's panel opens the request the step names. */
  requestOpeners?: StepRequestOpeners;
  /** The header's schedule word was pressed: the workflow's panel brings its setting to the top. */
  revealSettings?: boolean;
  onSettingsRevealed?: () => void;
}

const WorkflowView: React.FC<Props> = ({
  name,
  draft,
  setDraft,
  history,
  readOnly = false,
  selectedStepUid,
  onSelectStep,
  workflow,
  run: latestRun,
  cacheRun,
  runs,
  boundVars,
  requestOpeners,
  revealSettings,
  onSettingsRevealed,
}) => {
  const model = useWorkflowFormModel(draft, setDraft);
  // Held here, above the panel: a step opened and closed returns to the page that was open.
  const [panelTab, setPanelTab] = useState<WorkflowPanelTab>('overview');
  const keptRuns = useWorkflowRuns(workflow?.uid ?? '');
  const { run, picked, pick, backToLatest } = useWorkflowRunPick(keptRuns, latestRun);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const selectedIndex = selectedStepUid === null ? -1 : draft.steps.findIndex((step) => step.uid === selectedStepUid);
  const selectedStepId = selectedIndex >= 0 ? draft.steps[selectedIndex].id : null;

  useLayoutEffect(() => {
    if (rootRef.current) applyDragged(rootRef.current);
  }, []);

  const beginWidth = useCallback((): SashSession | null => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return null;
    return {
      start: panel.clientWidth,
      min: PANEL_WIDTH_MIN,
      max: Math.max(PANEL_WIDTH_MIN, root.clientWidth - GRAPH_WIDTH_MIN),
      apply: (px) => root.style.setProperty(PANEL_WIDTH_VAR, `${px}px`),
      commit: (px) => {
        dragged.width = Math.round(px);
      },
    };
  }, []);

  const beginHeight = useCallback((): SashSession | null => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return null;
    return {
      start: panel.clientHeight,
      min: PANEL_HEIGHT_MIN,
      max: Math.max(PANEL_HEIGHT_MIN, root.clientHeight - GRAPH_HEIGHT_MIN),
      apply: (px) => root.style.setProperty(PANEL_HEIGHT_VAR, `${px}px`),
      commit: (px) => {
        dragged.height = Math.round(px);
      },
    };
  }, []);

  const resetWidth = useCallback(() => {
    dragged.width = null;
    if (rootRef.current) applyDragged(rootRef.current);
  }, []);

  const resetHeight = useCallback(() => {
    dragged.height = null;
    if (rootRef.current) applyDragged(rootRef.current);
  }, []);

  // Undo and redo from anywhere in the view but a field that takes
  // typing — there the field's own undo acts.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && isTextEntry(e.target)) return;
    const chords = buildChordsFromEvent(e.nativeEvent);
    if (chords.includes(UNDO_CHORD)) {
      e.preventDefault();
      history.undo();
    } else if (REDO_CHORDS.some((chord) => chords.includes(chord))) {
      e.preventDefault();
      history.redo();
    }
  };

  return (
    <div
      ref={rootRef}
      className="oh-workflow-view"
      data-testid="wf-view"
      data-run-verdict={run != null ? runVerdict(run.record) : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="oh-workflow-view-graph">
        <WorkflowGraphBody
          draft={draft}
          setDraft={readOnly ? undefined : setDraft}
          history={history}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
          onDeselect={() => onSelectStep(null)}
          run={run}
          cacheRun={cacheRun}
          boundVars={boundVars}
          stepChoices={model.stepChoices}
          requestOpeners={requestOpeners}
        />
      </div>
      <aside ref={panelRef} className="oh-workflow-view-panel" data-testid="wf-panel">
        <Sash axis="x" edge="start" begin={beginWidth} onReset={resetWidth} />
        <Sash axis="y" edge="start" begin={beginHeight} onReset={resetHeight} />
        {picked !== null && <WorkflowShownRunBar record={picked} onBackToLatest={backToLatest} />}
        {selectedIndex >= 0 ? (
          <WorkflowStepPanel
            draft={draft}
            model={model}
            stepIndex={selectedIndex}
            readOnly={readOnly}
            onClose={() => onSelectStep(null)}
            onSelectStep={onSelectStep}
            run={run}
            cacheRun={cacheRun}
            requestOpeners={requestOpeners}
          />
        ) : (
          <WorkflowOverviewPanel
            name={name}
            draft={draft}
            setDraft={setDraft}
            model={model}
            readOnly={readOnly}
            onSelectStep={onSelectStep}
            tab={panelTab}
            onTabChange={setPanelTab}
            workflow={workflow}
            run={run}
            keptRuns={keptRuns}
            onPickRun={pick}
            cacheRun={cacheRun}
            runs={runs}
            boundCount={boundVars?.length}
            revealSettings={revealSettings}
            onSettingsRevealed={onSettingsRevealed}
          />
        )}
      </aside>
    </div>
  );
};

export default WorkflowView;
