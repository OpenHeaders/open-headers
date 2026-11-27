/**
 * WorkflowGraphBody — the graph of a workflow draft, the left half of
 * the workflow's one view (the workflow-graph plan; the workflows
 * redesign).
 *
 * A pure projection of the same `DraftWorkflow` the form edits: one
 * node per step (`WorkflowGraphNode`), one line per resolved
 * `dependsOn` parent (`WorkflowGraphLines`). Layout comes from
 * `buildWorkflowGraphLayout` — layers top-down, a node under the middle
 * of its parents — and the lines' runs from `routeGraph`; nobody places
 * a node by hand. A session step's node says its kind and what it acts
 * on, and names as text what arms it — the listen it is on, the step it
 * waits after — with no line of a kind of its own.
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
 * vars — pending until then). A line reads the same two sources for
 * whether the last run took it.
 *
 * Editing (slice 4): when the editor passes `setDraft`, the graph
 * gains structural edit gestures that mutate the SAME draft the form
 * edits — never a second model:
 *   - connect: pointer-drag from the ring at a node's lower edge — it
 *     shows on the node under the pointer and on the selected one —
 *     rubber-bands a line; dropping on another node adds that
 *     `dependsOn` edge via `addGraphDependency`. Would-be-cycle targets
 *     tint warning during the drag but the drop still commits — the
 *     form allows invalid drafts and badges them, so the graph does the
 *     same.
 *   - remove: click a line or its label to select it, then the × by
 *     the label removes the dependency.
 *   - add step: pane affordance appending the form's "+ Step"
 *     defaults and selecting the new node.
 * Rubber-banding is component-local state; only the drop mutates the
 * draft, so `isDirty` (a fingerprint comparison) can never move on a
 * gesture that didn't commit.
 *
 * Canvas chrome: a pan/zoom viewport (drag the background to pan,
 * wheel/pinch to zoom around the cursor, a row of controls bottom-left
 * with a re-center/fit action), a compact right-click context menu on
 * the background (add step) and on nodes (delete), keyboard shortcuts
 * on the focused pane (⌫ delete node or selected line, Esc dismiss), and
 * a legend behind a button bottom-right naming all of them — the graph
 * may be a short strip over its panel, so nothing sits open on it. The
 * first view centres the graph at the app's UI scale, drawn smaller
 * where it is wider than the pane. Delete mirrors the form's remove
 * button via `removeDraftStep` — last step stays, dangling references
 * badge.
 */

import {
  AimOutlined,
  DeleteOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { DraftCapture, DraftStep, DraftWorkflow } from '@openheaders/core/live';
import {
  collectGraphqlRequestTemplateStrings,
  collectMqttRequestTemplateStrings,
  collectRequestTemplateStrings,
  isExpectStep,
  isKnownStep,
  isListenStep,
  isSessionStep,
  isUnknownStep,
  toDraftCapture,
  validateSessionRequests,
  validateSessionSteps,
  validateStepRequestsExist,
  validateWorkflowShape,
} from '@openheaders/core/live';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { LiveVariable, LiveWorkflow, SessionWorkflowStep, WorkflowStep } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTheme } from '@openheaders/ui/context/ThemeContext';
import { Button, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addGraphDependency, appendDraftStep, removeDraftStep, removeGraphDependency } from './graph-edit';
import { buildWorkflowGraphLayout } from './graph-layout';
import {
  capsuleArrowState,
  capturesRead,
  clausesOn,
  lineLabel,
  lineStateOf,
  reachOfCacheRow,
  reachOfRunRow,
  type StepReach,
  stepOwnTemplates,
} from './graph-lines';
import { routeGraph } from './graph-routing';
import { actionOfStep, doesOfStep, markOfStep, protocolOfStep, STEP_KIND_WORD } from './step-facts';
import { useStepRequests } from './use-step-requests';
import { useWaitClock } from './use-wait-clock';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowGraphLines, {
  type GraphCapsuleView,
  type GraphEdgeRef,
  type GraphLineView,
} from './WorkflowGraphLines';
import WorkflowGraphNode, { GRAPH_NODE_H, GRAPH_NODE_W } from './WorkflowGraphNode';

