/**
 * gRPC page-invoke resolution — the seam between the workbench React
 * tree (which owns the renderer variable scopes and the specs mirror)
 * and a host that executes gRPC calls IN the page realm over a
 * delegating transport (the extension's `delegatedGrpcDispatch`
 * capability). The WebSocket page-session seam's twin, built on the
 * same factory: the editor PUBLISHES a factory from the renderer scope
 * snapshot, and the page host injects its product into
 * `executeGrpcInvoke` — the template resolution, the ancestor auth,
 * script and settings chains, the scope the hooks answer against —
 * plus the draft's linked Protobuf spec off the page's mirror, which
 * the executor needs to build the registry and encode the message
 * (the place receives the encoded call and holds no spec).
 *
 * Single-publisher module slot (the awareness-publisher discipline):
 * the gRPC editor republishes on every scope change while mounted;
 * the host reads the CURRENT factory at Invoke time. No editor
 * mounted ⇒ nothing can Invoke ⇒ a stale slot is unreachable.
 */

import type { ScriptPackageModule } from '@openheaders/core/scripts';
import type { GrpcRequest, Spec } from '@openheaders/core/types';
import type { RendererResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import type { RequestAncestryInputs } from '../request-container/ancestry';
import { makeWsPageResolutionFactory, type WsPageSessionScope } from '../websocket-request-editor/ws-page-session';

/** What the page host injects into the executor per Invoke: the
 *  session scope's contract plus the linked spec's live entity. */
export interface GrpcPageInvokeScope extends WsPageSessionScope {
  /** The draft's linked Protobuf spec; null when it links none or the
   *  spec is gone (the executor names the gap). */
  spec: Spec | null;
}

/** Built per Invoke — TOTP codes have ~30s lifetime, so the registry
 *  computes fresh each time (the session factory's discipline). */
export type GrpcPageInvokeFactory = (request: GrpcRequest) => Promise<GrpcPageInvokeScope>;

let currentFactory: GrpcPageInvokeFactory | null = null;

export function publishGrpcPageInvokeFactory(factory: GrpcPageInvokeFactory): void {
  currentFactory = factory;
}

export function getGrpcPageInvokeFactory(): GrpcPageInvokeFactory | null {
  return currentFactory;
}

/** Build the factory from one renderer scope snapshot and the
 *  workspace's Protobuf specs — the session factory underneath, the
 *  linked spec looked up by the draft's ids-only link. */
export function makeGrpcPageInvokeFactory(
  inputs: RendererResolverInputs,
  ancestryInputs: RequestAncestryInputs,
  workspaceId: string | null,
  packages: readonly ScriptPackageModule[],
  specs: readonly Spec[],
): GrpcPageInvokeFactory {
  const sessionScope = makeWsPageResolutionFactory(inputs, ancestryInputs, workspaceId, packages);
  return async (request) => {
    const scope = await sessionScope(request);
    const specUid = request.specLink?.specUid;
    const spec = specUid !== undefined ? (specs.find((s) => s.uid === specUid) ?? null) : null;
    return { ...scope, spec };
  };
}
