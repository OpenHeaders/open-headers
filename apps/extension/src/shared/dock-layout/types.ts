/**
 * Shared types for the dockable tool-window layout system.
 *
 * Both workbench.html and the DevTools Inspector panel share the same
 * six-dock architecture. The types here are generic over the tool-window
 * ID type so each surface can define its own window registry while
 * reusing all layout logic.
 */

/** The six dock slots a tool window can live in. */
export type DockSlot = 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom' | 'bottom-left' | 'bottom-right';

/** Visual region that backs a dock — three high-level regions feed into layout math. */
export type ToolRegion = 'left' | 'right' | 'bottom';

/**
 * Which screen region the user is currently interacting with. Drives the
 * focus accent on activity-bar icons and panels. Null means no region
 * has been focused yet this session.
 */
export type FocusRegion = 'left' | 'right' | 'bottom' | 'editor' | null;

/** Runtime state for one dock: which tool windows live there and which is showing. */
export interface DockState<TWindowId extends string = string> {
  windows: TWindowId[];
  /** Active tool window; null = dock is collapsed. */
  active: TWindowId | null;
}

/**
 * Full tool-window layout state. Generic over the window ID type so both
 * workspace and panel can use the same state machine with their own
 * window registries.
 */
export interface ToolLayoutState<TWindowId extends string = string> {
  docks: Record<DockSlot, DockState<TWindowId>>;
  hidden: TWindowId[];
  /**
   * Zen-mode snapshot. When non-null the shell is in zen mode — all docks
   * captured here have been collapsed and the snapshot holds the pre-zen
   * active tool window per dock, so a later `toggleZenMode()` can restore
   * exactly the docks that were open at the moment of entry. Null when
   * zen mode is inactive. Ephemeral — never persisted across reloads.
   */
  zenSnapshot: Record<DockSlot, TWindowId | null> | null;
}

/** Definition of a tool window in a surface's registry. */
export interface ToolWindowDef<TWindowId extends string = string> {
  id: TWindowId;
  label: string;
  icon: React.ReactNode;
  /**
   * Optional tooltip text. When omitted, the tab strip uses `label`.
   * Useful when the label is an abbreviation (e.g. "WF Status") and
   * the hover copy should spell out the full meaning ("Workflow
   * Status") for discoverability.
   */
  tooltip?: string;
  /** Core tool windows cannot be hidden — the Hide menu entry is disabled. */
  core: boolean;
  /** Initial dock slot on a fresh profile; also the restore target for Hide → Show. */
  defaultSlot: DockSlot;
}

/** Layout variant for the activity bar. */
export type SidebarLayoutVariant = 'proportional' | 'compact' | 'stacked' | 'dynamic';

/**
 * Where the bottom panel sits in the shell. VS Code-style four options:
 *   - center   → bottom nested inside the middle column only (sidebars run full height)
 *   - left     → bottom spans [left sidebar + editor]; right sidebar runs full height
 *   - right    → bottom spans [editor + right sidebar]; left sidebar runs full height
 *   - justify  → bottom spans the full viewport width (below both sidebars + editor)
 */
export type BottomPanelAlignment = 'center' | 'left' | 'right' | 'justify';

export interface DropZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A drop-zone group — a single dashed card that visually pairs the two
 * docks of a region (left, right, or bottom). The card carries the
 * outer dashed outline; `firstSlot`/`secondSlot` are stacked inside it
 * and share a single internal divider so the user reads each region as
 * one chunk split in half rather than six free-floating rectangles.
 */
export interface DropZoneGroup {
  rect: DropZoneRect;
  /** `horizontal` = stacked top/bottom (sidebars); `vertical` = side-by-side (bottom panel). */
  split: 'horizontal' | 'vertical';
  firstSlot: DockSlot;
  secondSlot: DockSlot;
}
