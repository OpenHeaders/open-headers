/**
 * The install readings a storage-backed host takes at flush time (the
 * v2 plan §3) — the desktop main process and the extension service
 * worker read the same `HostStorage` slots the workbench writes, so the
 * reading is written once here. Every reader is best-effort: a slot
 * that fails to read omits its member rather than misreporting.
 *
 * - `rules`: the runtime-active workspace's rule projection (S31 — the
 *   slot the popup writes); `workspaces`: the workspace list. The list
 *   and the active pointer come from the host's workspace STORE
 *   (`options.workspaces`), never from the store's storage mirror: the
 *   mirror is written only once the sync engine seeds, which on a fresh
 *   install is after the first flush, and a seed-on-empty host is never
 *   without a workspace once its store is bootstrapped.
 * - `requests`: the saved requests across EVERY workspace, every
 *   protocol — the API-client half of the product.
 * - `sync`: the install-wide maximum (S35): a connection record to
 *   anything but the desktop app's own loopback wire is a server; a
 *   workspace bound to a working tree is git; else local.
 * - `role` and `team`: read from the directory grants this host HOLDS
 *   (`OH.workspaceRoleAssignments` carries every principal's rows on a
 *   host that runs a directory). A foreign principal's grant means the
 *   operator shared a workspace they own — `owner`, and the team is the
 *   largest workspace's distinct principals. A host holding no foreign
 *   grant but joined to a server knows neither (the server holds its
 *   grant) and omits both; a host with neither is a solo install.
 */

import { isDesktopAppBackendUrl } from '../backends/registry';
import { getIdentitySnapshot } from '../identity/registry';
import type { HostStorage } from '../storage/host-storage';
import { OH, type StorageKey, wsKeys } from '../storage/keys';
import type { ProductTelemetryHostReadings } from './install-state';
import { resolveTelemetrySyncKind } from './vocabulary/mappers';

/** The host's workspace store as it stands at the reading: the list and the active pointer. */
export interface HostWorkspaceReading {
  list: readonly { id: string }[];
  activeId: string | null;
}

export interface HostReadingsOptions {
  /** Whether this host can bind a workspace to a working tree; the extension never does. */
  git: boolean;
  /**
   * The host's workspace store, read at flush time. An empty list means
   * the store is not bootstrapped yet (a seed-on-empty host never holds
   * zero once it is), so the scale is omitted rather than read as zero.
   */
  workspaces: () => HostWorkspaceReading;
}

type Storage = Pick<HostStorage, 'get'>;

async function count<T>(storage: Storage, key: StorageKey<T[]>): Promise<number> {
  return ((await storage.get(key)) ?? []).length;
}

async function readScale(
  storage: Storage,
  options: HostReadingsOptions,
): Promise<Pick<ProductTelemetryHostReadings, 'rules' | 'requests' | 'workspaces'>> {
  try {
    const { list: workspaces, activeId } = options.workspaces();
    if (workspaces.length === 0) return {};
    const rules = await count(storage, wsKeys(activeId ?? workspaces[0].id).rules);
    let requests = 0;
    for (const workspace of workspaces) {
      const keys = wsKeys(workspace.id);
      requests += await count(storage, keys.requests);
      requests += await count(storage, keys.grpcRequests);
      requests += await count(storage, keys.websocketRequests);
      requests += await count(storage, keys.mqttRequests);
      requests += await count(storage, keys.graphqlRequests);
    }
    return { rules, requests, workspaces: workspaces.length };
  } catch {
    return {};
  }
}

async function readServerBackend(storage: Storage): Promise<boolean> {
  const backends = (await storage.get(OH.backends)) ?? [];
  return backends.some((backend) => !isDesktopAppBackendUrl(backend.url));
}

async function readSync(
  storage: Storage,
  options: HostReadingsOptions,
): Promise<Pick<ProductTelemetryHostReadings, 'sync'>> {
  try {
    const bindings = options.git ? ((await storage.get(OH.workspaceTreeBindings)) ?? []) : [];
    return { sync: resolveTelemetrySyncKind({ server: await readServerBackend(storage), git: bindings.length > 0 }) };
  } catch {
    return {};
  }
}

async function readDirectory(storage: Storage): Promise<Pick<ProductTelemetryHostReadings, 'role' | 'team'>> {
  try {
    const grants = (await storage.get(OH.workspaceRoleAssignments)) ?? [];
    const self = getIdentitySnapshot()?.principal.id;
    const foreign = grants.filter((grant) => grant.principalId !== self);
    if (foreign.length > 0) {
      const members = new Map<string, Set<string>>();
      for (const grant of grants) {
        const set = members.get(grant.workspaceId) ?? new Set<string>();
        set.add(grant.principalId);
        members.set(grant.workspaceId, set);
      }
      return { role: 'owner', team: Math.max(...[...members.values()].map((set) => set.size)) };
    }
    return (await readServerBackend(storage)) ? {} : { role: 'none', team: 1 };
  } catch {
    return {};
  }
}

/** Everything a storage-backed host can read of its install; the host adds what only it knows (the plan). */
export async function readHostReadingsFromStorage(
  storage: Storage,
  options: HostReadingsOptions,
): Promise<ProductTelemetryHostReadings> {
  return {
    ...(await readScale(storage, options)),
    ...(await readSync(storage, options)),
    ...(await readDirectory(storage)),
  };
}
