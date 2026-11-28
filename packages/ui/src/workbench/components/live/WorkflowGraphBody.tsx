/**
 * WorkflowGraphBody — the graph of a workflow draft, the left half of
 * the workflow's one view (the workflow-graph plan; the workflows
 * redesign).
 *
 * A pure projection of the same `DraftWorkflow` the form edits: one
 * node per step (`WorkflowGraphNode`), one line per resolved
 * `dependsOn` parent (`WorkflowGraphLines`). Layout comes from
 * `buildWorkflowGraphLayout` — layers top-down, a node under the middle
 * of its parents — and the lines' runs from `routeGraph`. Where the
 * workflow can be edited a node is moved by its body (the workflow runs
 * plan, Decisions log, S31): the first drop keeps every node where it
 * stands, and from then the graph is drawn by those places — this
 * device's, handed in as `places`, never the draft's — until
 * Auto-arrange forgets them. A session step's node says its kind and what it acts
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
 * a step captured are its panel's to show, in its Captures card; on a
 * node an exposed capture carries its variable's publication state
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
 *   - add step: the pane's "+ Step" opens the step picker
 *     (`StepPicker`); the step taken there is added and selected.
 * Rubber-banding is component-local state; only the drop mutates the
 * draft, so `isDirty` (a fingerprint comparison) can never move on a
 * gesture that didn't commit.
 *
 * Canvas chrome: a pan/zoom viewport (drag the background to pan,
 * wheel/pinch to zoom around the cursor — `graph-zoom.ts` holds the
 * rates and the stops —, a row of controls bottom-left
 * with the draft's undo and redo, then Auto-arrange where a node can be
 * moved — the workflow runs plan, Decisions log, S31 —, and bottom-right
 * the zoom group with its re-center/fit action), a bar of the selected
 * step's actions by its node (`WorkflowGraphActionBar`: a copy, a step
 * added after it, its request opened, its removal — a read-only workflow
 * keeps the request alone), a compact right-click context menu on the
 * background (add step) and on nodes (the bar's actions, and the step's
 * rename), keyboard shortcuts on the focused pane (⌫ delete node or
 * selected line, Esc dismiss), and a legend behind a button at the
 * row's end naming all of them. From two steps up the whole graph sits
 * small in the bottom-right corner (`WorkflowGraphMinimap`), the zoom
 * group at its left, and a step that waits on no other wears a bar on
 * its top edge: a run starts there. The
 * first view centres the graph at the app's UI scale, drawn smaller
 * where it is wider than the pane. Delete mirrors the form's remove
 * button via `removeDraftStep` — last step stays, dangling references
 * badge.
 */

