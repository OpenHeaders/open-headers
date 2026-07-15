/**
 * Types for the workbench.html full-page editor.
 */

import type { Request, Rule, RuleDraft } from '@openheaders/core/types';

/**
 * One pending workflow step handed to the Live Workflow editor by a
 * seeding surface (a Request's "Extract → workflow" action, or the
 * request tree's "Create Workflow…" container action). The editor
 * stages — but never persists — a step per seed; the user reviews and
 * Saves as usual.
 */
export interface WorkflowSeedStep {
  requestUid: string;
  requestName: string;
  method: string;
}

export type TabMode =
  | 'edit'
  | 'collection-overview'
  | 'folder-overview'
  | 'template-edit'
  | 'settings'
  | 'whats-new'
  | 'workspace-manager'
  | 'daemon-admin'
  | 'env-edit'
  | 'workspace-vars'
  | 'vault'
  | 'script-packages'
  | 'live-vars'
  | 'collection-vars'
  | 'request-collection-vars'
  | 'request-collection-scripts'
  | 'request-folder-scripts'
  | 'request-collection-auth'
  | 'request-folder-auth'
  | 'template-collection-vars'
  | 'request-edit'
  | 'request-create'
  | 'response-example'
  | 'rule-create'
  | 'live-variable-edit'
  | 'live-variable-create'
  | 'live-workflow-edit'
  | 'live-workflow-create';

export interface WorkbenchTab {
  /** Unique tab identifier. Format: 'create-{counter}', 'edit-{uid}', 'col-{uid}', 'folder-{uid}'. */
  id: string;
  /** Display label. */
  label: string;
  /** The rule type for icon display (rules only). */
  ruleType: string;
  /** Whether the editor has unsaved changes. */
  dirty: boolean;
  /** Tab mode. */
  mode: TabMode;
  /** For rule edit tabs opened via a `+ New Rule` gesture: optional
   *  template key to pre-apply on mount. Honored only while the rule
   *  is unpublished — published rules ignore the prop. */
  templateKey?: string;
  /**
   * Pre-filled rule draft from an external caller (inspector-panel
   * "override this header" CTA, future import/paste flows). The editor
   * overlays it on the form on first mount when the rule is still
   * unpublished. After publish (or on subsequent mounts) the prop is
   * inert.
   */
  initialDraft?: RuleDraft;
  /**
   * Full-fidelity seed for a `rule-create` tab minted by "Duplicate Tab".
   * Carries the source rule's current editor content (conditions +
   * per-type action, incl. unsaved edits) minus identity. The create
   * editor hydrates its whole form from this on first mount — distinct
   * from `initialDraft`, which is a partial pre-fill. Nothing is
   * persisted until the user saves the scratch and picks a destination.
   */
  seedRuleContent?: Omit<Rule, 'uid' | 'path'>;
  /**
   * Full-fidelity seed for a `request-create` tab minted by "Duplicate
   * Tab". Carries the source request's current editor content (URL,
   * method, headers, params, auth, body, scripts, …) plus name, minus
   * identity. The create editor seeds its draft from this on first mount.
   */
  seedRequestContent?: Omit<Request, 'uid' | 'path' | 'schemaVersion'>;
  /**
   * For request-create tabs opened from a specific collection/folder
   * (sidebar "Add Request", CollectionOverview, FolderOverview): the
   * destination the user picked. When set, the Save flow skips the
   * SaveToCollectionModal and persists directly to this location.
   */
  preferredCollectionId?: string;
  preferredFolderPath?: string;
  /**
   * Environment pinned to this tab. While the tab is focused the pinned
   * env takes over the active environment with the highest precedence
   * (above every collection auto-switch mode); leaving the tab falls
   * back to normal mode resolution. `undefined` = no pin, `null` =
   * pinned to "No environment", string = env uid. Duplicate Tab carries
   * the pin; a pin to a deleted env is dropped on focus.
   */
  pinnedEnvId?: string | null;
  /** For edit tabs: the rule uid being edited. */
  ruleUid?: string;
  /** Auto-generated draft name for non-rule create tabs (request-create,
   *  live-workflow-create, live-variable-create). Rule drafts no longer
   *  use this — `+ New Rule` mints a real entity at click time and the
   *  rule's own `name` field carries the placeholder. */
  draftName?: string;
  /** For collection/folder overview tabs: the entity uid. */
  entityId?: string;
  /** For template-edit tabs: the template uid. */
  templateUid?: string;
  /** For settings tabs: optional deep-link target key to scroll to on mount. */
  settingsInitialKey?: string;
  /** For settings tabs: optional deep-link target category to scroll to on mount. */
  settingsInitialCategory?: string;
  /**
   * For env-edit tabs: the environment uid being edited. For
   * collection-vars tabs: the collection uid being edited (separate
   * from `entityId` to keep the collection-overview / collection-vars
   * surfaces independent).
   */
  environmentUid?: string;
  /** For collection-vars tabs: the collection uid whose variables are being edited. */
  collectionUid?: string;
  /** For request-edit tabs: the Request uid being edited. For
   *  response-example tabs: the parent request's uid (drives the
   *  breadcrumb trail through the request tree). */
  requestUid?: string;
  /** For response-example tabs: the frozen example being viewed. */
  responseExampleUid?: string;
  /**
   * For request-create tabs minted by an example's "Try" action: the
   * source example's name at fork time. Chrome-only provenance — it
   * rides the tab tooltip and footer breadcrumb ("from ‹example›") and
   * is dropped when the draft is saved; the created Request carries no
   * provenance field.
   */
  seedFromExampleName?: string;
  /** For live-variable-edit tabs: the LV uid being edited. */
  liveVariableUid?: string;
  /** For live-workflow-edit tabs: the workflow uid being edited. */
  liveWorkflowUid?: string;
  /**
   * For live-workflow-create tabs opened from a Request's "Extract
   * variables to workflow → New workflow" action or the request tree's
   * "Create Workflow…" container action, and for live-workflow-edit
   * tabs opened from "Extract → Attach to <workflow>" (the editor
   * stages but does not persist a step per seed; the user reviews +
   * Saves as usual). Declared order = step order.
   */
  liveWorkflowSeedSteps?: WorkflowSeedStep[];
  /**
   * For request-create (draft) tabs opened from a specific collection
   * or folder in the sidebar. When set, Save persists directly there;
   * otherwise the SaveToCollectionModal prompts for a destination.
   * Rule create no longer uses these fields — `+ New Rule` mints the
   * entity directly via `applyRuleCreate(parentPath)` at click time.
   */
}

