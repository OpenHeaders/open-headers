/**
 * WorkflowGraphNode — one step on the workflow graph, as the workflows
 * redesign draws it: a fixed card with the step's state glyph on the
 * left and four lines that never wrap — the step's name with its
 * protocol and its kind, what it does, its key setting, and what the
 * last run made of it. A selected node wears the accent ring, whatever
 * its state.
 *
 * Its sizes are one step under the design's: the whole workflow view
 * is drawn that much smaller, to hold more.
 *
 * Beside the name sit two marks the design does not draw: a capture
 * sets the step's order, the draft says something is wrong with it.
 *
 * A step that waits on no other wears a bar in the accent on its top
 * edge (the workflow runs plan, Decisions log, S31): a run starts there.
 *
 * Where the graph can be arranged the node is moved by its body: it
 * takes the pointer's handlers (`drag`) and the graph decides what a
 * press that moves does.
 */

import { SortAscendingOutlined, ThunderboltFilled, WarningOutlined } from '@ant-design/icons';
import type { DraftCapture } from '@openheaders/core/live';
import type { LiveVariable } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tooltip } from 'antd';
import type React from 'react';
import type { RequestKind } from '../../request-kind-menu';
import { STEP_MARK_INK } from './StepGlyph';
import StepRunMark from './StepRunMark';
import { KindTag, ProtocolTag } from './StepTags';
import type { StepDoes } from './step-facts';
import type { StepMark } from './step-mark';

export const GRAPH_NODE_W = 208;
export const GRAPH_NODE_H = 82;
/** The bar on the top edge of a step a run starts at. */
const START_BAR_H = 3;

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const LINE: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  lineHeight: '15px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** The pointer's handlers of a node that can be moved. */
export interface NodeDragHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

interface WorkflowGraphNodeProps {
  stepId: string;
  x: number;
  y: number;
  selected: boolean;
  /** Present where the node can be moved by its body. */
  drag?: NodeDragHandlers;
  /** The node is being moved: it is drawn over the others. */
  moving?: boolean;
  /** The step waits on no other: a run starts here, and the node wears the start bar. */
  start: boolean;
  onSelect?: () => void;
  /** Right-click — selects the node and opens the compact context menu. */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** The pointer is over the node, or has left it. */
  onHover?: (over: boolean) => void;
  /** The kind of request the step speaks — `null` where it names none the workspace holds. */
  protocol: RequestKind | null;
  /** The step's kind in a word — empty for a step of an action the model does not know. */
  kind: string;
  /** The node's second line: what the step does. */
  does: StepDoes;
  /** Set for a step of an action the model does not know — its raw `action`. */
  unknownAction?: string;
  /** What arms a session step, as text: the listen it is on, the step it waits after. */
  armedBy: string;
  /** The steps that act on a listen's session. */
  usedBy: readonly string[];
  captures: readonly DraftCapture[];
  /** Bound LVs — publication state per exposed capture; absent for a draft never saved. */
  boundVars?: LiveVariable[];
  mark: StepMark;
  /** How a capture orders the step — empty where none does. */
  priorityLabel: string;
  errors: readonly string[];
  /** Dropping the in-flight connect here would create a cycle. */
  cycleWarn: boolean;
}

