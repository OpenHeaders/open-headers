/**
 * WorkflowGraphLines — the lines of the workflow graph, as the workflows
 * redesign draws them: one per dependency, square turns rounded, a port
 * dot where it leaves a step and an arrowhead where it enters one, its
 * condition as a label, the captures its child reads as chips, and a
 * capsule where the lines of a step with a run condition meet.
 *
 * A line the last run took is dark and its label bold; one it did not
 * take is dashed and its label struck. The lines of the selected step,
 * a selected line and the line under the pointer wear the accent, on
 * top of the others.
 *
 * The lines lie under the nodes and their labels over them, so the
 * nodes are handed in as children and drawn between the two.
 */

import { CloseOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { GraphLineState, LineTruth } from './graph-lines';
import { arrowHeadPath, type RoutedCapsule, type RoutedLine } from './graph-routing';

export interface GraphLineView extends RoutedLine {
  /** Its condition in words. */
  text: string;
  /** The captures of its parent that its child reads. */
  chips: readonly string[];
  state: GraphLineState;
}

export interface GraphCapsuleView extends RoutedCapsule {
  state: LineTruth;
}

export interface GraphEdgeRef {
  from: string;
  to: string;
}

interface WorkflowGraphLinesProps {
  width: number;
  height: number;
  lines: readonly GraphLineView[];
  capsules: readonly GraphCapsuleView[];
  selectedStepId: string | null;
  selectedEdge: GraphEdgeRef | null;
  /** Present on a graph that can be edited: a press on a line selects it. */
  onSelectEdge?: (edge: GraphEdgeRef) => void;
  onRemoveEdge?: (edge: GraphEdgeRef) => void;
  /** The nodes. */
  children: React.ReactNode;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const ACCENT = 'var(--oh-wf-accent)';
const LABEL_MAX_WIDTH = 118;
const CAPSULE_MIN_W = 30;
const CAPSULE_H = 16;

const sameEdge = (a: GraphEdgeRef | null, b: GraphEdgeRef): boolean =>
  a !== null && a.from === b.from && a.to === b.to;

const inkOf = (truth: LineTruth, hot: boolean): string =>
  hot ? ACCENT : truth === 'taken' ? 'var(--oh-wf-line-taken)' : 'var(--oh-wf-line)';

const dashOf = (truth: LineTruth): string | undefined => (truth === 'not-taken' ? '3 4' : undefined);

/** Drawn last is drawn on top: the accent over a taken line over the rest. */
const rankOf = (truth: LineTruth, hot: boolean): number => (hot ? 2 : truth === 'taken' ? 1 : 0);

const LABEL_INK: Record<GraphLineState['label'], React.CSSProperties> = {
  unknown: { color: 'var(--oh-wf-text-secondary)' },
  true: { color: 'var(--oh-wf-text)', fontWeight: 600 },
  false: { color: 'var(--oh-wf-text-secondary)', textDecoration: 'line-through' },
};

const WorkflowGraphLines: React.FC<WorkflowGraphLinesProps> = ({
  width,
  height,
  lines,
  capsules,
  selectedStepId,
  selectedEdge,
  onSelectEdge,
  onRemoveEdge,
  children,
}) => {
  const t = useT();
  const [hovered, setHovered] = useState<GraphEdgeRef | null>(null);

  const drawn = lines
    .map((line) => {
      const selected = sameEdge(selectedEdge, line);
      const hot =
        selected || sameEdge(hovered, line) || line.from === selectedStepId || line.to === selectedStepId;
      return { line, selected, hot };
    })
    .sort((a, b) => rankOf(a.line.state.line, a.hot) - rankOf(b.line.state.line, b.hot));

  return (
    <>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        aria-hidden="true"
      >
        {capsules.map((capsule) => (
          <g
            key={capsule.stepId}
            data-testid={`wf-graph-capsule-arrow-${capsule.stepId}`}
            data-truth={capsule.state}
            style={{ color: inkOf(capsule.state, capsule.stepId === selectedStepId) }}
          >
            <path
              d={capsule.d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={dashOf(capsule.state)}
            />
            <path d={arrowHeadPath(capsule.arrow)} fill="currentColor" />
          </g>
        ))}
        {drawn.map(({ line, selected, hot }) => (
          <g key={`${line.from}->${line.to}`} style={{ color: inkOf(line.state.line, hot) }}>
            <path
              data-testid={`wf-graph-edge-${line.from}-${line.to}`}
              data-selected={selected ? 'true' : undefined}
              data-highlight={hot ? 'true' : undefined}
              data-truth={line.state.line}
              d={line.d}
              fill="none"
              stroke="currentColor"
              strokeWidth={selected ? 2 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashOf(line.state.line)}
            />
            <circle cx={line.port.x} cy={line.port.y} r={2.7} fill="currentColor" />
            {line.arrow !== undefined && <path d={arrowHeadPath(line.arrow)} fill="currentColor" />}
            {/* Widened transparent twin — what the pointer meets. SVG
                pointer-events re-enable under a none parent. */}
            <path
              data-testid={`wf-graph-edge-hit-${line.from}-${line.to}`}
              data-graph-interactive=""
              d={line.d}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: 'stroke', cursor: onSelectEdge ? 'pointer' : undefined }}
              onPointerEnter={() => setHovered({ from: line.from, to: line.to })}
              onPointerLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge?.({ from: line.from, to: line.to });
              }}
            />
          </g>
        ))}
      </svg>
      {children}
      {capsules.map((capsule) => (
        <div
          key={capsule.stepId}
          data-testid={`wf-graph-capsule-${capsule.stepId}`}
          style={{
            position: 'absolute',
            left: capsule.centre.x,
            top: capsule.centre.y,
            transform: 'translate(-50%, -50%)',
            minWidth: CAPSULE_MIN_W,
            height: CAPSULE_H,
            padding: '0 6px',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            border: '1px solid var(--oh-wf-track)',
            borderRadius: CAPSULE_H / 2,
            background: 'var(--oh-wf-surface)',
            color: 'var(--oh-wf-text-secondary)',
            textAlign: 'center',
            fontSize: 10,
            lineHeight: '14px',
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {t('workbench.editors.live.graph.capsuleAll')}
        </div>
      ))}
      {lines.map((line) => {
        const edge = { from: line.from, to: line.to };
        const selected = sameEdge(selectedEdge, line);
        return (
          <div
            key={`${line.from}->${line.to}`}
            data-testid={`wf-graph-edge-label-${line.from}-${line.to}`}
            data-graph-interactive=""
            data-truth={line.state.label}
            title={[line.text, ...line.chips].join(' · ')}
            onPointerEnter={() => setHovered(edge)}
            onPointerLeave={() => setHovered(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEdge?.(edge);
            }}
            style={{
              position: 'absolute',
              left: line.label.x,
              top: line.label.y,
              transform: line.label.align === 'right' ? 'translateX(-100%)' : undefined,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              lineHeight: '15px',
              whiteSpace: 'nowrap',
              cursor: onSelectEdge ? 'pointer' : undefined,
            }}
          >
            <span
              style={{
                maxWidth: LABEL_MAX_WIDTH,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...LABEL_INK[line.state.label],
              }}
            >
              {line.text}
            </span>
            {line.chips.map((chip) => (
              <span
                key={chip}
                style={{
                  flex: 'none',
                  padding: '0 4px',
                  border: '1px solid var(--oh-wf-track)',
                  borderRadius: 4,
                  background: 'var(--oh-wf-surface)',
                  color: 'var(--oh-wf-text)',
                  fontFamily: MONO,
                  lineHeight: '13px',
                }}
              >
                {chip}
              </span>
            ))}
            {selected && onRemoveEdge && (
              <Tooltip title={t('workbench.editors.live.graph.removeDependency')}>
                <button
                  type="button"
                  data-testid={`wf-graph-edge-remove-${line.from}-${line.to}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveEdge(edge);
                  }}
                  style={{
                    flex: 'none',
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '1px solid var(--ant-color-error)',
                    background: 'var(--oh-wf-surface)',
                    color: 'var(--ant-color-error)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <CloseOutlined style={{ fontSize: 8 }} />
                </button>
              </Tooltip>
            )}
          </div>
        );
      })}
    </>
  );
};

export default WorkflowGraphLines;
