/**
 * WorkflowGraphBody — read-only graph view of a workflow draft
 * (WORKFLOW_GRAPH_PLAN.md slice 1).
 *
 * A pure projection of the same `DraftWorkflow` the form edits: one
 * node per step (request, captures + exposure marks, gate / priority
 * markers, validation badge), one edge per resolved `dependsOn`
 * parent. Layout comes from `buildWorkflowGraphLayout` — layers
 * top-down, declared order across each layer. The pane scrolls in both
 * axes; nodes are fixed-size so edge anchors stay deterministic.
 *
 * Selection (slice 2): click selects a node — highlight only, the view
 * stays on Graph; the selected node grows an explicit "Edit step"
 * affordance (double-click is the shortcut) that jumps to the form
 * scrolled to that step. Selection is ephemeral UI state owned by
 * `LiveWorkflowEditor` — it never touches the draft.
 *
 * Run overlay (slice 3): when the editor passes the active env's run
 * row (`run` — edit mode only; `undefined` disables the overlay), each
 * node carries a `classifyStepRun` state dot with a masked-by-default
 * captured-values popover, exposed capture chips carry the LV's
 * publication state (Save activates the workflow; a successful RUN is
 * what publishes the vars — pending until then), and a summary row
 * above the canvas mirrors the form strip's schedule/circuit/error
 * wording. Read-only and environment-scoped by construction: it
 * renders one `pickActiveRun` row, derived at render time.
 *
 * Editing (slice 4): when the editor passes `setDraft`, the graph
 * gains structural edit gestures that mutate the SAME draft the form
 * edits — never a second model:
 *   - connect: pointer-drag from a node's bottom anchor rubber-bands
 *     an edge; dropping on another node adds that `dependsOn` edge
 *     via `addGraphDependency`. Would-be-cycle targets tint warning
 *     during the drag but the drop still commits — the form allows
 *     invalid drafts and badges them, so the graph does the same.
 *   - remove: click an edge (widened transparent hit path) to select
 *     it, then the × affordance at its midpoint removes the edge.
 *   - add step: pane affordance appending the form's "+ Step"
 *     defaults and selecting the new node.
 * Rubber-banding is component-local state; only the drop mutates the
 * draft, so `isDirty` (a fingerprint comparison) can never move on a
 * gesture that didn't commit.
 */