/**
 * Legacy three-booleans view of panel visibility. Retained because
 * StatusBar.tsx still speaks this vocabulary; App.tsx derives it from
 * the new WorkspaceLayout state machine via a small adapter. New code
 * should read `WorkspaceLayout` directly.
 */
export interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}

/**
 * Left-side panel keys. Top group panels open in the left Allotment pane;
 * bottom group panels open in the bottom Allotment pane. Only one key from
 * the top group and one key from the bottom group may be "active" at a
 * time (dockable tool-window model).
 *
 * Three left-top tool windows share the same slot and stack as tabs:
 *   - `http-workbench`   — rules + templates + environment quick-reference
 *   - `api-requests` — api-request collections + environment quick-reference
 *   - `variables`    — full variable management (vault, workspace-vars, envs)
 */
export type LeftPanelKey =
  | 'http-rules'
  | 'api-requests'
  | 'variables'
  | 'workflows'
  | 'workflow-status'
  | 'deep-network-inspection';

/**
 * Right-side panel keys — all shown in the right Allotment pane.
 * `var-scope` is the in-request / all-scopes variable resolution
 * inspector (historically ID'd as `variables`; renamed to avoid
 * collision with the left-pane `variables` management surface).
 */
export type RightPanelKey = 'docs' | 'var-scope';

/**
 * Which screen region the user is currently interacting with. Drives the
 * focus accent on activity-bar icons and panels. Null means
 * no region has been focused yet this session.
 */
export type FocusRegion = 'left' | 'right' | 'bottom' | 'editor' | null;

/**
 * Authoritative layout state for workbench.html. Replaces the old
 * PanelVisibility booleans. `leftPanel` and `rightPanel` are null when
 * collapsed; `bottomOpen` decouples bottom-panel visibility from which
 * left-bottom key drove it so the user can drag-collapse without losing
 * the selection.
 */
export interface WorkspaceLayout {
  leftPanel: LeftPanelKey | null;
  rightPanel: RightPanelKey | null;
  bottomOpen: boolean;
  focusedRegion: FocusRegion;
  /**
   * When false, activity-bar icons render without their text labels (narrow
   * ~36px strip). Toggled via the right-click context menu on either bar.
   */
  activityBarLabels: boolean;
}

/** Snapshot of a tab when it was closed, for "recently closed" recovery. */
export interface ClosedTab {
  tab: WorkbenchTab;
  closedAt: number;
}

// ── Dockable tool-window model ────────────────────────────────────────
//
// Shared dock types are defined in @openheaders/ui/shared/dock-layout and re-exported
// here for backwards compatibility. Workspace-specific types (ToolWindowId)
// stay here because they define which windows THIS surface has.

export type { DockSlot, SidebarLayoutVariant, ToolRegion } from '@openheaders/ui/shared/dock-layout';

import type {
  DockState as GenericDockState,
  ToolLayoutState as GenericToolLayoutState,
} from '@openheaders/ui/shared/dock-layout';

/** Identifiers for every tool window known to the extension shell. */
export type ToolWindowId =
  | 'http-rules'
  | 'api-requests'
  | 'variables'
  | 'workflows'
  | 'workflow-status'
  | 'docs'
  | 'var-scope'
  | 'deep-network-inspection'
  | 'activity'
  | 'notifications';

/** Runtime state for one dock, bound to workspace's ToolWindowId. */
export type DockState = GenericDockState<ToolWindowId>;

/** Full tool-window layout state, bound to workspace's ToolWindowId. */
export type ToolLayoutState = GenericToolLayoutState<ToolWindowId>;
