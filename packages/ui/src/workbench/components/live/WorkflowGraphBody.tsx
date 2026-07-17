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
 * captured-values popover, and exposed capture chips carry the LV's
 * publication state (Save activates the workflow; a successful RUN is
 * what publishes the vars — pending until then). The whole-run summary
 * lives on the editor's bottom `WorkflowRunStatusStrip`, shared with
 * the form view. Read-only and environment-scoped by construction: it
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
 *
 * Canvas chrome: a pan/zoom viewport (drag the background to pan,
 * wheel/pinch to zoom around the cursor, bottom-left controls with a
 * re-center/fit action — the dotted grid rides the transform), edges
 * carry direction arrowheads, a compact right-click context menu on
 * the background (add step) and on nodes (edit / delete), keyboard
 * shortcuts on the focused pane (⏎ edit, ⌫ delete node or selected
 * edge, Esc dismiss), and a pointer-transparent legend pinned
 * bottom-right naming all of them. Delete mirrors the form's remove
 * button via `removeDraftStep` — last step stays, dangling references
 * badge.
 */

import {
  AimOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  SortAscendingOutlined,
  ThunderboltFilled,
  WarningOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { DraftStep, DraftWorkflow } from '@openheaders/core/live';
import { validateStepRequestsExist, validateWorkflowShape } from '@openheaders/core/live';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { LiveVariable, LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { Button, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { METHOD_COLORS } from '../sidebar/icons';
import { addGraphDependency, appendDraftStep, removeDraftStep, removeGraphDependency } from './graph-edit';
import { buildWorkflowGraphLayout } from './graph-layout';
import { classifyStepRun, type StepRunState } from './live-display';
import { StepRunDot } from './WorkflowGraphRunOverlay';

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

function clauseSummary(clause: NonNullable<WorkflowStep['runIf']>['all'][number], t: Translate): string {
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

interface ConnectDrag {
  from: string;
  x: number;
  y: number;
}

/** Right-click context menu — pane-relative position + target (the
 *  pane never transforms, so the menu doesn't scale with the zoom). */
type GraphMenu = { x: number; y: number } & ({ kind: 'canvas' } | { kind: 'node'; stepId: string });

/** Pan/zoom viewport — translate-then-scale, origin top-left. */
interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const FIT_PAD = 32;
const GRID_STEP = 16;

const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/**
 * Interactive graph elements the background pan must never claim.
 * Marked with dedicated runtime attributes — test ids are stripped
 * from release builds, so behavior can never key off them.
 */
const PAN_EXCLUDE_SELECTOR = '[data-graph-interactive], button';

/**
 * Clickable node children the card drag must never claim. Pointer
 * capture retargets the derived `click` to the capturing card, so a
 * press starting on the run dot or the edit pencil would silently
 * eat their click handlers if the drag captured it.
 */
const NODE_DRAG_EXCLUDE_SELECTOR = '[data-graph-node-action]';

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
  const t = useT();
  const { requests, isReady: requestsReady } = useRequests();
  const editable = setDraft !== undefined;
  const paneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Rubber-band connect gesture — component-local, never on the draft.
  const [drag, setDrag] = useState<ConnectDrag | null>(null);
  // Edge selection for the remove affordance — graph-only UI state.
  const [selectedEdge, setSelectedEdge] = useState<{ from: string; to: string } | null>(null);
  // Right-click context menu — graph-only UI state, pane coordinates.
  const [menu, setMenu] = useState<GraphMenu | null>(null);
  // Pan/zoom viewport — graph-only UI state, never on the draft.
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  // Background pan gesture; `moved` suppresses the click-through that
  // would otherwise clear the selection after every pan.
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const panMovedRef = useRef(false);
  const [panning, setPanning] = useState(false);
  // Node drag — ephemeral per-step offsets layered over the auto
  // layout. Pure view state (never on the draft); re-center clears it.
  const [nodeOffsets, setNodeOffsets] = useState<Map<string, { x: number; y: number }>>(new Map());
  const nodeDragRef = useRef<{
    stepId: string;
    pointerId: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);

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
      const offset = nodeOffsets.get(node.step.id);
      map.set(node.step.id, {
        x: PAD + node.slot * (NODE_W + GAP_X) + (offset?.x ?? 0),
        y: PAD + node.layer * (NODE_H + GAP_Y) + (offset?.y ?? 0),
      });
    }
    return map;
  }, [layout, nodeOffsets]);

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

  // Canvas coordinates (layout space). The canvas rect is already
  // transformed, so the offset only needs dividing by the zoom.
  const canvasPoint = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left) / viewport.scale, y: (e.clientY - rect.top) / viewport.scale };
  };

  // Pane coordinates (untransformed) — context menu + overlays.
  const panePoint = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = paneRef.current?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
  };

  // Wheel = zoom around the cursor. Native non-passive listener —
  // React's synthetic wheel handlers can't preventDefault reliably.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = pane.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setViewport((v) => {
        const scale = clampScale(v.scale * Math.exp(-e.deltaY * 0.0015));
        const k = scale / v.scale;
        return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    };
    pane.addEventListener('wheel', onWheel, { passive: false });
    return () => pane.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const pane = paneRef.current;
    const rect = pane?.getBoundingClientRect();
    const px = rect ? rect.width / 2 : 0;
    const py = rect ? rect.height / 2 : 0;
    setViewport((v) => {
      const scale = clampScale(v.scale * factor);
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  // Fit-and-center the whole graph in the pane (the re-focus action).
  // Also clears manual node offsets — re-center doubles as "tidy up".
  const fitView = () => {
    setNodeOffsets(new Map());
    const rect = paneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = clampScale(Math.min((rect.width - FIT_PAD) / canvasW, (rect.height - FIT_PAD) / canvasH, 1));
    setViewport({ scale, x: (rect.width - canvasW * scale) / 2, y: (rect.height - canvasH * scale) / 2 });
  };

  // Node drag — pointer capture stays on the card; deltas convert to
  // canvas units through the zoom so the node tracks the cursor 1:1.
  const beginNodeDrag = (stepId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest(NODE_DRAG_EXCLUDE_SELECTOR)) return;
    const offset = nodeOffsets.get(stepId);
    nodeDragRef.current = {
      stepId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      ox: offset?.x ?? 0,
      oy: offset?.y ?? 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveNodeDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const nodeDrag = nodeDragRef.current;
    if (!nodeDrag || nodeDrag.pointerId !== e.pointerId) return;
    const dx = (e.clientX - nodeDrag.startX) / viewport.scale;
    const dy = (e.clientY - nodeDrag.startY) / viewport.scale;
    setNodeOffsets((prev) => {
      const next = new Map(prev);
      next.set(nodeDrag.stepId, { x: nodeDrag.ox + dx, y: nodeDrag.oy + dy });
      return next;
    });
  };

  const endNodeDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current?.pointerId === e.pointerId) nodeDragRef.current = null;
  };

  const beginPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest(PAN_EXCLUDE_SELECTOR)) return;
    panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, ox: viewport.x, oy: viewport.y };
    panMovedRef.current = false;
    setPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const movePan = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) panMovedRef.current = true;
    setViewport((v) => ({ ...v, x: pan.ox + dx, y: pan.oy + dy }));
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== e.pointerId) return;
    panRef.current = null;
    setPanning(false);
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

  const handleDeleteStep = (stepId: string) => {
    if (!setDraft) return;
    const next = removeDraftStep(draft, stepId);
    if (next) setDraft(next);
    setMenu(null);
  };

  // Pane-scoped shortcuts — the wrapper is focusable (pointer-down
  // focuses it), so these never fire while a form field has focus.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setMenu(null);
      setSelectedEdge(null);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!editable) return;
      if (activeEdge) {
        e.preventDefault();
        removeEdge(activeEdge.from, activeEdge.to);
        return;
      }
      if (selectedStepId) {
        e.preventDefault();
        handleDeleteStep(selectedStepId);
      }
      return;
    }
    if (e.key === 'Enter' && selectedStepId && onOpenStep) {
      e.preventDefault();
      onOpenStep(selectedStepId);
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable) return;
    e.preventDefault();
    setSelectedEdge(null);
    setMenu({ ...panePoint(e), kind: 'canvas' });
  };

  const handleNodeContextMenu = (node: { stepId: string; declaredIndex: number }) => (e: React.MouseEvent) => {
    if (!editable && !onOpenStep) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectStep?.(node.stepId, node.declaredIndex);
    setMenu({ ...panePoint(e), kind: 'node', stepId: node.stepId });
  };

  const menuActions: GraphMenuAction[] =
    menu === null
      ? []
      : menu.kind === 'canvas'
        ? [
            {
              key: 'add-step',
              icon: <PlusOutlined />,
              text: t('workbench.editors.live.graph.menuAddStep'),
              onClick: handleAddStep,
            },
          ]
        : [
            ...(onOpenStep
              ? [
                  {
                    key: 'edit-step',
                    icon: <EditOutlined />,
                    text: t('workbench.editors.live.graph.menuEditStep'),
                    kbd: '⏎',
                    onClick: () => onOpenStep(menu.stepId),
                  },
                ]
              : []),
            ...(editable
              ? [
                  {
                    key: 'delete-step',
                    icon: <DeleteOutlined />,
                    text: t('workbench.editors.live.graph.menuDeleteStep'),
                    kbd: '⌫',
                    danger: true,
                    disabled: draft.steps.length <= 1,
                    onClick: () => handleDeleteStep(menu.stepId),
                  },
                ]
              : []),
          ];

  const dragSource = drag ? positions.get(drag.from) : undefined;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => e.currentTarget.focus({ preventScroll: true })}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {editable && (
        <Button
          size="small"
          icon={<PlusOutlined />}
          data-testid="wf-graph-add-step"
          onClick={handleAddStep}
          style={{ position: 'absolute', top: 8, right: 16, zIndex: 3 }}
        >
          {t('workbench.editors.live.form.addStepButton')}
        </Button>
      )}
      <GraphLegend editable={editable} canOpen={onOpenStep !== undefined} />
      <GraphViewControls onZoomIn={() => zoomBy(1.2)} onZoomOut={() => zoomBy(1 / 1.2)} onFit={fitView} />
      {/* Viewport: the pane never moves (dots ride backgroundPosition so
          the grid pans/zooms with the content); the canvas carries the
          translate+scale transform. Background drag pans, wheel zooms. */}
      <div
        ref={paneRef}
        data-testid="wf-graph-pane"
        style={{
          overflow: 'hidden',
          height: '100%',
          position: 'relative',
          backgroundImage: `radial-gradient(circle, ${token.colorBorderSecondary} 1px, transparent 1px)`,
          backgroundSize: `${GRID_STEP * viewport.scale}px ${GRID_STEP * viewport.scale}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          cursor: panning ? 'grabbing' : undefined,
          userSelect: 'none',
        }}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onClick={() => {
          if (panMovedRef.current) {
            panMovedRef.current = false;
            return;
          }
          setSelectedEdge(null);
          setMenu(null);
        }}
        onContextMenu={handleCanvasContextMenu}
      >
      <div
        ref={canvasRef}
        style={{
          position: 'relative',
          width: canvasW,
          height: canvasH,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          width={canvasW}
          height={canvasH}
          // overflow visible: dragged nodes can sit outside the layout
          // bounds, and a clipping svg would swallow their edges.
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          aria-hidden="true"
        >
          {/* Direction arrowheads — dependsOn edges run parent → child. */}
          <defs>
            <marker
              id="wf-graph-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill={token.colorBorder} />
            </marker>
            <marker
              id="wf-graph-arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill={token.colorPrimary} />
            </marker>
          </defs>
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
            // Selecting a node lights its outgoing arrows too, so the
            // direction of its dependents reads at a glance.
            const highlight = selected || edge.from === selectedStepId;
            return (
              <g key={`${edge.from}->${edge.to}`}>
                <path
                  data-testid={`wf-graph-edge-${edge.from}-${edge.to}`}
                  data-graph-interactive=""
                  data-selected={selected ? 'true' : undefined}
                  data-highlight={highlight ? 'true' : undefined}
                  d={d}
                  fill="none"
                  stroke={highlight ? token.colorPrimary : token.colorBorder}
                  strokeWidth={selected ? 2 : 1.5}
                  markerEnd={`url(#wf-graph-arrow${highlight ? '-active' : ''})`}
                />
                {editable && (
                  // Widened transparent twin — the click target. SVG
                  // pointer-events re-enable under a none parent.
                  <path
                    data-testid={`wf-graph-edge-hit-${edge.from}-${edge.to}`}
                    data-graph-interactive=""
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
              markerEnd="url(#wf-graph-arrow-active)"
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
              onContextMenu={handleNodeContextMenu({ stepId: node.step.id, declaredIndex: node.declaredIndex })}
              onDragDown={beginNodeDrag(node.step.id)}
              onDragMove={moveNodeDrag}
              onDragUp={endNodeDrag}
              draftStep={draftStep}
              runIf={node.step.runIf}
              hasPriority={node.step.priorityFrom !== undefined}
              priorityLabel={
                node.step.priorityFrom
                  ? t('workbench.editors.live.graph.orderedBy', {
                      ref: `${node.step.priorityFrom.stepId}.${node.step.priorityFrom.captureName}`,
                    })
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
                data-graph-interactive=""
                title={t('workbench.editors.live.graph.connectTitle')}
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
              <Tooltip title={t('workbench.editors.live.graph.removeDependency')}>
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
      {menu !== null && menuActions.length > 0 && (
        <div
          data-testid="wf-graph-context-menu"
          data-graph-interactive=""
          style={{
            position: 'absolute',
            left: menu.x,
            top: menu.y,
            zIndex: 5,
            minWidth: 148,
            background: token.colorBgElevated,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            boxShadow: token.boxShadowSecondary,
            padding: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menuActions.map((action) => (
            <GraphMenuRow
              key={action.key}
              action={action}
              onDone={() => {
                setMenu(null);
                action.onClick();
              }}
            />
          ))}
        </div>
      )}
      </div>
      </div>
    </div>
  );
};

interface GraphMenuAction {
  key: string;
  icon: React.ReactNode;
  text: string;
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Compact context-menu row — icon, action text, shortcut hint. */
const GraphMenuRow: React.FC<{ action: GraphMenuAction; onDone: () => void }> = ({ action, onDone }) => {
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const color = action.disabled ? token.colorTextQuaternary : action.danger ? token.colorError : token.colorText;
  return (
    <button
      type="button"
      data-testid={`wf-graph-menu-${action.key}`}
      disabled={action.disabled}
      onClick={onDone}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '3px 8px',
        border: 'none',
        borderRadius: 4,
        background: hover && !action.disabled ? token.colorFillTertiary : 'transparent',
        color,
        fontSize: 12,
        lineHeight: '20px',
        textAlign: 'left',
        cursor: action.disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', fontSize: 12 }}>{action.icon}</span>
      <span style={{ flex: 1 }}>{action.text}</span>
      {action.kbd !== undefined && (
        <span style={{ fontSize: 11, color: token.colorTextQuaternary }}>{action.kbd}</span>
      )}
    </button>
  );
};

/** Zoom in / zoom out / fit-and-center controls, pinned bottom-left. */
const GraphViewControls: React.FC<{ onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }> = ({
  onZoomIn,
  onZoomOut,
  onFit,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        left: 16,
        zIndex: 3,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowTertiary,
        overflow: 'hidden',
      }}
    >
      <Tooltip title={t('workbench.editors.live.graph.zoomIn')} placement="right">
        <Button type="text" size="small" data-testid="wf-graph-zoom-in" icon={<ZoomInOutlined />} onClick={onZoomIn} />
      </Tooltip>
      <Tooltip title={t('workbench.editors.live.graph.zoomOut')} placement="right">
        <Button
          type="text"
          size="small"
          data-testid="wf-graph-zoom-out"
          icon={<ZoomOutOutlined />}
          onClick={onZoomOut}
        />
      </Tooltip>
      <Tooltip title={t('workbench.editors.live.graph.recenter')} placement="right">
        <Button type="text" size="small" data-testid="wf-graph-fit" icon={<AimOutlined />} onClick={onFit} />
      </Tooltip>
    </div>
  );
};

/**
 * Pointer-transparent shortcut legend pinned to the pane's bottom-right
 * corner — names every canvas gesture so nothing is discover-by-luck.
 */
const GraphLegend: React.FC<{ editable: boolean; canOpen: boolean }> = ({ editable, canOpen }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Word-bearing gesture chips are keyed; the lone ⌫ glyph stays raw
  // (key caps/glyphs raw — standing rule).
  const entries: { keys: string; action: string }[] = [
    { keys: t('workbench.editors.live.graph.legendClick'), action: t('workbench.editors.live.graph.legendSelect') },
    ...(canOpen
      ? [{ keys: t('workbench.editors.live.graph.legendEditKeys'), action: t('workbench.editors.live.graph.legendEdit') }]
      : []),
    ...(editable
      ? [
          { keys: '⌫', action: t('workbench.editors.live.graph.legendDelete') },
          {
            keys: t('workbench.editors.live.graph.legendConnectKeys'),
            action: t('workbench.editors.live.graph.legendConnect'),
          },
          {
            keys: t('workbench.editors.live.graph.legendRightClick'),
            action: t('workbench.editors.live.graph.legendMenu'),
          },
        ]
      : []),
    { keys: t('workbench.editors.live.graph.legendDragNode'), action: t('workbench.editors.live.graph.legendMove') },
    { keys: t('workbench.editors.live.graph.legendDragBg'), action: t('workbench.editors.live.graph.legendPan') },
    { keys: t('workbench.editors.live.graph.legendScroll'), action: t('workbench.editors.live.graph.legendZoom') },
  ];
  return (
    <div
      data-testid="wf-graph-legend"
      style={{
        position: 'absolute',
        bottom: 10,
        right: 16,
        zIndex: 3,
        pointerEvents: 'none',
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        columnGap: 12,
        rowGap: 3,
        padding: '6px 10px',
        borderRadius: 6,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadowTertiary,
        opacity: 0.9,
        fontSize: 10,
        color: token.colorTextTertiary,
        whiteSpace: 'nowrap',
      }}
    >
      {entries.map((entry) => (
        <span key={entry.action} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              padding: '0 4px',
              borderRadius: 3,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillTertiary,
              fontFamily: "'SF Mono', monospace",
              fontSize: 9,
              lineHeight: '14px',
            }}
          >
            {entry.keys}
          </span>
          {entry.action}
        </span>
      ))}
    </div>
  );
};

interface GraphNodeCardProps {
  stepId: string;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  /** Right-click — selects the node and opens the compact context menu. */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Drag-to-move handlers — ephemeral layout offsets owned by the body. */
  onDragDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
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
  onContextMenu,
  onDragDown,
  onDragMove,
  onDragUp,
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
  const t = useT();
  const gateClauses = runIf?.all ?? [];
  const captures = draftStep?.captures ?? [];
  const requestLine = requestMissing
    ? t('workbench.editors.live.graph.requestNotFound')
    : requestName || t('workbench.editors.live.graph.noRequestSelected');
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
      data-graph-interactive=""
      data-selected={selected ? 'true' : undefined}
      data-cycle-target={cycleWarn ? 'true' : undefined}
      onClick={onSelect}
      onDoubleClick={onOpen}
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
        width: NODE_W,
        touchAction: 'none',
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
                    {clauseSummary(clause, t)}
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
          <Tooltip title={t('workbench.editors.live.graph.editStepInForm')}>
            <EditOutlined
              data-testid={`wf-graph-open-${stepId}`}
              data-graph-node-action=""
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
            {t('workbench.editors.live.graph.noCaptures')}
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
            ? t('workbench.editors.live.graph.exposedAsPending', { name: capture.liveName })
            : t('workbench.editors.live.graph.exposedAs', { name: capture.liveName });
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
