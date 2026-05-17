/**
 * Mode-switch orchestrator — Phase C M2b.
 *
 * Renderer-side bridge between the BackendPane dropdown and the
 * host-neutral decision logic in `@openheaders/oracle/sync`. Always
 * queries the local host via `oh.sync.getDataPresence`; the peer-side
 * query is dependency-injected so this module can ship before the
 * extension↔desktop bridge can route RPCs to a peer host (M2c+ plumbs
 * that). Until then, omitting `queryPeerPresence` short-circuits the
 * verdict to `peer-unreachable` whenever data presence on the target
 * matters — the caller surfaces a "Connect the target first" toast.
 */

import { hostBridge } from '@openheaders/core/bridge';
import {
  decideModeSwitch,
  summarizeWorkspaces,
  type DataPresenceSummary,
  type ModeSwitchVerdict,
  type WorkspaceContentSnapshot,
} from '@openheaders/core/sync';

export interface ModeSwitchOrchestratorDeps {
  /**
   * Optional peer-presence query. Resolves to `null` when the peer can't
   * be reached (target host offline, bridge not yet routed). The
   * orchestrator passes the resolved value straight through to
   * `decideModeSwitch`; a `null` always routes to `peer-unreachable`
   * unless the source side is empty.
   */
  readonly queryPeerPresence?: () => Promise<DataPresenceSummary | null>;
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
 * `peer-unreachable`. Production BackendPane wiring passes this as
 * `queryPeerPresence`; tests inject their own callbacks instead so the
 * default never fires under vitest mocks.
 */
export async function queryPeerDataPresenceFromBridge(): Promise<DataPresenceSummary | null> {
  try {
    const resp = await hostBridge.call('oh.sync.getPeerDataPresence');
    if (!resp.available) return null;
    return summarizeWorkspaces(resp.workspaces);
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

  const target = deps.queryPeerPresence ? await deps.queryPeerPresence().catch(() => null) : null;

  return decideModeSwitch({ fromMode, toMode, source, target });
}
