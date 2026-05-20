/**
 * Mode-switch orchestrator — Phase C M2b.
 *
 * Renderer-side bridge between the BackendPane dropdown and the
 * host-neutral decision logic in `@openheaders/oracle/sync`. Always
 * queries the local host via `oh.sync.getDataPresence`; the peer-side
 * query is dependency-injected so this module can ship before the
 * extension↔desktop bridge can route RPCs to a peer host. Until then,
 * omitting `queryPeerPresence` short-circuits the verdict to
 * `peer-unreachable` whenever data presence on the target matters.
 *
 * The peer query resolves both the target's data presence AND its home
 * `Org` (Phase U5.2 — the WELCOME carries it). The `Org` rides onto a
 * `show-dialog` verdict so the dialog's Combine / Use-Target executors
 * know which `Org` to re-home into.
 */

import { hostBridge } from '@openheaders/core/bridge';
import {
  type DataPresenceSummary,
  decideModeSwitch,
  type ModeSwitchVerdict,
  summarizeWorkspaces,
  type WorkspaceContentSnapshot,
} from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';

/**
 * Target-host probe result — the data-presence summary plus the
 * backend's home `Org` (`null` when the handshake carried none).
 */
export interface PeerPresenceProbe {
  readonly presence: DataPresenceSummary;
  readonly org: Org | null;
}

export interface ModeSwitchOrchestratorDeps {
  /**
   * Optional peer probe. Resolves to `null` when the peer can't be
   * reached (target host offline, bridge not yet routed). A `null`
   * always routes to `peer-unreachable` unless the source side is
   * empty.
   */
  readonly queryPeerPresence?: () => Promise<PeerPresenceProbe | null>;
  /**
   * Local-presence query. Defaults to `hostBridge.call('oh.sync.getDataPresence')`.
   * Override only in tests — production callers should use the default
   * so the renderer always reads through the same channel.
   */
  readonly queryLocalPresence?: () => Promise<{ workspaces: WorkspaceContentSnapshot[] }>;
}

async function defaultLocalQuery(): Promise<{ workspaces: WorkspaceContentSnapshot[] }> {
  return hostBridge.call('oh.sync.getDataPresence');
}

/**
 * Resolve peer presence via the SW's WS relay. Returns `null` for any
 * `available: false` shape (in-browser mode / target offline / relay
 * failure) so the orchestrator funnels those uniformly into
 * `peer-unreachable`. The relayed `getPeerDataPresence` channel carries
 * no `Org`, so `org` is always `null` on this path — callers that need
 * the target `Org` (the mode-switch dialog) probe directly instead.
 */
export async function queryPeerDataPresenceFromBridge(): Promise<PeerPresenceProbe | null> {
  try {
    const resp = await hostBridge.call('oh.sync.getPeerDataPresence');
    if (!resp.available) return null;
    return { presence: summarizeWorkspaces(resp.workspaces), org: null };
  } catch {
    return null;
  }
}

/**
 * Resolve a `ModeSwitchVerdict` for the dropdown change. Pure of UI —
 * the BackendPane consumes the verdict and decides whether to commit
 * the new mode silently, surface the dialog, or show a "connect peer
 * first" toast. Local-query failures degrade to an empty summary so the
 * silent commit path stays available; the user should never be
 * permanently blocked by a transient bridge hiccup.
 */
export async function requestModeSwitchVerdict(
  fromMode: string,
  toMode: string,
  deps: ModeSwitchOrchestratorDeps = {},
): Promise<ModeSwitchVerdict> {
  if (fromMode === toMode) return { kind: 'no-change' };

  const localQuery = deps.queryLocalPresence ?? defaultLocalQuery;
  let source: DataPresenceSummary;
  try {
    const { workspaces } = await localQuery();
    source = summarizeWorkspaces(workspaces);
  } catch {
    source = summarizeWorkspaces([]);
  }

  const probe = deps.queryPeerPresence ? await deps.queryPeerPresence().catch(() => null) : null;

  return decideModeSwitch({
    fromMode,
    toMode,
    source,
    target: probe?.presence ?? null,
    targetOrg: probe?.org ?? null,
  });
}