const WorkflowGraphNode: React.FC<WorkflowGraphNodeProps> = ({
  stepId,
  x,
  y,
  selected,
  drag,
  moving = false,
  start,
  onSelect,
  onContextMenu,
  onHover,
  protocol,
  kind,
  does,
  unknownAction,
  armedBy,
  usedBy,
  captures,
  boundVars,
  mark,
  priorityLabel,
  errors,
  cycleWarn,
}) => {
  const t = useT();
  const needsUpdate = unknownAction !== undefined;
  const ring = cycleWarn
    ? '0 0 0 2px var(--ant-color-warning)'
    : selected
      ? 'var(--oh-wf-node-ring)'
      : errors.length > 0
        ? '0 0 0 1px var(--ant-color-error-border), var(--oh-wf-node-shadow)'
        : 'var(--oh-wf-node-shadow)';

  // The key setting, in the order a person reads it: what arms the step,
  // who uses its session, what it keeps.
  const setting: React.ReactNode[] = [
    ...(needsUpdate
      ? [
          <span key="action" style={{ fontFamily: MONO }}>
            {unknownAction}
          </span>,
        ]
      : []),
    ...(armedBy !== ''
      ? [
          <span key="armed" data-testid={`wf-graph-armed-${stepId}`}>
            {armedBy}
          </span>,
        ]
      : []),
    ...(usedBy.length > 0
      ? [<span key="used">{`${t('workbench.editors.live.graph.usedByPrefix')} ${usedBy.join(', ')}`}</span>]
      : []),
    ...(captures.length > 0
      ? [
          <span key="captures">
            {`${t('workbench.editors.live.graph.capturesPrefix')} `}
            {captures.map((capture, index) => (
              <CaptureName
                key={capture.uid}
                stepId={stepId}
                capture={capture}
                boundVars={boundVars}
                first={index === 0}
              />
            ))}
          </span>,
        ]
      : []),
  ];

  return (
    <div
      data-testid={`wf-graph-node-${stepId}`}
      data-graph-interactive=""
      data-needs-update={needsUpdate ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      data-cycle-target={cycleWarn ? 'true' : undefined}
      data-moving={moving ? 'true' : undefined}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onPointerEnter={onHover ? () => onHover(true) : undefined}
      onPointerLeave={onHover ? () => onHover(false) : undefined}
      {...drag}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: GRAPH_NODE_W,
        height: GRAPH_NODE_H,
        boxSizing: 'border-box',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        borderRadius: 12,
        background: 'var(--oh-wf-surface)',
        color: 'var(--oh-wf-text)',
        boxShadow: ring,
        cursor: moving ? 'grabbing' : onSelect ? 'pointer' : undefined,
        // A touch on a node that can be moved moves it, and scrolls nothing.
        touchAction: drag ? 'none' : undefined,
        zIndex: moving ? 1 : undefined,
      }}
    >
      {start && (
        // Cut by the node's own corners, so the bar follows its top edge.
        <span
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}
        >
          <span
            data-testid={`wf-graph-start-${stepId}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: START_BAR_H,
              background: 'var(--oh-wf-accent)',
            }}
          />
        </span>
      )}
      <StepRunMark stepId={stepId} mark={mark} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, height: 18 }}>
          <b
            style={{
              minWidth: 0,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: needsUpdate ? 'var(--oh-wf-text-secondary)' : undefined,
            }}
          >
            {stepId}
          </b>
          {protocol !== null && <ProtocolTag kind={protocol} size="node" />}
          {kind !== '' && <KindTag size="node">{kind}</KindTag>}
          {priorityLabel !== '' && (
            <Tooltip title={priorityLabel}>
              <SortAscendingOutlined style={{ flex: 'none', fontSize: 11, color: 'var(--oh-wf-quiet)' }} />
            </Tooltip>
          )}
          {errors.length > 0 && (
            <Tooltip
              title={
                <div>
                  {errors.map((message) => (
                    <div key={message} style={{ fontSize: 11 }}>
                      {message}
                    </div>
                  ))}
                </div>
              }
            >
              <WarningOutlined
                data-testid={`wf-graph-error-${stepId}`}
                style={{ flex: 'none', fontSize: 11, color: 'var(--ant-color-error)' }}
              />
            </Tooltip>
          )}
        </span>
        {does.text !== '' && (
          <span style={{ ...LINE, color: does.muted ? 'var(--oh-wf-text-secondary)' : undefined }}>
            {does.lead !== undefined && does.lead !== '' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--oh-wf-text-secondary)' }}>{does.lead} </span>
            )}
            <span style={does.mono ? { fontFamily: MONO } : undefined}>{does.text}</span>
          </span>
        )}
        {setting.length > 0 && (
          <span style={{ ...LINE, color: 'var(--oh-wf-text-secondary)' }}>
            {setting.flatMap((part, index) => (index === 0 ? [part] : [' · ', part]))}
          </span>
        )}
        {mark.text !== '' && (
          <span
            data-testid={`wf-graph-result-${stepId}`}
            title={mark.detail !== undefined ? `${mark.text}: ${mark.detail}` : mark.text}
            style={{ ...LINE, color: STEP_MARK_INK[mark.kind] }}
          >
            {mark.text}
          </span>
        )}
      </span>
    </div>
  );
};

/**
 * One capture's name on a node. An exposed capture reads by its live
 * name with the bolt: Save activates the workflow, a successful run is
 * what publishes its variables — until then the bolt is grey.
 */
const CaptureName: React.FC<{
  stepId: string;
  capture: DraftCapture;
  boundVars: LiveVariable[] | undefined;
  first: boolean;
}> = ({ stepId, capture, boundVars, first }) => {
  const t = useT();
  const lv =
    capture.exposed && boundVars
      ? (boundVars.find((v) => v.uid === capture.liveUid) ??
        boundVars.find((v) => v.stepId === stepId && v.captureName === capture.name))
      : undefined;
  const publicationKnown = capture.exposed && boundVars !== undefined;
  const pending = publicationKnown && lv?.published !== true;
  const exposedTitle = pending
    ? t('workbench.editors.live.graph.exposedAsPending', { name: capture.liveName })
    : t('workbench.editors.live.graph.exposedAs', { name: capture.liveName });
  return (
    <>
      {!first && ', '}
      <span
        data-lv-published={publicationKnown ? String(!pending) : undefined}
        title={capture.exposed ? exposedTitle : undefined}
        style={{ fontFamily: MONO }}
      >
        {capture.exposed && (
          <ThunderboltFilled
            style={{ fontSize: 10, marginRight: 2, color: pending ? 'var(--oh-wf-quiet)' : 'var(--ant-color-warning)' }}
          />
        )}
        {capture.exposed ? capture.liveName : capture.name}
      </span>
    </>
  );
};

export default WorkflowGraphNode;
