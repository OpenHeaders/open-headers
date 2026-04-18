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
 *
 * Shapes are derived from `ExtensionWorkspaceSchema` +
 * `ExtensionWorkspaceSourceSchema` so the runtime validator and the
 * type stay in lockstep.
 */

import type * as v from 'valibot';
import type {
  ExtensionWorkspaceKindSchema,
  ExtensionWorkspaceSchema,
  ExtensionWorkspaceSourceSchema,
} from '../../schemas/workspace';

export type ExtensionWorkspaceKind = v.InferOutput<typeof ExtensionWorkspaceKindSchema>;
export type ExtensionWorkspace = v.InferOutput<typeof ExtensionWorkspaceSchema>;
export type ExtensionWorkspaceSource = v.InferOutput<typeof ExtensionWorkspaceSourceSchema>;