import {
  CloseOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  SortAscendingOutlined,
  ThunderboltFilled,
  WarningOutlined,
} from '@ant-design/icons';
import type { DraftStep, DraftWorkflow } from '@openheaders/core/live';
import { validateStepRequestsExist, validateWorkflowShape } from '@openheaders/core/live';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { LiveVariable, LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { Button, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { METHOD_COLORS } from '../sidebar/icons';
import { addGraphDependency, appendDraftStep, removeGraphDependency } from './graph-edit';
import { buildWorkflowGraphLayout } from './graph-layout';
import { classifyStepRun, type StepRunState } from './live-display';
import { GraphRunSummary, StepRunDot } from './WorkflowGraphRunOverlay';

const { Text } = Typography;

const NODE_W = 208;
const NODE_H = 92;
const GAP_X = 32;
const GAP_Y = 48;
const PAD = 24;

interface WorkflowGraphBodyProps {
  draft: DraftWorkflow;
  /**
   * The editor's draft setter — the SAME one the form body uses.
   * Present = editing gestures on; absent = read-only graph.
   */
  setDraft?: (next: DraftWorkflow) => void;
  /** Currently selected step id (ephemeral UI state owned by the editor). */
  selectedStepId?: string | null;
  /** Click on a node — select + highlight, stay in Graph. */
  onSelectStep?: (stepId: string, declaredIndex: number) => void;
  /** Explicit "Edit step" affordance / double-click — jump to the form. */
  onOpenStep?: (stepId: string) => void;
  /**
   * Active env's run row for the overlay — `pickActiveRun` output.
   * `null` = edit mode with no cache yet; `undefined` = no overlay
   * (create mode — nothing has an entity id, nothing can have run).
   */
  run?: LiveWorkflowRunSnapshot | null;
  /** LVs bound to this workflow — supplies per-exposure publication state. */
  boundVars?: LiveVariable[];
}

function clauseSummary(clause: NonNullable<WorkflowStep['runIf']>['all'][number]): string {
  switch (clause.kind) {
    case 'status':
      return typeof clause.match === 'string'
        ? `${clause.stepId} status is ${clause.match}`
        : clause.match[0] === 'eq'
          ? `${clause.stepId} status is ${clause.match[1]}`
          : clause.match[0] === 'ne'
            ? `${clause.stepId} status is not ${clause.match[1]}`
            : `${clause.stepId} status in [${clause.match[1].join(', ')}]`;
    case 'capture-exists':
      return `${clause.stepId}.${clause.captureName} exists`;
    case 'capture-equals':
      return `${clause.stepId}.${clause.captureName} = "${clause.value}"`;
    case 'capture-matches':
      return `${clause.stepId}.${clause.captureName} matches /${clause.pattern}/`;
  }
}

interface ConnectDrag {
  from: string;
  x: number;
  y: number;
}

const WorkflowGraphBody: React.FC<WorkflowGraphBodyProps> = ({
  draft,
  setDraft,
  selectedStepId,
  onSelectStep,
  onOpenStep,
  run,
  boundVars,
}) => {
  const { token } = theme.useToken();
  const { requests, isReady: requestsReady } = useRequests();
  const editable = setDraft !== undefined;
  const canvasRef = useRef<HTMLDivElement>(null);
  // Rubber-band connect gesture — component-local, never on the draft.
  const [drag, setDrag] = useState<ConnectDrag | null>(null);
  // Edge selection for the remove affordance — graph-only UI state.
  const [selectedEdge, setSelectedEdge] = useState<{ from: string; to: string } | null>(null);

  // Same synthetic-workflow construction the form body uses — the
  // layout helper + validators only inspect cross-reference shape.
  const draftWorkflow = useMemo<LiveWorkflow>(
    () => ({
      schemaVersion: 5,
      version: 1,
      uid: '________',
      path: 'live-workflows/draft',
      name: draft.name,
      description: draft.description.trim() ? draft.description : undefined,
      enabled: draft.enabled,
      steps: draft.steps,
      refresh: draft.refresh,
    }),
    [draft],
  );

  const layout = useMemo(() => buildWorkflowGraphLayout(draftWorkflow), [draftWorkflow]);

  const requestsByUid = useMemo(() => new Map(requests.map((r) => [r.uid, r])), [requests]);

  const knownRequestUids = useMemo(() => new Set(requests.map((r) => r.uid)), [requests]);
  const errorsByStepId = useMemo(() => {
    const all = requestsReady
      ? [...validateWorkflowShape(draftWorkflow), ...validateStepRequestsExist(draftWorkflow, knownRequestUids)]
      : validateWorkflowShape(draftWorkflow);
    const map = new Map<string, string[]>();
    for (const err of all) {
      if (err.stepId === null) continue;
      map.set(err.stepId, [...(map.get(err.stepId) ?? []), err.message]);
    }
    return map;
  }, [draftWorkflow, requestsReady, knownRequestUids]);

  const draftStepsById = useMemo(() => new Map(draft.steps.map((s) => [s.id, s])), [draft.steps]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of layout.nodes) {
      map.set(node.step.id, {
        x: PAD + node.slot * (NODE_W + GAP_X),
        y: PAD + node.layer * (NODE_H + GAP_Y),
      });
    }
    return map;
  }, [layout]);

  const canvasW = PAD * 2 + Math.max(1, layout.maxSlots) * (NODE_W + GAP_X) - GAP_X;
  const canvasH = PAD * 2 + Math.max(1, layout.layerCount) * (NODE_H + GAP_Y) - GAP_Y;

  // Would-be-cycle targets while rubber-banding: dropping `from → t`
  // cycles iff t is a transitive ancestor of `from` (or `from` itself).
  // `reachable` is already on the layout node — the check is free.
  const cycleTargets = useMemo(() => {
    if (!drag) return null;
    const source = layout.nodes.find((n) => n.step.id === drag.from);
    const set = new Set(source?.reachable ?? []);
    set.add(drag.from);
    return set;
  }, [drag, layout]);

  // Selected edge survives only while the layout still has it — an
  // edit that drops the edge drops the selection with it (derived).
  const activeEdge =
    selectedEdge && layout.edges.some((e) => e.from === selectedEdge.from && e.to === selectedEdge.to)
      ? selectedEdge
      : null;

  const canvasPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
  };

  const beginConnect = (stepId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: stepId, ...canvasPoint(e) });
  };

  const moveConnect = (e: React.PointerEvent<HTMLDivElement>) => {
    const point = canvasPoint(e);
    setDrag((d) => (d ? { ...d, ...point } : d));
  };

  const endConnect = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const point = canvasPoint(e);
    setDrag(null);
    if (!setDraft) return;
    const target = layout.nodes.find((n) => {
      const pos = positions.get(n.step.id);
      return (
        pos !== undefined &&
        point.x >= pos.x &&
        point.x <= pos.x + NODE_W &&
        point.y >= pos.y &&
        point.y <= pos.y + NODE_H
      );
    });
    if (!target) return;
    const next = addGraphDependency(draft, drag.from, target.step.id);
    if (next) setDraft(next);
  };

  const removeEdge = (from: string, to: string) => {
    if (!setDraft) return;
    const next = removeGraphDependency(draft, from, to);
    if (next) setDraft(next);
    setSelectedEdge(null);
  };

  const handleAddStep = () => {
    if (!setDraft) return;
    const appended = appendDraftStep(draft);
    setDraft(appended.draft);
    onSelectStep?.(appended.stepId, draft.steps.length);
  };

  const dragSource = drag ? positions.get(drag.from) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {run !== undefined && <GraphRunSummary run={run} refresh={draft.refresh} />}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {editable && (
        <Button
          size="small"
          icon={<PlusOutlined />}
          data-testid="wf-graph-add-step"
          onClick={handleAddStep}
          style={{ position: 'absolute', top: 8, right: 16, zIndex: 3 }}
        >
          Step
        </Button>
      )}
      <div data-testid="wf-graph-pane" style={{ overflow: 'auto', height: '100%' }}>
      <div
        ref={canvasRef}
        style={{ position: 'relative', width: canvasW, height: canvasH }}
        onClick={() => setSelectedEdge(null)}
      >
        <svg
          width={canvasW}
          height={canvasH}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {layout.edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W / 2;
            const y1 = from.y + NODE_H;
            const x2 = to.x + NODE_W / 2;
            const y2 = to.y;
            const bend = Math.max(16, (y2 - y1) / 2);
            const d = `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
            const selected = activeEdge?.from === edge.from && activeEdge?.to === edge.to;
            return (
              <g key={`${edge.from}->${edge.to}`}>
                <path
                  data-testid={`wf-graph-edge-${edge.from}-${edge.to}`}
                  data-selected={selected ? 'true' : undefined}
                  d={d}
                  fill="none"
                  stroke={selected ? token.colorPrimary : token.colorBorder}
                  strokeWidth={selected ? 2 : 1.5}
                />
                {editable && (
                  // Widened transparent twin — the click target. SVG
                  // pointer-events re-enable under a none parent.
                  <path
                    data-testid={`wf-graph-edge-hit-${edge.from}-${edge.to}`}
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdge({ from: edge.from, to: edge.to });
                    }}
                  />
                )}
              </g>
            );
          })}
          {drag && dragSource && (
            <path
              data-testid="wf-graph-rubberband"
              d={`M ${dragSource.x + NODE_W / 2} ${dragSource.y + NODE_H} L ${drag.x} ${drag.y}`}
              fill="none"
              stroke={token.colorPrimary}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
        </svg>
        {layout.nodes.map((node) => {
          const pos = positions.get(node.step.id);
          if (!pos) return null;
          const draftStep = draftStepsById.get(node.step.id);
          const request = node.step.requestUid ? requestsByUid.get(node.step.requestUid) : undefined;
          const errors = errorsByStepId.get(node.step.id) ?? [];
          return (
            <GraphNodeCard
              key={node.step.uid}
              stepId={node.step.id}
              selected={selectedStepId === node.step.id}
              onSelect={onSelectStep ? () => onSelectStep(node.step.id, node.declaredIndex) : undefined}
              onOpen={onOpenStep ? () => onOpenStep(node.step.id) : undefined}
              draftStep={draftStep}
              runIf={node.step.runIf}
              hasPriority={node.step.priorityFrom !== undefined}
              priorityLabel={
                node.step.priorityFrom
                  ? `Ordered by ${node.step.priorityFrom.stepId}.${node.step.priorityFrom.captureName}`
                  : ''
              }
              method={request?.method ?? ''}
              requestName={request?.name ?? ''}
              requestMissing={requestsReady && node.step.requestUid !== '' && request === undefined}
              errors={errors}
              x={pos.x}
              y={pos.y}
              runState={run !== undefined ? classifyStepRun(run, node.step.id) : undefined}
              runErrorMessage={run && run.lastErrorStepId === node.step.id ? run.lastErrorMessage : undefined}
              runCaptures={run ? run.stepCaptures[node.step.id] : undefined}
              runResponseBytes={run ? run.stepResponseBytes[node.step.id] : undefined}
              boundVars={boundVars}
              cycleWarn={cycleTargets?.has(node.step.id) === true}
            />
          );
        })}
        {editable &&
          layout.nodes.map((node) => {
            const pos = positions.get(node.step.id);
            if (!pos) return null;
            return (
              // Connect anchor — always-visible dot on the node's
              // bottom edge; pointer capture keeps the whole drag on
              // this element so the drop hit-tests by coordinates.
              <div
                key={`connect-${node.step.uid}`}
                data-testid={`wf-graph-connect-${node.step.id}`}
                title="Drag to another step to add a dependency"
                onPointerDown={beginConnect(node.step.id)}
                onPointerMove={moveConnect}
                onPointerUp={endConnect}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: pos.x + NODE_W / 2 - 6,
                  top: pos.y + NODE_H - 6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: `2px solid ${token.colorPrimary}`,
                  background: token.colorBgElevated,
                  cursor: 'crosshair',
                  touchAction: 'none',
                  zIndex: 2,
                }}
              />
            );
          })}
        {editable &&
          activeEdge &&
          (() => {
            const from = positions.get(activeEdge.from);
            const to = positions.get(activeEdge.to);
            if (!from || !to) return null;
            // Cubic midpoint with symmetric control offsets = plain
            // endpoint average.
            const mx = (from.x + to.x + NODE_W) / 2;
            const my = (from.y + NODE_H + to.y) / 2;
            return (
              <Tooltip title="Remove dependency">
                <button
                  type="button"
                  data-testid={`wf-graph-edge-remove-${activeEdge.from}-${activeEdge.to}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEdge(activeEdge.from, activeEdge.to);
                  }}
                  style={{
                    position: 'absolute',
                    left: mx - 9,
                    top: my - 9,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `1px solid ${token.colorError}`,
                    background: token.colorBgElevated,
                    color: token.colorError,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 2,
                  }}
                >
                  <CloseOutlined style={{ fontSize: 9 }} />
                </button>
              </Tooltip>
            );
          })()}
      </div>
      </div>
      </div>
    </div>
  );
};