const NODE_W = GRAPH_NODE_W;
const NODE_H = GRAPH_NODE_H;
const GAP_X = 24;
/** Room for a line's label, a capsule and its arrow. */
const GAP_Y = 72;
const PAD = 24;
/** What a line that passes a layer keeps to itself there. */
const LANE_W = 24;
const LAYOUT_METRICS = { nodeWidth: NODE_W, gap: GAP_X, laneWidth: LANE_W };
const ROUTE_METRICS = { nodeWidth: NODE_W, nodeHeight: NODE_H, layerGap: GAP_Y };

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
  const stepRequests = useStepRequests();
  const { requestsByUid, graphqlByUid, mqttRequests, ready: requestsReady } = stepRequests;
  const now = useWaitClock(run?.record ?? null);
  const { uiScale } = useTheme();
  const editable = setDraft !== undefined;
  const paneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Rubber-band connect gesture — component-local, never on the draft.
  const [drag, setDrag] = useState<ConnectDrag | null>(null);
  // Edge selection for the remove affordance — graph-only UI state.
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgeRef | null>(null);
  // The node under the pointer shows its connect ring.
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  // Right-click context menu — graph-only UI state, pane coordinates.
  const [menu, setMenu] = useState<GraphMenu | null>(null);
  // Pan/zoom viewport — graph-only UI state, never on the draft.
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  // Background pan gesture; `moved` suppresses the click-through that
  // would otherwise clear the selection after every pan.
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const panMovedRef = useRef(false);
  const [panning, setPanning] = useState(false);

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

  const layout = useMemo(() => buildWorkflowGraphLayout(draftWorkflow, LAYOUT_METRICS), [draftWorkflow]);

  const knownRequestUids = useMemo(
    () => new Set([...requestsByUid.keys(), ...graphqlByUid.keys()]),
    [requestsByUid, graphqlByUid],
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
      map.set(node.step.id, { x: PAD + node.x, y: PAD + node.layer * (NODE_H + GAP_Y) });
    }
    return map;
  }, [layout]);

  const canvasW = PAD * 2 + Math.max(NODE_W, layout.width);
  const canvasH = PAD * 2 + Math.max(1, layout.layerCount) * (NODE_H + GAP_Y) - GAP_Y;

  const routes = useMemo(
    () =>
      routeGraph(
        layout.nodes.map((node) => ({
          id: node.step.id,
          layer: node.layer,
          x: PAD + node.x,
          y: PAD + node.layer * (NODE_H + GAP_Y),
        })),
        layout.edges.map((edge) => ({ ...edge, lanes: edge.lanes.map((lane) => PAD + lane) })),
        new Set(
          layout.nodes.flatMap(({ step }) =>
            isKnownStep(step) && (step.runIf?.all.length ?? 0) > 0 ? [step.id] : [],
          ),
        ),
        ROUTE_METRICS,
      ),
    [layout],
  );

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
  // none yet): the graph centred at the app's UI scale, drawn smaller
  // where it is wider than the pane. After that the view is the user's.
  const firstViewRef = useRef({ content: canvasW, uiScale });
  firstViewRef.current = { content: canvasW, uiScale };
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(() => {
      const { width } = pane.getBoundingClientRect();
      if (width === 0) return;
      observer.disconnect();
      const { content, uiScale: full } = firstViewRef.current;
      const scale = Math.min(full, Math.max(FIRST_VIEW_MIN_SCALE, width / content));
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

  // Fit-and-center the whole graph in the pane (the re-focus action),
  // never drawn larger than the app's UI scale.
  const fitView = () => {
    const rect = paneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = clampScale(Math.min((rect.width - FIT_PAD) / canvasW, (rect.height - FIT_PAD) / canvasH, uiScale));
    setViewport({ scale, x: (rect.width - canvasW * scale) / 2, y: (rect.height - canvasH * scale) / 2 });
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

  // ── What a line says ───────────────────────────────────────────────

  const stepsById = new Map(layout.nodes.map((node) => [node.step.id, node.step]));

  /** Every template a step resolves: its request's, and the ones it holds itself. */
  const templatesOf = (step: WorkflowStep): string[] => {
    const own = stepOwnTemplates(step);
    if (isSessionStep(step)) {
      const request = isListenStep(step)
        ? mqttRequests.find((each) => each.uid === step.sessionRequestUid)
        : undefined;
      return request !== undefined ? [...own, ...collectMqttRequestTemplateStrings(request)] : own;
    }
    if (isUnknownStep(step)) return own;
    const http = requestsByUid.get(step.requestUid);
    if (http !== undefined) return [...own, ...collectRequestTemplateStrings(http)];
    const graphql = graphqlByUid.get(step.requestUid);
    return graphql !== undefined ? [...own, ...collectGraphqlRequestTemplateStrings(graphql)] : own;
  };

  const reachOf = (step: WorkflowStep): StepReach =>
    run == null
      ? reachOfCacheRow(cacheRun, step.id)
      : reachOfRunRow(run.record.steps.find((each) => each.uid === step.uid));

  const capsuleIds = new Set(routes.capsules.map((capsule) => capsule.stepId));

  const lineViews: GraphLineView[] = routes.lines.flatMap((line) => {
    const child = stepsById.get(line.to);
    if (child === undefined) return [];
    const clauses = clausesOn(isKnownStep(child) ? (child.runIf?.all ?? []) : [], line.from);
    return [
      {
        ...line,
        text: lineLabel(clauses, t),
        chips: capturesRead(templatesOf(child), line.from),
        state: lineStateOf(reachOf(child), clauses, capsuleIds.has(line.to)),
      },
    ];
  });

  const capsuleViews: GraphCapsuleView[] = routes.capsules.flatMap((capsule) => {
    const step = stepsById.get(capsule.stepId);
    return step === undefined ? [] : [{ ...capsule, state: capsuleArrowState(reachOf(step)) }];
  });

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
        <WorkflowGraphLines
          width={canvasW}
          height={canvasH}
          lines={lineViews}
          capsules={capsuleViews}
          selectedStepId={selectedStepId ?? null}
          selectedEdge={activeEdge}
          onSelectEdge={editable ? setSelectedEdge : undefined}
          onRemoveEdge={editable ? (edge) => removeEdge(edge.from, edge.to) : undefined}
        >
        {layout.nodes.map((node) => {
          const pos = positions.get(node.step.id);
          if (!pos) return null;
          const { step } = node;
          const call = isUnknownStep(step) ? undefined : step;
          const session = isSessionStep(step) ? step : undefined;
          const shared = call ?? session;
          const action = actionOfStep(step);
          return (
            <WorkflowGraphNode
              key={step.uid}
              stepId={step.id}
              x={pos.x}
              y={pos.y}
              selected={selectedStepId === step.id}
              onSelect={onSelectStep ? () => onSelectStep(step.uid) : undefined}
              onContextMenu={handleNodeContextMenu({ stepId: step.id, stepUid: step.uid })}
              onHover={
                editable ? (over) => setHoveredStepId((id) => (over ? step.id : id === step.id ? null : id)) : undefined
              }
              protocol={protocolOfStep(step, draft.steps, stepRequests)}
              kind={action !== undefined ? t(STEP_KIND_WORD[action]) : ''}
              does={doesOfStep(step, draft.steps, stepRequests, t)}
              unknownAction={isKnownStep(step) ? undefined : step.action}
              armedBy={session !== undefined ? armedByOf(session) : ''}
              usedBy={session !== undefined && isListenStep(session) ? usersOf(session.id) : []}
              captures={capturesOf(draftStepsById.get(step.id))}
              boundVars={boundVars}
              mark={markOfStep(step, { run, cacheRun, now }, t)}
              runCaptures={cacheRun?.stepCaptures[step.id]}
              runResponseBytes={cacheRun?.stepResponseBytes[step.id]}
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
        </WorkflowGraphLines>
        {drag && dragSource && (
          <svg
            width={canvasW}
            height={canvasH}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            aria-hidden="true"
          >
            <path
              data-testid="wf-graph-rubberband"
              d={`M ${dragSource.x + NODE_W / 2} ${dragSource.y + NODE_H} L ${drag.x} ${drag.y}`}
              fill="none"
              stroke="var(--oh-wf-accent)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          </svg>
        )}
        {editable &&
          layout.nodes.map((node) => {
            const pos = positions.get(node.step.id);
            if (!pos) return null;
            const { id } = node.step;
            const shown = hoveredStepId === id || selectedStepId === id || drag?.from === id;
            return (
              // Connect ring — at the node's lower edge, shown on the
              // node under the pointer and on the selected one; pointer
              // capture keeps the whole drag on this element so the drop
              // hit-tests by coordinates.
              <div
                key={`connect-${node.step.uid}`}
                data-testid={`wf-graph-connect-${id}`}
                data-graph-interactive=""
                title={t('workbench.editors.live.graph.connectTitle')}
                onPointerEnter={() => setHoveredStepId(id)}
                onPointerLeave={() => setHoveredStepId((hovered) => (hovered === id ? null : hovered))}
                onPointerDown={beginConnect(id)}
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
                  border: '2px solid var(--oh-wf-accent)',
                  background: 'var(--oh-wf-surface)',
                  opacity: shown ? 1 : 0,
                  cursor: 'crosshair',
                  touchAction: 'none',
                  zIndex: 2,
                }}
              />
            );
          })}
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
