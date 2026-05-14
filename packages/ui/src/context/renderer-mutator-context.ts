/**
 * Renderer-side HLC sequencer + `MutatorContext` factory (Phase A
 * Fw9).
 *
 * Mirrors {@link sw-context.ts}: every renderer surface (workbench tab,
 * popup, devpanel) gets its own `nodeId` so total ordering across
 * surfaces falls out of `compareHlc`'s `(physical, logical, nodeId)`
 * tuple. The nodeId is regenerated on each surface lifetime — Phase A
 * is single-device, so no cross-eviction stability is needed.
 *
 * The factory is a per-surface singleton: every write helper inside one
 * renderer page emits through the same sequencer so its envelopes
 * monotonically advance in HLC. A fresh tab opens a fresh sequencer.
 */

import {
  advanceHlc,
  createDefaultWallClock,
  type HLC,
  initialHlc,
  type MutatorContext,
} from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';

export interface RendererContextOptions {
  /** Override the default surfaceId (defaults to whatever the factory
   *  was constructed with). Useful when a single tab hosts multiple
   *  attribution sources (e.g. workbench + inline devpanel popover). */
  surfaceId?: string;
  /** Bundle multiple intents under one batchId. Carries through to the
   *  oracle's per-batch all-or-nothing semantics. */
  batchId?: string;
  /** Observe an inbound HLC (e.g. from a remote envelope) so the
   *  sequencer's next emission strictly succeeds it. */
  observed?: HLC;
}

export interface RendererContextHandle {
  /** Mint a fresh `MutatorContext` for one envelope (or one batch
   *  when `opts.batchId` is set). */
  next(opts?: RendererContextOptions): MutatorContext;
  peekHlc(): HLC;
  readonly nodeId: string;
  readonly surfaceId: string;
  readonly workspaceId: string;
}

export interface CreateRendererContextOptions {
  workspaceId: string;
  /** Surface attribution carried on every emitted envelope. Common
   *  values: `'workbench'`, `'popup'`, `'devpanel'`. */
  surfaceId: string;
}

export function createRendererContextHandle(opts: CreateRendererContextOptions): RendererContextHandle {
  const clock = createDefaultWallClock();
  const nodeId = `${opts.surfaceId}-${generateUid()}`;
  let hlc: HLC = initialHlc(nodeId, clock.now());

  return {
    nodeId,
    surfaceId: opts.surfaceId,
    workspaceId: opts.workspaceId,
    peekHlc: () => hlc,
    next(callOpts = {}): MutatorContext {
      hlc = advanceHlc(hlc, clock.now(), callOpts.observed);
      return {
        workspaceId: opts.workspaceId,
        hlc,
        surfaceId: callOpts.surfaceId ?? opts.surfaceId,
        deviceId: nodeId,
        ...(callOpts.batchId ? { batchId: callOpts.batchId } : {}),
      };
    },
  };
}

// ── Per-surface singleton ────────────────────────────────────────────
//
// One handle per surface. The active workspaceId can change underneath
// us (workspace switch) — when it does the renderer rebuilds the
// handle. We keep the singleton so write helpers don't have to thread
// it through every component prop.

let active: RendererContextHandle | null = null;

export function setActiveRendererContext(handle: RendererContextHandle | null): void {
  active = handle;
}

export function getActiveRendererContext(): RendererContextHandle | null {
  return active;
}

/**
 * Build a handle if none is active yet, or rebuild when the
 * workspace / surface attribution changes. Idempotent for an already
 * matching handle.
 */
export function ensureRendererContext(opts: CreateRendererContextOptions): RendererContextHandle {
  if (active && active.workspaceId === opts.workspaceId && active.surfaceId === opts.surfaceId) {
    return active;
  }
  active = createRendererContextHandle(opts);
  return active;
}

// ── Global-scope per-surface singleton ───────────────────────────────
//
// Global-scope entities (ExtensionWorkspace) carry the sentinel
// `EXTENSION_WORKSPACE_GLOBAL_SCOPE` as their `workspaceId`. Their
// sequencer is independent of the per-workspace one — workspace
// switches must not reset the global HLC stream, and global writes
// must not interleave HLCs with per-workspace writes.

import { EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';

export interface CreateGlobalRendererContextOptions {
  /** Surface attribution carried on every emitted envelope. Common
   *  values: `'workbench'`, `'popup'`, `'devpanel'`. */
  surfaceId: string;
}

let activeGlobal: RendererContextHandle | null = null;

export function ensureGlobalRendererContext(
  opts: CreateGlobalRendererContextOptions,
): RendererContextHandle {
  if (activeGlobal && activeGlobal.surfaceId === opts.surfaceId) {
    return activeGlobal;
  }
  activeGlobal = createRendererContextHandle({
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    surfaceId: opts.surfaceId,
  });
  return activeGlobal;
}

export function getActiveGlobalRendererContext(): RendererContextHandle | null {
  return activeGlobal;
}

export function setActiveGlobalRendererContext(handle: RendererContextHandle | null): void {
  activeGlobal = handle;
}
