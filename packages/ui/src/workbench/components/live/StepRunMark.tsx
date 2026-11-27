/**
 * StepRunMark — a graph node's run mark (the workflows redesign, Step
 * states): the state glyph `WorkflowGraphNode` wears. Hovered, it says
 * the state in words. The values a step captured are its panel's to
 * show, in its Captures card.
 *
 * The mark is derived by the graph at render time; this holds no state,
 * and it never touches the draft.
 */

import { Tooltip } from 'antd';
import type React from 'react';
import StepGlyph from './StepGlyph';
import type { StepMark } from './step-mark';

const NODE_GLYPH_SIZE = 16;

interface Props {
  stepId: string;
  mark: StepMark;
}

const StepRunMark: React.FC<Props> = ({ stepId, mark }) => (
  <Tooltip title={mark.detail !== undefined ? `${mark.label}: ${mark.detail}` : mark.label}>
    <span
      data-testid={`wf-graph-run-${stepId}`}
      data-run-state={mark.kind}
      style={{ display: 'inline-flex', flex: 'none' }}
    >
      <StepGlyph kind={mark.kind} label={mark.label} size={NODE_GLYPH_SIZE} />
    </span>
  </Tooltip>
);

export default StepRunMark;