import {
  AimOutlined,
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { DraftCapture, DraftStep, DraftWorkflow } from '@openheaders/core/live';
import {
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
import type { WorkflowNodePlaces } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTheme } from '@openheaders/ui/context/ThemeContext';
import { Button, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatChord } from '../../hooks/useWorkspaceShortcuts';
import { stepRequestTemplates } from './capture-uses';
import GraphControlGroup, { controlGroupSize } from './GraphControlGroup';
import {
  addGraphDependency,
  addPickedStep,
  duplicateDraftStep,
  removeDraftStep,
  removeGraphDependency,
} from './graph-edit';
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
import { type Point, type Rect, type Size, viewportCentredOn } from './graph-minimap';
import { boundsOfNodes, freezePlaces, type PlacedStep, placedPositions, snapPlace } from './graph-places';
import { routeGraph } from './graph-routing';
import { fittedScale, wheelZoomFactor, zoomedScale, zoomOutStopOf } from './graph-zoom';
import { StepPickerPopover } from './StepPicker';
import {
  actionOfStep,
  doesOfStep,
  markOfStep,
  protocolOfStep,
  requestOpenOf,
  STEP_KIND_WORD,
  type StepRequestOpeners,
} from './step-facts';
import type { StepPick, StepPickerChoices } from './step-picker';
import { type DraftHistoryControls, REDO_HINT_CHORD, UNDO_CHORD } from './use-draft-history';
import { useStepRequests } from './use-step-requests';
import { useWaitClock } from './use-wait-clock';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowGraphActionBar, { type GraphAction } from './WorkflowGraphActionBar';
import WorkflowGraphLines, {
  type GraphCapsuleView,
  type GraphEdgeRef,
  type GraphLineView,
} from './WorkflowGraphLines';
import WorkflowGraphMinimap, { MINIMAP_BESIDE_GAP, MINIMAP_OFFSET, MINIMAP_SIZE } from './WorkflowGraphMinimap';
import WorkflowGraphNode, { GRAPH_NODE_H, GRAPH_NODE_W, type NodeDragHandlers } from './WorkflowGraphNode';

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
const NODE_SIZE = { width: NODE_W, height: NODE_H };
const PLACE_METRICS = { node: NODE_SIZE, gapX: GAP_X, gapY: GAP_Y };
/** How far a press on a node may move and still be a click — the background pan's own give. */
const MOVE_GIVE = 3;
/** A node's connect ring, and how far under the node it reaches. */
const RING = 12;
const RING_REACH = RING / 2;
/** What the selected step's bar keeps from its node's middle: half a capsule, and a little. */
const BAR_CLEAR_OF_LINES = 18;
/** The band at the pane's top its "+ Step" button sits in, and what is left of it where there is no button. */
const TOP_BAND = 40;
const TOP_EDGE = 4;
/** The zoom group's box — zoom in, zoom out, re-center — and the corner's with the map at rest beside it. */
const ZOOM_GROUP_SIZE = controlGroupSize(3);
const CORNER_SIZE_WITH_MAP = {
  width: ZOOM_GROUP_SIZE.width + MINIMAP_BESIDE_GAP + MINIMAP_SIZE.width,
  height: MINIMAP_SIZE.height,
};

interface WorkflowGraphBodyProps {
  draft: DraftWorkflow;
  /**
   * The editor's draft setter — the SAME one the form body uses.
   * Present = editing gestures on; absent = read-only graph.
   */
  setDraft?: (next: DraftWorkflow) => void;
  /** The draft's undo and redo — two buttons in the row of controls. */
  history: DraftHistoryControls;
  /** Where the steps were placed by hand, by step uid — `null` while the graph follows its computed layout. */
  places?: WorkflowNodePlaces | null;
  /**
   * The nodes placed, or their places forgotten (`null`). Present = a
   * node is moved by its body and the row has Auto-arrange; a graph that
   * takes no edit takes no move either.
   */
  onMovePlaces?: (next: WorkflowNodePlaces | null) => void;
  /** Currently selected step id (ephemeral UI state owned by the editor). */
  selectedStepId?: string | null;
  /** A press on a node, or a step the graph just added — select it, by uid. */
  onSelectStep?: (stepUid: string) => void;
  /** The step picker added a step — absent, the step is selected as any other is. */
  onStepAdded?: (stepUid: string) => void;
  /** A node's menu asked for the step's rename — absent, the menu has no such row. */
  onRenameStep?: (stepUid: string) => void;
  /** A click on the empty canvas. */
  onDeselect?: () => void;
  /** The run the page keeps of this workflow — a node's mark is its row while there is one. */
  run?: ShownWorkflowRun | null;
  /**
   * The active environment's cache row — `pickActiveRun` output. It
   * marks the nodes while no run is kept. `null` = no cache yet;
   * `undefined` = a draft never saved.
   */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  /** LVs bound to this workflow — supplies per-exposure publication state. */
  boundVars?: LiveVariable[];
  /** What the step picker lists. */
  stepChoices: StepPickerChoices;
  /** What opens a request's own tab — absent on a surface that opens none. */
  requestOpeners?: StepRequestOpeners;
}

/** The door the step picker is open at: the pane's button, a point of the canvas, the bar of the selected step. */
type PickerDoor = 'button' | 'point' | 'bar';

interface ConnectDrag {
  from: string;
  x: number;
  y: number;
}

/** A press held on a node's body: where it began, where the node stood, whether it moved past a click's give. */
interface NodePress {
  pointerId: number;
  stepId: string;
  startX: number;
  startY: number;
  from: Point;
  moved: boolean;
}

/** Right-click context menu — pane-relative position + target (the
 *  pane never transforms, so the menu doesn't scale with the zoom). */
type GraphMenu = { x: number; y: number; hang: MenuHang } & ({ kind: 'canvas' } | { kind: 'node'; stepId: string });

/** The edges of the pane a menu is placed from: it opens toward the pane's middle, so the pane never cuts it. */
type MenuHang = Pick<React.CSSProperties, 'left' | 'right' | 'top' | 'bottom'>;

/** Pan/zoom viewport — translate-then-scale, origin top-left. */
interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const FIT_PAD = 32;
/** The first view never draws the graph smaller than this to fit its width — a node must stay readable. */
const FIRST_VIEW_MIN_SCALE = 0.5;
/** What a step brought into view keeps between itself and the pane's edge. */
const REVEAL_MARGIN = 16;

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
  history,
  places = null,
  onMovePlaces,
  selectedStepId,
  onSelectStep,
  onStepAdded = onSelectStep,
  onRenameStep,
  onDeselect,
  run,
  cacheRun,
  boundVars,
  stepChoices,
  requestOpeners,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const stepRequests = useStepRequests();
  const { requestsByUid, graphqlByUid, mqttRequests, ready: requestsReady } = stepRequests;
  const now = useWaitClock(run?.record ?? null);
  const { uiScale } = useTheme();
  const editable = setDraft !== undefined;
  const movable = editable && onMovePlaces !== undefined;
  const rootRef = useRef<HTMLDivElement>(null);
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
  // The step picker's open door, and the point of the pane its canvas door last opened at.
  const [picker, setPicker] = useState<PickerDoor | null>(null);
  const [pickerPoint, setPickerPoint] = useState<Point>({ x: 0, y: 0 });
  // Pan/zoom viewport — graph-only UI state, never on the draft.
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  // Background pan gesture; `moved` suppresses the click-through that
  // would otherwise clear the selection after every pan.
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const panMovedRef = useRef(false);
  const [panning, setPanning] = useState(false);
  // A node moved by its body — graph-only UI state until the drop, which
  // keeps the places. A press that moved its node is no click.
  const nodePressRef = useRef<NodePress | null>(null);
  const nodeMovedRef = useRef(false);
  const [move, setMove] = useState<{ stepId: string; at: Point } | null>(null);
  // The user has pressed, scrolled or typed on the graph: the view is theirs.
  const touchedRef = useRef(false);

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

  // Where the computed layout puts each node, and the box it fills.
  const computedPositions = useMemo(() => {
    const map = new Map<string, Point>();
    for (const node of layout.nodes) {
      map.set(node.step.id, { x: PAD + node.x, y: PAD + node.layer * (NODE_H + GAP_Y) });
    }
    return map;
  }, [layout]);
  const computedWorld = useMemo<Rect>(
    () => ({
      x: 0,
      y: 0,
      width: PAD * 2 + Math.max(NODE_W, layout.width),
      height: PAD * 2 + Math.max(1, layout.layerCount) * (NODE_H + GAP_Y) - GAP_Y,
    }),
    [layout],
  );

  const placedSteps = useMemo<PlacedStep[]>(
    () => layout.nodes.map((node) => ({ id: node.step.id, uid: node.step.uid, parents: node.parents })),
    [layout],
  );

  // Where each node stands: by the places kept once the graph is
  // arranged, by the computed layout until then.
  const standing = useMemo(
    () =>
      places === null ? computedPositions : placedPositions(placedSteps, computedPositions, places, PLACE_METRICS),
    [places, placedSteps, computedPositions],
  );
  // A node being moved is where the pointer has it: its lines, the map
  // and the bar read the same place and follow.
  const positions = useMemo(() => {
    if (move === null) return standing;
    return new Map(standing).set(move.stepId, move.at);
  }, [standing, move]);

  // A graph is arranged from its first move. The world is then the box
  // its nodes fill, wherever they were put, and no line keeps a lane of
  // the computed layout — a line may pass under a node.
  const arranged = places !== null || move !== null;
  const world = useMemo(
    () => (arranged ? boundsOfNodes(positions.values(), NODE_SIZE, PAD) : computedWorld),
    [arranged, positions, computedWorld],
  );

  const routes = useMemo(
    () =>
      routeGraph(
        layout.nodes.flatMap((node) => {
          const at = positions.get(node.step.id);
          return at === undefined ? [] : [{ id: node.step.id, ...at }];
        }),
        layout.edges.map((edge) => ({ ...edge, lanes: arranged ? [] : edge.lanes.map((lane) => PAD + lane) })),
        new Set(
          layout.nodes.flatMap(({ step }) =>
            isKnownStep(step) && (step.runIf?.all.length ?? 0) > 0 ? [step.id] : [],
          ),
        ),
        ROUTE_METRICS,
      ),
    [layout, positions, arranged],
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

  // Where a right-click's menu goes: at the pointer, opening away from
  // the pane's nearer edges.
  const menuAt = (e: { clientX: number; clientY: number }): { x: number; y: number; hang: MenuHang } => {
    const rect = paneRef.current?.getBoundingClientRect();
    const { x, y } = panePoint(e);
    if (!rect) return { x, y, hang: { left: x, top: y } };
    return {
      x,
      y,
      hang: {
        ...(x > rect.width / 2 ? { right: rect.width - x } : { left: x }),
        ...(y > rect.height / 2 ? { bottom: rect.height - y } : { top: y }),
      },
    };
  };

  // The first view, once the pane has a size (a tab mounted hidden has
  // none yet): the graph centred at the app's UI scale, drawn smaller
  // where it is wider than the pane. After that the view is the user's.
  const firstViewOf = (width: number): Viewport => {
    const scale = Math.min(uiScale, Math.max(FIRST_VIEW_MIN_SCALE, width / world.width));
    return { scale, x: Math.max(0, (width - world.width * scale) / 2) - world.x * scale, y: 0 - world.y * scale };
  };
  const firstViewRef = useRef(firstViewOf);
  firstViewRef.current = firstViewOf;
  const firstViewShownRef = useRef(false);
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(() => {
      const { width } = pane.getBoundingClientRect();
      if (width === 0) return;
      observer.disconnect();
      firstViewShownRef.current = true;
      setViewport(firstViewRef.current(width));
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  // The places this device kept are read a moment after the graph
  // mounts. While the view is still as it was first shown, it is shown
  // again around them — in the paint that draws them.
  const placesShownRef = useRef(places);
  useLayoutEffect(() => {
    if (placesShownRef.current === places) return;
    placesShownRef.current = places;
    if (!firstViewShownRef.current || touchedRef.current) return;
    const width = paneRef.current?.getBoundingClientRect().width ?? 0;
    if (width > 0) setViewport(firstViewRef.current(width));
  }, [places]);

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

  // A zoom around a point of the pane. Zooming out stops where the
  // graph is half the size Re-center would draw it in this pane.
  const zoomAt = (pane: Size, at: Point, factor: number) => {
    const stop = zoomOutStopOf(fittedScale(world, pane, FIT_PAD, uiScale));
    setViewport((v) => {
      const scale = zoomedScale(v.scale, factor, stop);
      const k = scale / v.scale;
      return { scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k };
    });
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  // Wheel = zoom around the cursor, a trackpad's pinch at its own rate.
  // Native non-passive listener — React's synthetic wheel handlers
  // can't preventDefault reliably.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touchedRef.current = true;
      const rect = pane.getBoundingClientRect();
      zoomAtRef.current(rect, { x: e.clientX - rect.left, y: e.clientY - rect.top }, wheelZoomFactor(e));
    };
    pane.addEventListener('wheel', onWheel, { passive: false });
    return () => pane.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const rect = paneRef.current?.getBoundingClientRect();
    if (rect) zoomAt(rect, { x: rect.width / 2, y: rect.height / 2 }, factor);
  };

  // Fit-and-center a box of the graph in the pane, never drawn larger
  // than the app's UI scale. The whole graph's is the re-focus action.
  const fitTo = (box: Rect) => {
    const rect = paneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = fittedScale(box, rect, FIT_PAD, uiScale);
    // A pane with no room for the box has nothing to fit it in.
    if (scale <= 0) return;
    setViewport({
      scale,
      x: (rect.width - box.width * scale) / 2 - box.x * scale,
      y: (rect.height - box.height * scale) / 2 - box.y * scale,
    });
  };
  const fitView = () => fitTo(world);

  // The pointer's place for a node pressed at `press`: where it stood,
  // moved by what the pointer moved, snapped.
  const placeUnder = (press: NodePress, e: { clientX: number; clientY: number }): Point =>
    snapPlace({
      x: press.from.x + (e.clientX - press.startX) / viewport.scale,
      y: press.from.y + (e.clientY - press.startY) / viewport.scale,
    });

  // A node moved by its body. Until the press has moved past a click's
  // give it is a click; from there the node follows the pointer, and
  // the drop keeps every node where it then stands.
  const dragOf = (stepId: string): NodeDragHandlers => ({
    onPointerDown: (e) => {
      nodeMovedRef.current = false;
      const from = positions.get(stepId);
      if (e.button !== 0 || from === undefined) return;
      nodePressRef.current = {
        pointerId: e.pointerId,
        stepId,
        startX: e.clientX,
        startY: e.clientY,
        from,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      const press = nodePressRef.current;
      if (!press || press.pointerId !== e.pointerId) return;
      // No button is held: the release was lost on its way here. The node goes back and follows nothing.
      if ((e.buttons & 1) === 0) {
        nodePressRef.current = null;
        setMove(null);
        return;
      }
      const travelled = Math.abs(e.clientX - press.startX) + Math.abs(e.clientY - press.startY);
      if (!press.moved && travelled <= MOVE_GIVE) return;
      press.moved = true;
      const at = placeUnder(press, e);
      setMove((current) =>
        current !== null && current.at.x === at.x && current.at.y === at.y ? current : { stepId, at },
      );
    },
    onPointerUp: (e) => {
      const press = nodePressRef.current;
      if (!press || press.pointerId !== e.pointerId) return;
      nodePressRef.current = null;
      if (!press.moved) return;
      nodeMovedRef.current = true;
      setMove(null);
      const at = placeUnder(press, e);
      // Dropped where it stood, nothing is kept: the graph is as it was.
      if (at.x === press.from.x && at.y === press.from.y) return;
      onMovePlaces?.(freezePlaces(placedSteps, new Map(standing).set(stepId, at)));
    },
    onPointerCancel: () => {
      nodePressRef.current = null;
      setMove(null);
    },
  });

  // Back to the computed layout, brought into view: the places are forgotten.
  const autoArrange = () => {
    onMovePlaces?.(null);
    fitTo(computedWorld);
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

  // A row of the step picker was taken. From the bar's door the new step waits on the selected one.
  const handlePickStep = (pick: StepPick) => {
    if (!setDraft) return;
    // Focus returns to the graph, where the picker was opened from: its shortcuts act on the step just added.
    rootRef.current?.focus({ preventScroll: true });
    const added = addPickedStep(draft, pick, picker === 'bar' ? (selectedStepId ?? undefined) : undefined);
    setDraft(added.draft);
    onStepAdded?.(added.stepUid);
    setPicker(null);
  };

  const handleDuplicateStep = (stepUid: string) => {
    if (!setDraft) return;
    const copied = duplicateDraftStep(draft, stepUid);
    if (copied === null) return;
    setDraft(copied.draft);
    onSelectStep?.(copied.stepUid);
  };

  const handleDeleteStep = (stepId: string) => {
    if (!setDraft) return;
    const next = removeDraftStep(draft, stepId);
    if (next) setDraft(next);
    setMenu(null);
  };

  /**
   * What is done to a step as a whole — the bar by its node and its
   * right-click menu hold the same, but the rename, which is the menu's
   * alone (the workflow runs plan, Decisions log, S36). A read-only
   * workflow keeps the one that edits nothing; a step that names no saved
   * request has it off.
   */
  const stepActionsOf = (step: WorkflowStep): GraphAction[] => {
    const openRequest = requestOpeners !== undefined ? requestOpenOf(step, stepRequests, requestOpeners) : undefined;
    const open: GraphAction[] =
      requestOpeners === undefined
        ? []
        : [
            {
              key: 'open-request',
              icon: <ExportOutlined />,
              text: t('workbench.editors.live.request.open'),
              disabled: openRequest === undefined,
              onClick: () => openRequest?.(),
            },
          ];
    if (!editable) return openRequest === undefined ? [] : open;
    const rename: GraphAction[] =
      onRenameStep === undefined
        ? []
        : [
            {
              key: 'rename-step',
              icon: <EditOutlined />,
              text: t('workbench.editors.live.graph.menuRenameStep'),
              menuOnly: true,
              disabled: !isKnownStep(step),
              onClick: () => onRenameStep(step.uid),
            },
          ];
    return [
      ...rename,
      {
        key: 'duplicate-step',
        icon: <CopyOutlined />,
        text: t('workbench.editors.live.panel.duplicate'),
        disabled: !isKnownStep(step),
        onClick: () => handleDuplicateStep(step.uid),
      },
      {
        key: 'add-step-after',
        icon: <PlusOutlined />,
        text: t('workbench.editors.live.graph.addStepAfter'),
        opensPicker: true,
        onClick: () => setPicker('bar'),
      },
      ...open,
      {
        key: 'delete-step',
        icon: <DeleteOutlined />,
        text: t('workbench.editors.live.graph.menuDeleteStep'),
        kbd: '⌫',
        danger: true,
        disabled: draft.steps.length <= 1,
        onClick: () => handleDeleteStep(step.id),
      },
    ];
  };

  // Pane-scoped shortcuts — the wrapper is focusable (pointer-down
  // focuses it), so these never fire while a form field has focus.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    touchedRef.current = true;
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
    setMenu({ ...menuAt(e), kind: 'canvas' });
  };

  const handleNodeContextMenu = (step: WorkflowStep) => (e: React.MouseEvent) => {
    // A step with nothing to offer keeps the browser's own menu.
    if (stepActionsOf(step).length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectStep?.(step.uid);
    setMenu({ ...menuAt(e), kind: 'node', stepId: step.id });
  };

  const selectedStep = selectedStepId == null ? undefined : draft.steps.find((step) => step.id === selectedStepId);
  const menuStep = menu?.kind === 'node' ? draft.steps.find((step) => step.id === menu.stepId) : undefined;
  const menuActions: GraphAction[] =
    menu === null
      ? []
      : menu.kind === 'canvas'
        ? [
            {
              key: 'add-step',
              icon: <PlusOutlined />,
              text: t('workbench.editors.live.graph.menuAddStep'),
              onClick: () => {
                setPickerPoint({ x: menu.x, y: menu.y });
                setPicker('point');
              },
            },
          ]
        : menuStep !== undefined
          ? stepActionsOf(menuStep)
          : [];

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
  const templatesOf = (step: WorkflowStep): string[] => [
    ...stepOwnTemplates(step),
    ...stepRequestTemplates(step, stepRequests),
  ];

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

  // Each step's mark, read once: its node wears it, and the minimap its colour.
  const marks = new Map(layout.nodes.map(({ step }) => [step.id, markOfStep(step, { run, cacheRun, now }, t)]));
  // A graph of one step is all in view: the minimap comes with the second.
  const hasMinimap = draft.steps.length >= 2;

  const centreOn = (point: Point) => {
    const rect = paneRef.current?.getBoundingClientRect();
    if (!rect) return;
    setViewport((v) => viewportCentredOn(point, rect, v.scale));
  };

  // Zoom in, zoom out and re-center: at the map's left, in the corner alone where the graph has no map.
  const zoomControls = (
    <GraphViewControls onZoomIn={() => zoomBy(1.2)} onZoomOut={() => zoomBy(1 / 1.2)} onFit={fitView} />
  );

  return (
    <div
      ref={rootRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => {
        touchedRef.current = true;
        e.currentTarget.focus({ preventScroll: true });
      }}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {editable && (
        <>
          <StepPickerPopover
            open={picker === 'button'}
            onOpenChange={(open) => setPicker(open ? 'button' : null)}
            placement="bottomRight"
            choices={stepChoices}
            onPick={handlePickStep}
          >
            <Button
              size="small"
              icon={<PlusOutlined />}
              data-testid="wf-graph-add-step"
              style={{ position: 'absolute', top: 8, right: 12, zIndex: 3 }}
            >
              {t('workbench.editors.live.form.addStepButton')}
            </Button>
          </StepPickerPopover>
          {/* The canvas menu's door has no button to hang the picker on: it hangs on the point pressed. */}
          <StepPickerPopover
            open={picker === 'point'}
            onOpenChange={(open) => {
              if (!open) setPicker(null);
            }}
            placement="bottomLeft"
            choices={stepChoices}
            onPick={handlePickStep}
          >
            <span
              aria-hidden="true"
              style={{ position: 'absolute', left: pickerPoint.x, top: pickerPoint.y, width: 0, height: 0 }}
            />
          </StepPickerPopover>
        </>
      )}
      <WorkflowGraphActionBar
        pane={paneRef}
        viewport={viewport}
        node={(selectedStep !== undefined ? positions.get(selectedStep.id) : undefined) ?? null}
        nodeSize={NODE_SIZE}
        topBand={editable ? TOP_BAND : TOP_EDGE}
        ringReach={editable ? RING_REACH : 0}
        lineClear={BAR_CLEAR_OF_LINES}
        corner={{ size: hasMinimap ? CORNER_SIZE_WITH_MAP : ZOOM_GROUP_SIZE, ...MINIMAP_OFFSET }}
        actions={selectedStep !== undefined ? stepActionsOf(selectedStep) : []}
        picker={
          editable
            ? {
                open: picker === 'bar',
                onOpenChange: (open) => setPicker(open ? 'bar' : null),
                choices: stepChoices,
                onPick: handlePickStep,
              }
            : undefined
        }
      />
      <GraphControlRow>
        <GraphHistoryControls history={history} />
        {movable && <GraphArrangeControl arranged={places !== null} onArrange={autoArrange} />}
        <GraphLegend editable={editable} movable={movable} withMap={hasMinimap} />
      </GraphControlRow>
      {hasMinimap ? (
        <WorkflowGraphMinimap
          beside={zoomControls}
          world={world}
          nodes={layout.nodes.flatMap((node) => {
            const pos = positions.get(node.step.id);
            const mark = marks.get(node.step.id);
            return pos === undefined || mark === undefined ? [] : [{ id: node.step.id, ...pos, kind: mark.kind }];
          })}
          nodeSize={{ width: NODE_W, height: NODE_H }}
          pane={paneRef}
          viewport={viewport}
          onCentre={centreOn}
        />
      ) : (
        // No map yet: the zoom group has the corner to itself.
        <div style={{ position: 'absolute', ...MINIMAP_OFFSET, zIndex: 3 }}>{zoomControls}</div>
      )}
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
          width: world.width,
          height: world.height,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <WorkflowGraphLines
          width={world.width}
          height={world.height}
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
          const mark = marks.get(step.id);
          if (mark === undefined) return null;
          return (
            <WorkflowGraphNode
              key={step.uid}
              stepId={step.id}
              x={pos.x}
              y={pos.y}
              selected={selectedStepId === step.id}
              drag={movable ? dragOf(step.id) : undefined}
              moving={move?.stepId === step.id}
              start={node.parents.length === 0}
              onSelect={
                onSelectStep
                  ? () => {
                      // The click that ends a move selects nothing.
                      if (nodeMovedRef.current) nodeMovedRef.current = false;
                      else onSelectStep(step.uid);
                    }
                  : undefined
              }
              onContextMenu={handleNodeContextMenu(step)}
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
              mark={mark}
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
            width={world.width}
            height={world.height}
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
                  left: pos.x + NODE_W / 2 - RING_REACH,
                  top: pos.y + NODE_H - RING_REACH,
                  width: RING,
                  height: RING,
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
            ...menu.hang,
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

/** Compact context-menu row — icon, action text, shortcut hint. */
const GraphMenuRow: React.FC<{ action: GraphAction; onDone: () => void }> = ({ action, onDone }) => {
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

/** The pane's controls of the draft, in its bottom-left corner: a row of groups. */
const GraphControlRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', bottom: 8, left: 12, zIndex: 3, display: 'flex', gap: 6 }}>{children}</div>
);

/** Zoom in / zoom out / fit-and-center controls. */
const GraphViewControls: React.FC<{ onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }> = ({
  onZoomIn,
  onZoomOut,
  onFit,
}) => {
  const t = useT();
  return (
    <GraphControlGroup>
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

/** Undo and redo of the draft, each named with its shortcut. */
const GraphHistoryControls: React.FC<{ history: DraftHistoryControls }> = ({ history }) => {
  const t = useT();
  const undo = t('workbench.editors.live.graph.undo');
  const redo = t('workbench.editors.live.graph.redo');
  // A press leaves focus on the graph: a button that goes off while it
  // holds focus takes no key, and the shortcut would stop with it.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <GraphControlGroup>
      <Tooltip title={`${undo} (${formatChord(UNDO_CHORD)})`}>
        <Button
          type="text"
          size="small"
          data-testid="wf-graph-undo"
          aria-label={undo}
          icon={<UndoOutlined />}
          disabled={!history.canUndo}
          onMouseDown={keepFocus}
          onClick={history.undo}
        />
      </Tooltip>
      <Tooltip title={`${redo} (${formatChord(REDO_HINT_CHORD)})`}>
        <Button
          type="text"
          size="small"
          data-testid="wf-graph-redo"
          aria-label={redo}
          icon={<RedoOutlined />}
          disabled={!history.canRedo}
          onMouseDown={keepFocus}
          onClick={history.redo}
        />
      </Tooltip>
    </GraphControlGroup>
  );
};

/** Back to the computed layout — off while the graph follows it already. */
const GraphArrangeControl: React.FC<{ arranged: boolean; onArrange: () => void }> = ({ arranged, onArrange }) => {
  const t = useT();
  const name = t('workbench.editors.live.graph.autoArrange');
  return (
    <GraphControlGroup>
      <Tooltip title={name}>
        <Button
          type="text"
          size="small"
          data-testid="wf-graph-auto-arrange"
          aria-label={name}
          icon={<ApartmentOutlined />}
          disabled={!arranged}
          // A press leaves focus on the graph, as undo's does: the button goes off under it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onArrange}
        />
      </Tooltip>
    </GraphControlGroup>
  );
};

/**
 * The shortcut legend, behind a button at the end of the row of
 * controls — names every canvas gesture so nothing is discover-by-luck.
 */
const GraphLegend: React.FC<{ editable: boolean; movable: boolean; withMap: boolean }> = ({
  editable,
  movable,
  withMap,
}) => {
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
    ...(movable
      ? [
          {
            keys: t('workbench.editors.live.graph.legendDragStep'),
            action: t('workbench.editors.live.graph.legendMove'),
          },
        ]
      : []),
    { keys: t('workbench.editors.live.graph.legendDragBg'), action: t('workbench.editors.live.graph.legendPan') },
    ...(withMap
      ? [{ keys: t('workbench.editors.live.graph.legendDragMap'), action: t('workbench.editors.live.graph.legendPan') }]
      : []),
    { keys: t('workbench.editors.live.graph.legendScroll'), action: t('workbench.editors.live.graph.legendZoom') },
    { keys: formatChord(UNDO_CHORD), action: t('workbench.editors.live.graph.legendUndo') },
    { keys: formatChord(REDO_HINT_CHORD), action: t('workbench.editors.live.graph.legendRedo') },
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
        <span key={entry.keys} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
    <GraphControlGroup>
      <Popover content={legend} placement="topLeft">
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
