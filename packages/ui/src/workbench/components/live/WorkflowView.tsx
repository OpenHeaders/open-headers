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
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { type DraftWorkflow, runVerdict } from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { Sash, type SashSession } from '@openheaders/ui/shared/dock-layout';
import type React from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useWorkflowFormModel } from './use-workflow-form-model';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowGraphBody from './WorkflowGraphBody';
import WorkflowOverviewPanel from './WorkflowOverviewPanel';
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
  draft: DraftWorkflow;
  setDraft: (next: DraftWorkflow) => void;
  /** The workflow is read-only here — it holds a step of an action the model does not know. */
  readOnly?: boolean;
  /** The selected step, by uid — a step keeps its selection through a rename. */
  selectedStepUid: string | null;
  onSelectStep: (stepUid: string | null) => void;
  /** The saved workflow on a surface that runs workflows — absent where there is no run to show. */
  workflow?: LiveWorkflow;
  run?: ShownWorkflowRun | null;
  /** The active environment's cache row for the graph's run marks — `undefined` for a draft never saved. */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  boundVars?: LiveVariable[];
}

const WorkflowView: React.FC<Props> = ({
  draft,
  setDraft,
  readOnly = false,
  selectedStepUid,
  onSelectStep,
  workflow,
  run,
  cacheRun,
  boundVars,
}) => {
  const model = useWorkflowFormModel(draft, setDraft);
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

  return (
    <div
      ref={rootRef}
      className="oh-workflow-view"
      data-testid="wf-view"
      data-run-verdict={run != null ? runVerdict(run.record) : undefined}
    >
      <div className="oh-workflow-view-graph">
        <WorkflowGraphBody
          draft={draft}
          setDraft={readOnly ? undefined : setDraft}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
          onDeselect={() => onSelectStep(null)}
          run={cacheRun}
          boundVars={boundVars}
        />
      </div>
      <aside ref={panelRef} className="oh-workflow-view-panel" data-testid="wf-panel">
        <Sash axis="x" edge="start" begin={beginWidth} onReset={resetWidth} />
        <Sash axis="y" edge="start" begin={beginHeight} onReset={resetHeight} />
        {selectedIndex >= 0 ? (
          <WorkflowStepPanel
            draft={draft}
            model={model}
            stepIndex={selectedIndex}
            readOnly={readOnly}
            onClose={() => onSelectStep(null)}
            run={run}
          />
        ) : (
          <WorkflowOverviewPanel
            draft={draft}
            setDraft={setDraft}
            model={model}
            readOnly={readOnly}
            onSelectStep={onSelectStep}
            workflow={workflow}
            run={run}
          />
        )}
      </aside>
    </div>
  );
};

export default WorkflowView;
