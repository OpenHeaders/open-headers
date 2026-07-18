/**
 * WebSocket page-session resolution — the seam between the workbench
 * React tree (which owns the renderer variable scopes) and a host that
 * executes WebSocket sessions IN the page realm (the extension's
 * `wsPageSession` capability). The oracle executor is host-neutral but
 * its own resolver reads the oracle module mirrors, which are empty in
 * a page realm — so the editor PUBLISHES a resolution factory built
 * from the renderer scope snapshot, and the page host injects its
 * product into `executeWsSession` (`options.resolution`).
 *
 * Single-publisher module slot (the awareness-publisher discipline):
 * the WebSocket editor republishes on every scope change while
 * mounted; the host reads the CURRENT factory at Connect time. No
 * editor mounted ⇒ nothing can Connect ⇒ a stale slot is unreachable.
 *
 * The factory builds an EXECUTION-posture resolver: default `'reject'`
 * vault mode plus a freshly computed TOTP registry — never the display
 * surfaces' `'defer'` mode, which substitutes an empty placeholder
 * where a live code belongs.
 */

import { generateTotp } from '@openheaders/core/totp';
import type { Vault, VaultSecretTotp, WebSocketRequest } from '@openheaders/core/types';
import type { TotpRegistry } from '@openheaders/core/variables';
import {
  buildRendererResolver,
  type RendererResolverInputs,
} from '@openheaders/ui/shared/hooks/variables/useVariableResolver';

/** The executor's injected-resolution contract
 *  (`ExecuteWsSessionOptions.resolution`). */
export type WsPageResolution = (template: string, unresolved: Set<string>) => string;

/** Built per Connect — TOTP codes have ~30s lifetime, so the registry
 *  computes fresh each time (the SW request executor's discipline). */
export type WsPageResolutionFactory = (request: WebSocketRequest) => Promise<WsPageResolution>;

let currentFactory: WsPageResolutionFactory | null = null;

export function publishWsPageResolutionFactory(factory: WsPageResolutionFactory): void {
  currentFactory = factory;
}

export function getWsPageResolutionFactory(): WsPageResolutionFactory | null {
  return currentFactory;
}

/**
 * Precompute the current code for every kind:'totp' vault entry — the
 * SW request executor's `buildTotpRegistry` twin (keep in lock-step
 * with `background/modules/request-executor/scope.ts`). Entries whose
 * seed fails to decode are skipped; the resolver surfaces them as
 * `unset-in-scope` and the Connect gate reports the unresolved name.
 */
async function buildPageTotpRegistry(vault: Vault): Promise<TotpRegistry> {
  const totpEntries = vault.secrets.filter((s): s is VaultSecretTotp => s.kind === 'totp');
  if (totpEntries.length === 0) return new Map();
  const codes = await Promise.all(
    totpEntries.map(async (e) => {
      try {
        const code = await generateTotp({
          seed: e.seed,
          algorithm: e.algorithm,
          digits: e.digits,
          period: e.period,
        });
        return [e.name, code] as const;
      } catch {
        return null;
      }
    }),
  );
  const out = new Map<string, string>();
  for (const entry of codes) {
    if (entry) out.set(entry[0], entry[1]);
  }
  return out;
}

/** Build the factory from one renderer scope snapshot. The collection
 *  scope resolves by the same path-prefix membership the oracle
 *  executor uses; the environment defers to the active pointer the
 *  snapshot carries — the in-process Connect path. */
export function makeWsPageResolutionFactory(inputs: RendererResolverInputs): WsPageResolutionFactory {
  return async (request) => {
    const resolver = buildRendererResolver(inputs, { totpRegistry: await buildPageTotpRegistry(inputs.vault) });
    const collectionId = inputs.collections.requestCollections.find((c) => request.path.startsWith(`${c.path}/`))?.uid;
    const context = collectionId !== undefined ? { collectionId } : {};
    return (template, unresolved) => {
      const result = resolver.resolveTemplate(template, context);
      for (const v of result.variables) {
        if (!v.resolved) unresolved.add(v.name);
      }
      return result.result;
    };
  };
}
