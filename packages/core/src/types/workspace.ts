/**
 * Workspace manifest (workspace.yaml).
 *
 *   schemaVersion: 5
 *   uid: a1b2c3d4                  # workspace identity, stable across renames
 *   name: My API Project
 *   description: …
 *   defaultEnvironmentId: …        # optional; resolver falls back here when active env lacks a var
 *   rootPath: …                    # runtime-only (desktop absolute path); codec strips on serialize
 *
 * The workspace IS a git repo (when synced via desktop/team). The manifest
 * is one of several versioned entities — every persisted YAML file carries
 * its own `schemaVersion`, so migrations can target a single entity kind
 * without rewriting the whole tree. Starts at 5 to align with the v5 brand;
 * future breaking changes bump per-entity (6, 7, …). See
 * docs/V5_FOUNDATION_PLAN.md §Phase 0.
 *
 * `Workspace` is derived from `WorkspaceSchema` so the runtime validator
 * and the type stay locked together. `rootPath` is optional here to match
 * the parsed-from-disk form (the codec strips it on serialize); callers
 * that operate on the in-memory form populate `rootPath` after parse and
 * must narrow with a guard.
 */

import type * as v from 'valibot';
import type { WorkspaceSchema } from '../schemas/workspace';

/**
 * Top-level sections that organize collections within a workspace.
 * Each section corresponds to a directory on disk and a sidebar panel.
 */
export type WorkspaceSection = 'requests' | 'rules' | 'environments' | 'recordings' | 'proxy-rules';

export type Workspace = v.InferOutput<typeof WorkspaceSchema>;
