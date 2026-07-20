/**
 * Contracts for the L7 MITM capture core (Phase 2). Read-only capture:
 * the server observes and re-originates, it does not yet run the rule
 * engine (Phase 3). Every seam here is injectable so the server is
 * driven in tests without OS trust or a real CA install.
 */

import type { ProxyCaRecord } from '@openheaders/core/types';

/** One request/response header, preserving on-the-wire order + case. */
export interface ProxyHeader {
  readonly name: string;
  readonly value: string;
}

/**
 * Resolves the current CA record for leaf minting. `null` = no CA on
 * record yet (never trusted, or the sealed slot is undecryptable) — the
 * server cannot terminate TLS and falls back to opaque passthrough even
 * for a scoped host, never presenting an untrusted or absent leaf.
 */
export interface ProxyCaProvider {
  getCa(): Promise<ProxyCaRecord | null>;
}

/** Decides which hosts are TLS-terminated vs blind-tunnelled. */
export interface ProxyScope {
  /** True ⇒ decrypt (MITM); false ⇒ opaque CONNECT passthrough. */
  isDecrypted(host: string): boolean;
}

/** The request side of a captured exchange, known at request start. */
export interface ProxyRequestStart {
  readonly id: string;
  readonly scheme: 'http' | 'https';
  readonly method: string;
  /** Absolute URL of the target. */
  readonly url: string;
  readonly host: string;
  readonly headers: readonly ProxyHeader[];
  readonly startedAtMs: number;
}

/** The response head, known once upstream headers arrive. */
export interface ProxyResponseHead {
  readonly statusCode: number;
  readonly statusText: string;
  readonly headers: readonly ProxyHeader[];
  readonly atMs: number;
}

/** Terminal completion — response fully relayed. */
export interface ProxyExchangeEnd {
  readonly completedAtMs: number;
  /** Decoded response body bytes relayed downstream. */
  readonly responseBytes: number;
}

/** Terminal failure — upstream connect/transport error. */
export interface ProxyExchangeError {
  readonly atMs: number;
  readonly code: string;
  readonly reason: string;
}

/**
 * Capture seam. The server calls these as an exchange progresses; the
 * lifecycle mapper turns them into `RequestLifecycleUpdate`s. A
 * blind-tunnelled (un-scoped) CONNECT is opaque — none of these fire for
 * it, so passthrough traffic is never captured.
 */
export interface ProxyCaptureObserver {
  onRequestStart(start: ProxyRequestStart): void;
  onResponseHeaders(id: string, head: ProxyResponseHead): void;
  onComplete(id: string, end: ProxyExchangeEnd): void;
  onError(id: string, error: ProxyExchangeError): void;
}
