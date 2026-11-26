/**
 * WorkflowGraphBody — the graph of a workflow draft, the left half of
 * the workflow's one view (the workflow-graph plan; the workflows
 * redesign).
 *
 * A pure projection of the same `DraftWorkflow` the form edits: one
 * node per step (`WorkflowGraphNode`), one edge per resolved
 * `dependsOn` parent. Layout comes from `buildWorkflowGraphLayout` —
 * layers top-down, declared order across each layer; nodes are
 * fixed-size so edge anchors stay deterministic. A session step's node
 * says its kind and what it acts on, and names as text what arms it —
 * the listen it is on, the step it waits after — with no edge of a kind
 * of its own.
 *
 * Selection: a click selects a node, and the view's panel shows that
 * step; a click on the empty canvas deselects. Selection is ephemeral UI
 * state owned by `LiveWorkflowEditor` — it never touches the draft. A
 * step selected from elsewhere is brought into view.
 *
 * Run marks: every node wears its step's mark (`step-mark.ts`). While
 * the page keeps a run of the workflow (`run`) a mark is that run's own
 * row, live as the run goes; with none kept it is what the active
 * environment's cache row (`cacheRun`) says of the last run. The values
 * a step captured come from the cache row alone, masked until asked
 * for; an exposed capture carries its variable's publication state
 * (Save activates the workflow; a successful RUN is what publishes the
 * vars — pending until then).
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
 * wheel/pinch to zoom around the cursor, a row of controls bottom-left
 * with a re-center/fit action), edges carry direction arrowheads, a
 * compact right-click context menu on the background (add step) and on
 * nodes (delete), keyboard shortcuts on the focused pane (⌫ delete node
 * or selected edge, Esc dismiss), and a legend behind a button
 * bottom-right naming all of them — the graph may be a short strip over
 * its panel, so nothing sits open on it. The first view centres the
 * graph, drawn smaller where it is wider than the pane. Delete mirrors
 * the form's remove button via `removeDraftStep` — last step stays,
 * dangling references badge.
 */

import {
  AimOutlined,
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { DraftCapture, DraftStep, DraftWorkflow } from '@openheaders/core/live';
import {
  isExpectStep,
  isKnownStep,
  isListenStep,
  isSendStep,
  isSessionStep,
  isUnknownStep,
  toDraftCapture,
  validateSessionRequests,
  validateSessionSteps,
  validateStepRequestsExist,
  validateWorkflowShape,
} from '@openheaders/core/live';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type {
  LiveVariable,
  LiveWorkflow,
  MqttRequest,
  SessionWorkflowStep,
  WorkflowStep,
} from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { Button, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RequestKind } from '../../request-kind-menu';
import { addGraphDependency, appendDraftStep, removeDraftStep, removeGraphDependency } from './graph-edit';
import { buildWorkflowGraphLayout } from './graph-layout';
import { type RunStepAction, sessionOfRow } from './run-display';
import { sessionRequestOf } from './step-action';
import { idleMark, markOfCacheRow, markOfRunRow, type StepMark } from './step-mark';
import { useWaitClock } from './use-wait-clock';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowGraphNode, { GRAPH_NODE_H, GRAPH_NODE_W, type GraphNodeDoes } from './WorkflowGraphNode';

const NODE_W = GRAPH_NODE_W;
const NODE_H = GRAPH_NODE_H;
const GAP_X = 24;
const GAP_Y = 80;
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
  /** A press on a node, or a step the graph just added — select it, by uid. */
  onSelectStep?: (stepUid: string) => void;
  /** A click on the empty canvas. */
  onDeselect?: () => void;
  /** The run the page keeps of this workflow — a node's mark is its row while there is one. */
  run?: ShownWorkflowRun | null;
  /**
   * The active environment's cache row — `pickActiveRun` output. It
   * marks the nodes while no run is kept, and holds the values a step
   * captured. `null` = no cache yet; `undefined` = a draft never saved.
   */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  /** LVs bound to this workflow — supplies per-exposure publication state. */
  boundVars?: LiveVariable[];
}

/** A step's kind on its node, in the design's words: an `expect` is a Wait. */
const STEP_KIND_WORD: Record<RunStepAction, MessageKey> = {
  call: 'workbench.editors.live.run.action.call',
  listen: 'workbench.editors.live.run.action.listen',
  send: 'workbench.editors.live.run.action.send',
  expect: 'workbench.editors.live.graph.kindWait',
};

