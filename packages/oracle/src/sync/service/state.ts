/**
 * Sync service — module state: the resident-service map, the Active
 * pointer, the disposal grace window, and the wiring-deps factory.
 * Reassignment stays here; other modules read the live bindings and
 * mutate through the setters.
 */

import { productionDepsFactory } from './build';
import type { WireDepsFactory, WorkspaceServiceState } from './types';

export const services = new Map<string, WorkspaceServiceState>();

/** Workspace whose caches are currently registered as the per-entity singletons. */
export let currentActive: string | null = null;

export function setCurrentActive(workspaceId: string | null): void {
  currentActive = workspaceId;
}

/**
 * Disposal grace period for {@link releaseWorkspaceService}. Tests set
 * this to 0 via {@link __initSyncServiceForTests} so disposal is
 * synchronous and teardown assertions remain straightforward.
 */
export let graceMs = 30_000;

export function setGraceMs(ms: number): void {
  graceMs = ms;
}

/**
 * Active dependency factory. Production initializes at module load;
 * {@link __initSyncServiceForTests} swaps it for in-memory deps.
 */
export let depsFactory: WireDepsFactory = productionDepsFactory;

export function setDepsFactory(factory: WireDepsFactory): void {
  depsFactory = factory;
}
