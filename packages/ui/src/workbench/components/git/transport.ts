/**
 * The workspace-tree transport seam shared by every git surface (the
 * settings card, the daemon admin console's Git section, the workbench
 * Git tool window): a typed call identical in shape to
 * `hostBridge.call` narrowed to the `oh.workspaceTree.*` channels, so a
 * remote transport (the admin console's gated dispatch wrapper) slots
 * in without the surface knowing which daemon answers.
 */

import {
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  hostBridge,
} from '@openheaders/core/bridge';

/** The workspace-tree slice of the bridge contract git surfaces drive. */
export type WorkspaceTreeRpcType = Extract<BridgeRpcType, `oh.workspaceTree.${string}`>;

export type WorkspaceTreeTransport = <K extends WorkspaceTreeRpcType>(
  type: K,
  ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
) => Promise<BridgeRpcResponse<K>>;

export const localWorkspaceTreeTransport: WorkspaceTreeTransport = (type, ...args) => hostBridge.call(type, ...args);
