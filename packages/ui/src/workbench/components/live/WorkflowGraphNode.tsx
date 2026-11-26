/**
 * WorkflowGraphNode — one step on the workflow graph, as the workflows
 * redesign draws it: a fixed card with the step's state glyph on the
 * left and four lines that never wrap — the step's name with its
 * protocol and its kind, what it does, its key setting, and what the
 * last run made of it. A selected node wears the accent ring, whatever
 * its state.
 *
 * Beside the name sit three marks the design does not draw: the step has
 * a run condition, a capture sets its order, the draft says something is
 * wrong with it.
 */

import { FilterOutlined, SortAscendingOutlined, ThunderboltFilled, WarningOutlined } from '@ant-design/icons';
import type { DraftCapture } from '@openheaders/core/live';
import type { LiveVariable, StepGateClause } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { Tooltip } from 'antd';
import type React from 'react';
import { type RequestKind, requestKindMeta } from '../../request-kind-menu';
import { REQUEST_KIND_COLORS } from '../sidebar/icons';
import { STEP_MARK_INK } from './StepGlyph';
import type { StepMark } from './step-mark';
import { StepRunMark } from './WorkflowGraphRunOverlay';

export const GRAPH_NODE_W = 232;
export const GRAPH_NODE_H = 92;

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const LINE: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const TAG: React.CSSProperties = {
  flex: 'none',
  padding: '0 6px',
  borderRadius: 4,
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

/** The design draws three protocol tags; a kind it does not draw wears the app's own colour for that kind. */
const DESIGNED_PROTOCOL_TAG: Partial<Record<RequestKind, React.CSSProperties>> = {
  http: { color: 'var(--oh-wf-tag-http)', background: 'var(--oh-wf-tag-http-bg)' },
  graphql: { color: 'var(--oh-wf-tag-graphql)', background: 'var(--oh-wf-tag-graphql-bg)' },
  mqtt: { color: 'var(--oh-wf-tag-mqtt)', background: 'var(--oh-wf-tag-mqtt-bg)' },
};

function protocolTagStyle(kind: RequestKind): React.CSSProperties {
  return (
    DESIGNED_PROTOCOL_TAG[kind] ?? {
      color: REQUEST_KIND_COLORS[kind],
      background: `color-mix(in srgb, ${REQUEST_KIND_COLORS[kind]} 14%, transparent)`,
    }
  );
}

function clauseSummary(clause: StepGateClause, t: Translate): string {
  switch (clause.kind) {
    case 'status':
      return typeof clause.match === 'string'
        ? t('workbench.editors.live.graph.clauseStatusIs', { stepId: clause.stepId, value: clause.match })
        : clause.match[0] === 'eq'
          ? t('workbench.editors.live.graph.clauseStatusIs', { stepId: clause.stepId, value: clause.match[1] })
          : clause.match[0] === 'ne'
            ? t('workbench.editors.live.graph.clauseStatusIsNot', { stepId: clause.stepId, value: clause.match[1] })
            : t('workbench.editors.live.graph.clauseStatusIn', {
                stepId: clause.stepId,
                list: clause.match[1].join(', '),
              });
    case 'capture-exists':
      return t('workbench.editors.live.graph.clauseCaptureExists', {
        ref: `${clause.stepId}.${clause.captureName}`,
      });
    case 'capture-equals':
      // Pure technical composition — no English words, stays raw.
      return `${clause.stepId}.${clause.captureName} = "${clause.value}"`;
    case 'capture-matches':
      return t('workbench.editors.live.graph.clauseCaptureMatches', {
        ref: `${clause.stepId}.${clause.captureName}`,
        pattern: clause.pattern,
      });
  }
}

/** A node's second line: what the step does. */
export interface GraphNodeDoes {
  /** A call's method, ahead of its request's name. */
  lead?: string;
  text: string;
  /** An address is code; a name is not. */
  mono?: boolean;
  /** The line stands for something missing. */
  muted?: boolean;
}

interface WorkflowGraphNodeProps {
  stepId: string;
  x: number;
  y: number;
  selected: boolean;
  onSelect?: () => void;
  /** Right-click — selects the node and opens the compact context menu. */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Drag-to-move handlers — ephemeral layout offsets owned by the body. */
  onDragDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** The kind of request the step speaks — `null` where it names none the workspace holds. */
  protocol: RequestKind | null;
  /** The step's kind in a word — empty for a step of an action the model does not know. */
  kind: string;
  does: GraphNodeDoes;
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
  /** This step's captured values from the cache row. */
  runCaptures?: Record<string, string>;
  /** This step's response byte count from the cache row. */
  runResponseBytes?: number;
  gateClauses: readonly StepGateClause[];
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
  onSelect,
  onContextMenu,
  onDragDown,
  onDragMove,
  onDragUp,
  protocol,
  kind,
  does,
  unknownAction,
  armedBy,
  usedBy,
  captures,
  boundVars,
  mark,
  runCaptures,
  runResponseBytes,
  gateClauses,
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
      onClick={onSelect}
      onContextMenu={onContextMenu}
      // Select on press, not on release — the highlight (node +
      // outgoing arrows) must follow the node through a drag.
      onPointerDown={(e) => {
        onSelect?.();
        onDragDown?.(e);
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragUp}
      onPointerCancel={onDragUp}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: GRAPH_NODE_W,
        height: GRAPH_NODE_H,
        boxSizing: 'border-box',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: 14,
        background: 'var(--oh-wf-surface)',
        color: 'var(--oh-wf-text)',
        boxShadow: ring,
        touchAction: 'none',
        cursor: onSelect ? 'pointer' : undefined,
      }}
    >
      <StepRunMark stepId={stepId} mark={mark} captures={runCaptures} responseBytes={runResponseBytes} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 20 }}>
          <b
            style={{
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: needsUpdate ? 'var(--oh-wf-text-secondary)' : undefined,
            }}
          >
            {stepId}
          </b>
          {protocol !== null && (
            <span style={{ ...TAG, ...protocolTagStyle(protocol) }}>{t(requestKindMeta(protocol).labelKey)}</span>
          )}
          {kind !== '' && (
            <span style={{ ...TAG, background: 'var(--oh-wf-tag-bg)', color: 'var(--oh-wf-tag-text)' }}>{kind}</span>
          )}
          {gateClauses.length > 0 && (
            <Tooltip
              title={
                <div>
                  {gateClauses.map((clause) => (
                    <div key={clause.uid} style={{ fontSize: 11 }}>
                      {clauseSummary(clause, t)}
                    </div>
                  ))}
                </div>
              }
            >
              <FilterOutlined
                data-testid={`wf-graph-gate-${stepId}`}
                style={{ flex: 'none', fontSize: 11, color: 'var(--ant-color-warning)' }}
              />
            </Tooltip>
          )}
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
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--oh-wf-text-secondary)' }}>{does.lead} </span>
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
