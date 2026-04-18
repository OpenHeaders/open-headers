/**
 * Extension-side workspace record.
 *
 * Represents a single workspace the user has created or connected to in
 * the browser extension. Distinct from {@link Workspace}, which models
 * the desktop app's on-disk workspace.yaml manifest.
 *
 * Two kinds:
 *   - 'personal' — stored entirely in chrome.storage.local under
 *     oh.ws.<id>.*; no external dependencies. All CRUD is synchronous
 *     against local storage.
 *   - 'team' — mirror of a git-backed workspace managed by the desktop
 *     app. Extension holds a read-cache (read-only when desktop is
 *     offline); writes forward through the WebSocket to desktop, which
 *     owns YAML I/O and git. Creation of team workspaces happens in the
 *     desktop app, not the extension. Reserved for v2 — stubbed here so
 *     the type shape is stable from day 1.
 */
export type ExtensionWorkspaceKind = 'personal' | 'team';

export interface ExtensionWorkspace {
  /** Stable identity; generated on create, never changes. */
  id: string;
  /** Which storage/sync model backs this workspace. */
  kind: ExtensionWorkspaceKind;
  /** Display name. Freely renamed; never used for identity or entity links. */
  name: string;
  description?: string;
  /**
   * Workspace prefix indicator. Exactly one of the two rendering
   * modes — never both — so users can choose a minimal color square
   * OR a tinted icon without cluttering the UI with two visual
   * markers.
   *
   *   - `icon` unset  → render a plain color square filled with
   *                     `color` (or a neutral border token if color
   *                     is also unset).
   *   - `icon` set    → render the TwoTone icon with `color` applied
   *                     as its two-tone primary. The standalone
   *                     square is NOT drawn in this mode.
   *
   * `color` is a palette key (e.g. "blue", "neutral") resolved by
   * the UI's `resolveWorkspaceColor` helpers.
   * `icon` is a TwoTone registry key (e.g. "AppstoreTwoTone")
   * resolved through `TwoToneIconPicker`'s registry.
   */
  color?: string;
  icon?: string;
  /**
   * User-controlled ordering in the workspace switcher. Lower values
   * sort first; ties broken by createdAt ascending.
   */
  sortIndex: number;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. Bumped on any mutation of the entity. */
  updatedAt: string;
  /**
   * Team-workspace backing descriptor. Present only when kind === 'team'.
   * v1 wires only personal; this field is reserved for the desktop sync
   * work in v2.
   */
  source?: ExtensionWorkspaceSource;
}

export interface ExtensionWorkspaceSource {
  /** Stable desktop-side workspace identifier the extension mirrors. */
  desktopWorkspaceId: string;
  /** Display-only path shown in the UI; never used for I/O. */
  displayPath?: string;
}
