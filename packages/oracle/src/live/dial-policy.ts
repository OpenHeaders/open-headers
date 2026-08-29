/**
 * The dial policy one session dial carries — the executor-side twin of
 * the request kinds' shared `DialPolicy` fields: the resolve-to-address
 * pin and the request-plane proxy trio (mode · URL · credential ref),
 * the credential resolved from the vault. One composer for the
 * WebSocket, gRPC and MQTT executors (the HTTP resolver composes its
 * own resolved shape but shares the credential step), so every session
 * hands its transport the same keys with the same absent-means-default
 * discipline — the TLS policy composer's sibling.
 */

import type { DialPolicy, ProxyMode, Vault } from '@openheaders/core/types';

export interface ResolvedProxyCredential {
  /** The vault entry NAME — always passes through when set, even
   *  unresolved, so the honoring transport fails the dial loudly
   *  instead of silently dialing the proxy unauthenticated. */
  proxyCredentialRef?: string;
  /** The `user:password` value, present only when a string entry with
   *  that name exists on this device. */
  proxyCredential?: string;
}

/** The policy slice a session transport request carries. */
export interface SessionDialPolicy extends ResolvedProxyCredential {
  resolveToAddress?: string;
  proxyMode?: ProxyMode;
  proxyUrl?: string;
}

/**
 * Resolve a `proxyCredentialRef` against the local vault. Same contract
 * as the client-certificate step: the ref always passes through when
 * set — even unresolved — so the honoring transport can fail the dial
 * loudly; the `user:password` value attaches only when a string entry
 * with that name exists on this device. A host-injected resolution
 * carries no vault: the ref then passes through bare.
 */
export function resolveProxyCredential(ref: string | undefined, vault: Vault | undefined): ResolvedProxyCredential {
  if (ref === undefined) return {};
  const entry = vault?.secrets.find((s) => s.kind === 'string' && s.name === ref);
  if (entry?.kind !== 'string') return { proxyCredentialRef: ref };
  return { proxyCredentialRef: ref, proxyCredential: entry.value };
}

/**
 * Compose the transport-facing dial policy: only the knobs the request
 * set ride (absent = inherit the host's system plane / system DNS),
 * the credential ref resolves to its value.
 */
export function sessionDialPolicy(request: DialPolicy, vault: Vault | undefined): SessionDialPolicy {
  return {
    ...(request.resolveToAddress !== undefined ? { resolveToAddress: request.resolveToAddress } : {}),
    ...(request.proxyMode !== undefined ? { proxyMode: request.proxyMode } : {}),
    ...(request.proxyUrl !== undefined ? { proxyUrl: request.proxyUrl } : {}),
    ...resolveProxyCredential(request.proxyCredentialRef, vault),
  };
}

const SESSION_DIAL_POLICY_KEYS = [
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'proxyCredential',
] as const;

/** The policy slice of a wider params object, defined keys only — a
 *  composed policy re-seated on a transport request downstream. */
export function pickSessionDialPolicy(source: SessionDialPolicy): SessionDialPolicy {
  const out: Record<string, unknown> = {};
  for (const key of SESSION_DIAL_POLICY_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out as SessionDialPolicy;
}