interface GraphNodeCardProps {
  stepId: string;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  /** Draft overlay for the step — supplies capture exposure state. */
  draftStep: DraftStep | undefined;
  runIf: WorkflowStep['runIf'];
  hasPriority: boolean;
  priorityLabel: string;
  method: string;
  requestName: string;
  requestMissing: boolean;
  errors: string[];
  x: number;
  y: number;
  /** Per-step run state — `undefined` when the overlay is off (create mode). */
  runState?: StepRunState;
  /** Failure message when this step is the run's failure point. */
  runErrorMessage?: string;
  /** This step's captured values from the run row. */
  runCaptures?: Record<string, string>;
  /** This step's response byte count from the run row. */
  runResponseBytes?: number;
  /** Bound LVs — publication state per exposed capture (overlay only). */
  boundVars?: LiveVariable[];
  /** Dropping the in-flight connect here would create a cycle. */
  cycleWarn?: boolean;
}

const GraphNodeCard: React.FC<GraphNodeCardProps> = ({
  stepId,
  selected,
  onSelect,
  onOpen,
  draftStep,
  runIf,
  hasPriority,
  priorityLabel,
  method,
  requestName,
  requestMissing,
  errors,
  x,
  y,
  runState,
  runErrorMessage,
  runCaptures,
  runResponseBytes,
  boundVars,
  cycleWarn,
}) => {
  const { token } = theme.useToken();
  const gateClauses = runIf?.all ?? [];
  const captures = draftStep?.captures ?? [];
  const requestLine = requestMissing ? 'Request not found' : requestName || 'No request selected';
  const requestMuted = requestMissing || requestName === '';
  const borderColor = cycleWarn
    ? token.colorWarning
    : errors.length > 0
      ? token.colorErrorBorder
      : selected
        ? token.colorPrimary
        : token.colorBorder;

  return (
    <div
      data-testid={`wf-graph-node-${stepId}`}
      data-selected={selected ? 'true' : undefined}
      data-cycle-target={cycleWarn ? 'true' : undefined}
      onClick={onSelect}
      onDoubleClick={onOpen}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: NODE_W,
        height: NODE_H,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderRadius: token.borderRadius,
        border: `1px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 1px ${token.colorPrimary}` : undefined,
        background: token.colorBgElevated,
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: onSelect ? 'pointer' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {runState !== undefined && (
          <StepRunDot
            stepId={stepId}
            state={runState}
            errorMessage={runErrorMessage}
            captures={runCaptures}
            responseBytes={runResponseBytes}
          />
        )}
        <Text strong ellipsis style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
          {stepId}
        </Text>
        {gateClauses.length > 0 && (
          <Tooltip
            title={
              <div>
                {gateClauses.map((clause) => (
                  <div key={clause.uid} style={{ fontSize: 11 }}>
                    {clauseSummary(clause)}
                  </div>
                ))}
              </div>
            }
          >
            <FilterOutlined
              data-testid={`wf-graph-gate-${stepId}`}
              style={{ fontSize: 11, color: token.colorWarning }}
            />
          </Tooltip>
        )}
        {hasPriority && (
          <Tooltip title={priorityLabel}>
            <SortAscendingOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
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
              style={{ fontSize: 11, color: token.colorError }}
            />
          </Tooltip>
        )}
        {selected && onOpen && (
          <Tooltip title="Edit step in form">
            <EditOutlined
              data-testid={`wf-graph-open-${stepId}`}
              style={{ fontSize: 11, color: token.colorPrimary }}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            />
          </Tooltip>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {method !== '' && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: METHOD_COLORS[method] ?? token.colorText,
              flexShrink: 0,
            }}
          >
            {method}
          </span>
        )}
        <Text type={requestMuted ? 'secondary' : undefined} ellipsis style={{ fontSize: 11, minWidth: 0 }}>
          {requestLine}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
        {captures.length === 0 && (
          <Text type="secondary" style={{ fontSize: 10, fontStyle: 'italic' }}>
            No captures
          </Text>
        )}
        {captures.map((capture) => {
          // Publication split (PLAN §2.4): Save activates the WORKFLOW;
          // a successful RUN publishes the exposed VARS. An exposed
          // capture whose LV is still `published: false` is pending its
          // first run — never presented as live. Derived here at render
          // time from the bound LV; only meaningful when the overlay is
          // on (boundVars provided — edit mode).
          const lv =
            capture.exposed && boundVars
              ? (boundVars.find((v) => v.uid === capture.liveUid) ??
                boundVars.find((v) => v.stepId === stepId && v.captureName === capture.name))
              : undefined;
          const publicationKnown = capture.exposed && boundVars !== undefined;
          const pending = publicationKnown && lv?.published !== true;
          const exposedTitle = pending
            ? `Exposed as {{live.${capture.liveName}}} — pending first run`
            : `Exposed as {{live.${capture.liveName}}}`;
          return (
            <span
              key={capture.uid}
              data-lv-published={publicationKnown ? String(!pending) : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                lineHeight: '16px',
                padding: '0 6px',
                borderRadius: 8,
                border: `1px solid ${token.colorBorderSecondary}`,
                color: capture.exposed ? token.colorText : token.colorTextSecondary,
                background: capture.exposed ? token.colorFillTertiary : 'transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={capture.exposed ? exposedTitle : capture.name}
            >
              {capture.exposed && (
                <ThunderboltFilled
                  style={{ fontSize: 9, color: pending ? token.colorTextTertiary : token.colorWarning }}
                />
              )}
              {capture.exposed ? capture.liveName : capture.name}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowGraphBody;
