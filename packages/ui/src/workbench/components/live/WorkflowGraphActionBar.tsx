/**
 * WorkflowGraphActionBar — what is done to the selected step as a whole,
 * in a bar by its node (the workflow runs plan, Decisions log, S31): a
 * copy of it, a step added after it, its request opened, its removal.
 * Icons, each named on hover. The bar is drawn over the pane, not in the
 * graph, so the zoom never scales it; `placeActionBar` says where it
 * sits — above the node at its left, where no line of the node runs.
 */

import { Button, Tooltip } from 'antd';
import type React from 'react';
import GraphControlGroup, { controlGroupSize } from './GraphControlGroup';
import { nodeRectInPane, placeActionBar } from './graph-action-bar';
import type { PaneViewport, Point, Size } from './graph-minimap';
import { StepPickerPopover } from './StepPicker';
import type { StepPick, StepPickerChoices } from './step-picker';
import { usePaneSize } from './use-pane-size';

/** An action of the graph on a step or on its canvas — a row of the right-click menu, a button of the bar. */
export interface GraphAction {
  key: string;
  icon: React.ReactNode;
  text: string;
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  /** The action opens the step picker; in the bar the picker hangs on its button. */
  opensPicker?: boolean;
  /** A row of the menu alone: one more button would reach the node's middle, where its line enters. */
  menuOnly?: boolean;
  onClick: () => void;
}

/** The step picker as the bar opens it. */
export interface ActionBarPicker {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choices: StepPickerChoices;
  onPick: (pick: StepPick) => void;
}

interface Props {
  pane: React.RefObject<HTMLDivElement | null>;
  viewport: PaneViewport;
  /** The selected node's place in the graph — `null` while no step is selected. */
  node: Point | null;
  nodeSize: Size;
  /** The band at the pane's top the bar stays out of. */
  topBand: number;
  /** How far under a node its connect ring reaches, in the graph's own units. */
  ringReach: number;
  /** What the bar keeps from the node's middle, where its lines run, in the graph's own units. */
  lineClear: number;
  /**
   * What sits in the pane's bottom-right corner at rest — the zoom group,
   * with the map where there is one — and what it keeps from the corner.
   */
  corner: { size: Size; right: number; bottom: number };
  /** The step's actions; the bar draws the ones that are not the menu's alone. */
  actions: readonly GraphAction[];
  picker?: ActionBarPicker;
}

const WorkflowGraphActionBar: React.FC<Props> = ({
  pane,
  viewport,
  node,
  nodeSize,
  topBand,
  ringReach,
  lineClear,
  corner,
  actions: stepActions,
  picker,
}) => {
  const paneSize = usePaneSize(pane);
  const actions = stepActions.filter((action) => action.menuOnly !== true);
  if (node === null || paneSize === null || actions.length === 0) return null;

  const at = placeActionBar({
    node: nodeRectInPane(node, nodeSize, viewport),
    pane: paneSize,
    bar: controlGroupSize(actions.length),
    topBand,
    ringReach: ringReach * viewport.scale,
    lineClear: lineClear * viewport.scale,
    avoid: {
      x: paneSize.width - corner.right - corner.size.width,
      y: paneSize.height - corner.bottom - corner.size.height,
      ...corner.size,
    },
  });
  if (at === null) return null;

  // A press leaves focus on the graph: the button may be gone once its
  // action is done, and the graph's shortcuts would stop with it.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div data-testid="wf-graph-bar" style={{ position: 'absolute', left: at.x, top: at.y, zIndex: 3 }}>
      <GraphControlGroup>
        {actions.map((action) => {
          const hangsPicker = action.opensPicker === true && picker !== undefined;
          const button = (
            <Tooltip key={action.key} title={action.text} open={hangsPicker && picker.open ? false : undefined}>
              <Button
                type="text"
                size="small"
                data-testid={`wf-graph-bar-${action.key}`}
                aria-label={action.text}
                icon={action.icon}
                danger={action.danger}
                disabled={action.disabled}
                onMouseDown={keepFocus}
                // The picker's own popover answers a press of its door.
                onClick={hangsPicker ? undefined : action.onClick}
              />
            </Tooltip>
          );
          return hangsPicker ? (
            <StepPickerPopover
              key={action.key}
              open={picker.open}
              onOpenChange={picker.onOpenChange}
              placement="bottomLeft"
              choices={picker.choices}
              onPick={picker.onPick}
            >
              {button}
            </StepPickerPopover>
          ) : (
            button
          );
        })}
      </GraphControlGroup>
    </div>
  );
};

export default WorkflowGraphActionBar;
