/**
 * MQTT page-session resolution — the seam between the workbench React
 * tree (which owns the renderer variable scopes) and a host that
 * executes MQTT sessions IN the page realm (the extension's
 * `mqttPageSession` capability). The `ws-page-session.ts` sibling,
 * kept in lock-step with it: the oracle executor is host-neutral but
 * its own resolver reads the oracle module mirrors, which are empty in
 * a page realm — so the editor PUBLISHES a resolution factory built
 * from the renderer scope snapshot, and the page host injects its
 * product into `executeMqttSession` (`options.resolution` +
 * `options.authChain` + `options.scriptChain` — the ancestor pool and
 * script chains the oracle walk cannot derive in a page realm) and
 * publishes the scope the session's script hooks answer against.
 *
 * Single-publisher module slot (the awareness-publisher discipline):
 * the MQTT editor republishes on every scope change while mounted; the
 * host reads the CURRENT factory at Connect time. No editor mounted ⇒
 * nothing can Connect ⇒ a stale slot is unreachable.
 *
 * The factory builds an EXECUTION-posture resolver: default `'reject'`
 * vault mode plus a freshly computed TOTP registry — never the display
 * surfaces' `'defer'` mode, which substitutes an empty placeholder
 * where a live code belongs.
 */

import type { AuthCarrier } from '@openheaders/core/auth-inheritance';
import type { ScriptPackageModule } from '@openheaders/core/scripts';
import type { SettingsCarrier } from '@openheaders/core/settings-inheritance';
import { generateTotp } from '@openheaders/core/totp';
import type { MqttRequest, Vault, VaultSecretTotp } from '@openheaders/core/types';
import type { TotpRegistry } from '@openheaders/core/variables';
import {
  buildRendererResolver,
  type RendererResolverInputs,
} from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import {
  type AncestorScriptCarrier,
  authChainOf,
  findRequestAncestry,
  type RequestAncestryInputs,
  scriptChainOf,
  settingsChainOf,
} from '../request-container/ancestry';
import { buildPageScriptScope, type PageScriptScope } from '../shared/page-script-scope';

/** The executor's injected-resolution contract
 *  (`ExecuteMqttSessionOptions.resolution`). */
export type MqttPageResolution = (template: string, unresolved: Set<string>) => string;

/** What the page host injects into the executor per Connect: the
 *  template resolution plus the ancestor auth, script and settings
 *  chains (outer → inner) the oracle walk cannot derive in a page
 *  realm, and the scope the session's hooks answer against. */
export interface MqttPageSessionScope {
  resolve: MqttPageResolution;
  authChain: AuthCarrier[];
  scriptChain: AncestorScriptCarrier[];
  /** The ancestor settings carriers (outer → inner) — the per-knob
   *  cascade the session's Settings knobs resolve over. */
  settingsChain: SettingsCarrier[];
  scripts: PageScriptScope;
  /** The workspace the session runs under — the scope the hooks' writes
   *  land in (the page realm has no active-workspace hook of its own). */
  workspaceId: string | null;
}

/** Built per Connect — TOTP codes have ~30s lifetime, so the registry
 *  computes fresh each time (the SW request executor's discipline). */
export type MqttPageResolutionFactory = (request: MqttRequest) => Promise<MqttPageSessionScope>;

let currentFactory: MqttPageResolutionFactory | null = null;

export function publishMqttPageResolutionFactory(factory: MqttPageResolutionFactory): void {
  currentFactory = factory;
}

export function getMqttPageResolutionFactory(): MqttPageResolutionFactory | null {
  return currentFactory;
}

/**
 * Precompute the current code for every kind:'totp' vault entry — the
 * SW request executor's `buildTotpRegistry` twin (keep in lock-step
 * with `background/modules/request-executor/scope.ts` and the
 * ws-page-session sibling). Entries whose seed fails to decode are
 * skipped; the resolver surfaces them as `unset-in-scope` and the
 * Connect gate reports the unresolved name.
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
 *  scope, the auth chain and the script chain all come off the TREES
 *  via the request's ancestry (the tree containment law — never the
 *  stored path); the environment defers to the active pointer the
 *  snapshot carries — the in-process Connect path. `packages` is the
 *  workspace's Package Library — the hooks' `oh.require`. */
export function makeMqttPageResolutionFactory(
  inputs: RendererResolverInputs,
  ancestryInputs: RequestAncestryInputs,
  workspaceId: string | null,
  packages: readonly ScriptPackageModule[] = [],
): MqttPageResolutionFactory {
  return async (request) => {
    const resolver = buildRendererResolver(inputs, { totpRegistry: await buildPageTotpRegistry(inputs.vault) });
    const ancestry = findRequestAncestry(
      ancestryInputs.collectionTrees,
      ancestryInputs.collections,
      ancestryInputs.folders,
      request.uid,
    );
    const context = ancestry !== null ? { collectionId: ancestry.collection.uid } : {};
    const resolve: MqttPageResolution = (template, unresolved) => {
      const result = resolver.resolveTemplate(template, context);
      for (const v of result.variables) {
        if (!v.resolved) unresolved.add(v.name);
      }
      return result.result;
    };
    return {
      resolve,
      authChain: ancestry !== null ? authChainOf(ancestry) : [],
      scriptChain: ancestry !== null ? scriptChainOf(ancestry) : [],
      settingsChain: ancestry !== null ? settingsChainOf(ancestry) : [],
      scripts: buildPageScriptScope(resolver, context, inputs, workspaceId, packages),
      workspaceId,
    };
  };
}
