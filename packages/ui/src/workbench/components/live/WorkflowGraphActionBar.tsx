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
import GraphControlGroup from './GraphControlGroup';
import { nodeRectInPane, placeActionBar } from './graph-action-bar';
import type { PaneViewport, Point, Size } from './graph-minimap';
import { StepPickerPopover } from './StepPicker';
import type { StepPick, StepPickerChoices } from './step-picker';
import { usePaneSize } from './use-pane-size';

/** A graph control's side, and the box's edge on both sides of the row. */
const BUTTON = 24;
const BOX_EDGE = 2;

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
  /** The map's box at rest and what it keeps from the pane's corner — `null` where the graph has no map. */
  map: { size: Size; right: number; bottom: number } | null;
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
  map,
  actions,
  picker,
}) => {
  const paneSize = usePaneSize(pane);
  if (node === null || paneSize === null || actions.length === 0) return null;

  const at = placeActionBar({
    node: nodeRectInPane(node, nodeSize, viewport),
    pane: paneSize,
    bar: { width: actions.length * BUTTON + BOX_EDGE, height: BUTTON + BOX_EDGE },
    topBand,
    ringReach: ringReach * viewport.scale,
    lineClear: lineClear * viewport.scale,
    avoid:
      map === null
        ? null
        : {
            x: paneSize.width - map.right - map.size.width,
            y: paneSize.height - map.bottom - map.size.height,
            ...map.size,
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