/** What a session step acts on, by name: the request a listen opens, the message a send sends, where an expect's message lands. */
function sessionTargetOf(
  step: SessionWorkflowStep,
  steps: readonly DraftStep[],
  mqttRequests: readonly MqttRequest[],
): string {
  if (isListenStep(step)) return mqttRequests.find((request) => request.uid === step.sessionRequestUid)?.name ?? '';
  if (isSendStep(step)) {
    const saved = sessionRequestOf(steps, step.on, mqttRequests)?.savedMessages;
    return saved?.find((message) => message.uid === step.messageUid)?.name ?? '';
  }
  return step.address ?? '';
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
/** The first view never draws the graph smaller than this to fit its width — a node must stay readable. */
const FIRST_VIEW_MIN_SCALE = 0.5;
/** What a step brought into view keeps between itself and the pane's edge. */
const REVEAL_MARGIN = 16;

const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** How far a span must move along an axis to sit inside it, its start winning where it cannot fit whole. */
function shiftInto(start: number, end: number, size: number): number {
  if (start < REVEAL_MARGIN) return REVEAL_MARGIN - start;
  if (end > size - REVEAL_MARGIN) return Math.max(REVEAL_MARGIN - start, size - REVEAL_MARGIN - end);
  return 0;
}

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
  onDeselect,
  run,
  cacheRun,
  boundVars,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { requests, graphqlRequests, mqttRequests, isReady: requestsReady } = useRequests();
  const now = useWaitClock(run?.record ?? null);
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
  const graphqlByUid = useMemo(() => new Map(graphqlRequests.map((r) => [r.uid, r])), [graphqlRequests]);

  const knownRequestUids = useMemo(
    () => new Set([...requests.map((r) => r.uid), ...graphqlRequests.map((r) => r.uid)]),
    [requests, graphqlRequests],
  );
  const errorsByStepId = useMemo(() => {
    const shape = [...validateWorkflowShape(draftWorkflow), ...validateSessionSteps(draftWorkflow)];
    const all = requestsReady
      ? [
          ...shape,
          ...validateStepRequestsExist(draftWorkflow, knownRequestUids),
          ...validateSessionRequests(
            draftWorkflow,
            (uid) => mqttRequests.find((request) => request.uid === uid) ?? null,
          ),
        ]
      : shape;
    const map = new Map<string, string[]>();
    for (const err of all) {
      // A step of an action the model does not know says so on its own card.
      if (err.stepId === null || err.issue === 'step-needs-update') continue;
      map.set(err.stepId, [...(map.get(err.stepId) ?? []), err.message]);
    }
    return map;
  }, [draftWorkflow, requestsReady, knownRequestUids, mqttRequests]);

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

  // The first view, once the pane has a size (a tab mounted hidden has
  // none yet): the graph centred, drawn smaller where it is wider than
  // the pane. After that the view is the user's.
  const canvasWidthRef = useRef(canvasW);
  canvasWidthRef.current = canvasW;
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(() => {
      const { width } = pane.getBoundingClientRect();
      if (width === 0) return;
      observer.disconnect();
      const content = canvasWidthRef.current;
      const scale = Math.min(1, Math.max(FIRST_VIEW_MIN_SCALE, width / content));
      setViewport({ scale, x: Math.max(0, (width - content * scale) / 2), y: 0 });
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  // A step selected from elsewhere — a row of the panel — is brought
  // into view by the shortest pan; one already in view stays put.
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  useEffect(() => {
    const rect = paneRef.current?.getBoundingClientRect();
    const pos = selectedStepId == null ? undefined : positionsRef.current.get(selectedStepId);
    if (!rect || rect.width === 0 || !pos) return;
    setViewport((v) => {
      const left = v.x + pos.x * v.scale;
      const top = v.y + pos.y * v.scale;
      const dx = shiftInto(left, left + NODE_W * v.scale, rect.width);
      const dy = shiftInto(top, top + NODE_H * v.scale, rect.height);
      return dx === 0 && dy === 0 ? v : { ...v, x: v.x + dx, y: v.y + dy };
    });
  }, [selectedStepId]);

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
    const added = appended.draft.steps.at(-1);
    if (added !== undefined) onSelectStep?.(added.uid);
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
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable) return;
    e.preventDefault();
    setSelectedEdge(null);
    setMenu({ ...panePoint(e), kind: 'canvas' });
  };

  const handleNodeContextMenu = (node: { stepId: string; stepUid: string }) => (e: React.MouseEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectStep?.(node.stepUid);
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
            {
              key: 'delete-step',
              icon: <DeleteOutlined />,
              text: t('workbench.editors.live.graph.menuDeleteStep'),
              kbd: '⌫',
              danger: true,
              disabled: draft.steps.length <= 1,
              onClick: () => handleDeleteStep(menu.stepId),
            },
          ];

  // ── What a node says of its step ───────────────────────────────────

  /** The kind of request a step speaks: a call's own request, a session step's listen. */
  const protocolOf = (step: WorkflowStep): RequestKind | null => {
    if (isSessionStep(step)) {
      const listenId = isListenStep(step) ? step.id : step.on;
      return sessionRequestOf(draft.steps, listenId, mqttRequests) !== undefined ? 'mqtt' : null;
    }
    if (isUnknownStep(step)) return null;
    if (requestsByUid.has(step.requestUid)) return 'http';
    return graphqlByUid.has(step.requestUid) ? 'graphql' : null;
  };

  const doesOf = (step: WorkflowStep): GraphNodeDoes => {
    if (isSessionStep(step)) {
      return { text: sessionTargetOf(step, draft.steps, mqttRequests), mono: isExpectStep(step) };
    }
    if (isUnknownStep(step)) return { text: t('workbench.editors.live.step.needsUpdate'), muted: true };
    const http = requestsByUid.get(step.requestUid);
    if (http !== undefined) return { lead: http.method, text: http.name };
    const graphql = graphqlByUid.get(step.requestUid);
    if (graphql !== undefined) return { text: graphql.name };
    return {
      text:
        requestsReady && step.requestUid !== ''
          ? t('workbench.editors.live.graph.requestNotFound')
          : t('workbench.editors.live.graph.noRequestSelected'),
      muted: true,
    };
  };

  /** What arms a session step, as text: the listen it is on, the step it waits after. */
  const armedByOf = (step: SessionWorkflowStep): string =>
    [
      ...(!isListenStep(step) && step.on ? [`${t('workbench.editors.live.step.onPrefix')} ${step.on}`] : []),
      ...(isExpectStep(step) && step.after ? [`${t('workbench.editors.live.step.afterPrefix')} ${step.after}`] : []),
    ].join(' · ');

  /** The steps that act on a listen's session. */
  const usersOf = (listenId: string): string[] =>
    draft.steps
      .filter((each) => isSessionStep(each) && !isListenStep(each) && each.on === listenId)
      .map((each) => each.id);

  // A session step's captures carry no exposure: they read as a call's
  // unexposed ones do.
  const capturesOf = (step: DraftStep | undefined): DraftCapture[] =>
    step === undefined || !isKnownStep(step)
      ? []
      : isSessionStep(step)
        ? step.captures.map((capture) => toDraftCapture(capture, null))
        : step.captures;

  const markOf = (stepId: string, stepUid: string, action: RunStepAction | undefined): StepMark => {
    if (run == null) return markOfCacheRow(cacheRun, stepId, t);
    const row = run.record.steps.find((each) => each.uid === stepUid);
    if (row === undefined) return idleMark(t);
    const session = sessionOfRow(row, run.record);
    return markOfRunRow(row, t, {
      now,
      ...(action !== undefined ? { action } : {}),
      ...(session !== undefined ? { session } : {}),
    });
  };

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
          style={{ position: 'absolute', top: 8, right: 12, zIndex: 3 }}
        >
          {t('workbench.editors.live.form.addStepButton')}
        </Button>
      )}
      <GraphLegend editable={editable} />
      <GraphViewControls onZoomIn={() => zoomBy(1.2)} onZoomOut={() => zoomBy(1 / 1.2)} onFit={fitView} />
      {/* Viewport: the pane never moves and never scrolls — `clip`, not
          `hidden`, which a scroll-into-view still scrolls; the canvas
          carries the translate+scale transform. Background drag pans,
          wheel zooms. */}
      <div
        ref={paneRef}
        data-testid="wf-graph-pane"
        style={{
          overflow: 'clip',
          height: '100%',
          position: 'relative',
          background: 'var(--oh-wf-bg)',
          cursor: panning ? 'grabbing' : undefined,
          userSelect: 'none',
        }}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onClick={(e) => {
          if (panMovedRef.current) {
            panMovedRef.current = false;
            return;
          }
          setSelectedEdge(null);
          setMenu(null);
          // A click that lands on a node or a control is that element's own.
          if (!(e.target as Element).closest(PAN_EXCLUDE_SELECTOR)) onDeselect?.();
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
          const { step } = node;
          const call = isUnknownStep(step) ? undefined : step;
          const session = isSessionStep(step) ? step : undefined;
          const shared = call ?? session;
          const action: RunStepAction | undefined = session?.action ?? (call !== undefined ? 'call' : undefined);
          return (
            <WorkflowGraphNode
              key={step.uid}
              stepId={step.id}
              x={pos.x}
              y={pos.y}
              selected={selectedStepId === step.id}
              onSelect={onSelectStep ? () => onSelectStep(step.uid) : undefined}
              onContextMenu={handleNodeContextMenu({ stepId: step.id, stepUid: step.uid })}
              onDragDown={beginNodeDrag(step.id)}
              onDragMove={moveNodeDrag}
              onDragUp={endNodeDrag}
              protocol={protocolOf(step)}
              kind={action !== undefined ? t(STEP_KIND_WORD[action]) : ''}
              does={doesOf(step)}
              unknownAction={isKnownStep(step) ? undefined : step.action}
              armedBy={session !== undefined ? armedByOf(session) : ''}
              usedBy={session !== undefined && isListenStep(session) ? usersOf(session.id) : []}
              captures={capturesOf(draftStepsById.get(step.id))}
              boundVars={boundVars}
              mark={markOf(step.id, step.uid, action)}
              runCaptures={cacheRun?.stepCaptures[step.id]}
              runResponseBytes={cacheRun?.stepResponseBytes[step.id]}
              gateClauses={shared?.runIf?.all ?? []}
              priorityLabel={
                shared?.priorityFrom
                  ? t('workbench.editors.live.graph.orderedBy', {
                      ref: `${shared.priorityFrom.stepId}.${shared.priorityFrom.captureName}`,
                    })
                  : ''
              }
              errors={errorsByStepId.get(step.id) ?? []}
              cycleWarn={cycleTargets?.has(step.id) === true}
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

/** A group of the pane's own controls, pinned to one of its bottom corners. */
const GraphControlGroup: React.FC<{ corner: 'left' | 'right'; children: React.ReactNode }> = ({ corner, children }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        ...(corner === 'left' ? { left: 12 } : { right: 12 }),
        zIndex: 3,
        display: 'flex',
        borderRadius: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowTertiary,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

/** Zoom in / zoom out / fit-and-center controls, one row pinned bottom-left. */
const GraphViewControls: React.FC<{ onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }> = ({
  onZoomIn,
  onZoomOut,
  onFit,
}) => {
  const t = useT();
  return (
    <GraphControlGroup corner="left">
      <Tooltip title={t('workbench.editors.live.graph.zoomIn')}>
        <Button type="text" size="small" data-testid="wf-graph-zoom-in" icon={<ZoomInOutlined />} onClick={onZoomIn} />
      </Tooltip>
      <Tooltip title={t('workbench.editors.live.graph.zoomOut')}>
        <Button
          type="text"
          size="small"
          data-testid="wf-graph-zoom-out"
          icon={<ZoomOutOutlined />}
          onClick={onZoomOut}
        />
      </Tooltip>
      <Tooltip title={t('workbench.editors.live.graph.recenter')}>
        <Button type="text" size="small" data-testid="wf-graph-fit" icon={<AimOutlined />} onClick={onFit} />
      </Tooltip>
    </GraphControlGroup>
  );
};

/**
 * The shortcut legend, behind a button in the pane's bottom-right
 * corner — names every canvas gesture so nothing is discover-by-luck.
 */
const GraphLegend: React.FC<{ editable: boolean }> = ({ editable }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Word-bearing gesture chips are keyed; the lone ⌫ glyph stays raw
  // (key caps/glyphs raw — standing rule).
  const entries: { keys: string; action: string }[] = [
    { keys: t('workbench.editors.live.graph.legendClick'), action: t('workbench.editors.live.graph.legendSelect') },
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
  const legend = (
    <div
      data-testid="wf-graph-legend"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        columnGap: 12,
        rowGap: 3,
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
  return (
    <GraphControlGroup corner="right">
      <Popover content={legend} placement="topRight">
        <Button
          type="text"
          size="small"
          data-testid="wf-graph-legend-toggle"
          aria-label={t('workbench.editors.live.graph.legendTitle')}
          icon={<QuestionCircleOutlined />}
        />
      </Popover>
    </GraphControlGroup>
  );
};

export default WorkflowGraphBody;
