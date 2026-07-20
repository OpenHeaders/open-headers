/**
 * Per-host leaf `SecureContext` cache for the MITM terminator.
 *
 * The proxy presents a locally-minted, CA-signed leaf for each decrypted
 * host (`PROXY_SECURITY.md` §2.7 — short-lived per-host leaves off the
 * per-machine CA). Minting is asynchronous and moderately expensive
 * (WebCrypto keygen + signature), so contexts are cached per host and
 * re-minted only once a leaf ages past {@link LEAF_REFRESH_MAX_AGE_MS} —
 * comfortably inside the 7-day leaf validity, so a served context is
 * always well within its notAfter.
 *
 * The cache holds no private key beyond the built `SecureContext`; the
 * leaf key is ephemeral per mint and never persisted.
 */

import { createSecureContext, type SecureContext } from 'node:tls';
import type { ProxyCaRecord } from '@openheaders/core/types';
import { mintLeafCertificate } from './ca-store';

/** Re-mint a host's leaf once its cached context is older than this. */
export const LEAF_REFRESH_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000;

interface CachedContext {
  context: SecureContext;
  mintedAtMs: number;
}

/** Wrap a base64 PKCS#8 key body as a PEM private key. */
function pkcs8PemFromB64(b64: string): string {
  const body = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

export interface LeafContextCacheOptions {
  readonly now?: () => number;
}

/**
 * Builds and caches `SecureContext`s for decrypted hosts. Constructed
 * once per proxy run with the resolved CA record; a new run (or a CA
 * change) means a fresh cache.
 */
export class LeafContextCache {
  private readonly ca: ProxyCaRecord;
  private readonly now: () => number;
  private readonly byHost = new Map<string, CachedContext>();

  constructor(ca: ProxyCaRecord, options: LeafContextCacheOptions = {}) {
    this.ca = ca;
    this.now = options.now ?? Date.now;
  }

  /** The CA cert PEM, appended to each leaf so clients receive the chain. */
  private get caCertPem(): string {
    return this.ca.certPem;
  }

  async contextForHost(host: string): Promise<SecureContext> {
    const cached = this.byHost.get(host);
    if (cached !== undefined && this.now() - cached.mintedAtMs < LEAF_REFRESH_MAX_AGE_MS) {
      return cached.context;
    }
    const leaf = await mintLeafCertificate(this.ca, [host], undefined, this.now);
    const context = createSecureContext({
      key: pkcs8PemFromB64(leaf.privateKeyPkcs8B64),
      // Leaf first, CA second — the standard server chain order.
      cert: `${leaf.certPem}\n${this.caCertPem}`,
    });
    this.byHost.set(host, { context, mintedAtMs: this.now() });
    return context;
  }
}
