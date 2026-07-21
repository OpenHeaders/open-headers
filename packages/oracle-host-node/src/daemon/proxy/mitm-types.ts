/**
 * Contracts for the L7 MITM capture core (Phase 2) and the Phase-3
 * enforcement/timing extensions. The server re-originates, runs the
 * injected rule enforcer, measures L4 instants on its own sockets, and
 * reports wire-truth facts. Every seam here is injectable so the server
 * is driven in tests without OS trust or a real CA install.
 */

import type { RequestOverride, ResponseOverride } from '@openheaders/core/request-lifecycle';
import type { ProxyCaRecord } from '@openheaders/core/types';
import type { CapturedBody } from './body-store';

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

/**
 * L4 instants measured on the proxy's own upstream socket, wall-clock
 * ms. Absent instants mean the leg did not occur on this exchange — a
 * pooled (kept-alive) socket connects nowhere, an `http:` target has no
 * TLS leg. `atStartMs` is the moment re-origination began (post rule
 * delay); the request-start-to-here gap is queueing.
 */
export interface ProxyHopTiming {
  readonly atStartMs: number;
  /** Socket was reused from the agent pool — no connect/TLS legs. */
  readonly reusedSocket: boolean;
  readonly dnsResolvedAtMs?: number;
  readonly connectedAtMs?: number;
  readonly tlsEstablishedAtMs?: number;
  /** Request fully flushed upstream. */
  readonly requestSentAtMs?: number;
  /** Upstream response head arrived — first byte. */
  readonly responseAtMs?: number;
}

/** Terminal completion — response fully relayed. */
export interface ProxyExchangeEnd {
  readonly completedAtMs: number;
  /** Encoded response body bytes relayed downstream. */
  readonly responseBytes: number;
  /** Encoded request body bytes forwarded upstream. */
  readonly requestBytes?: number;
  readonly timing?: ProxyHopTiming;
  /** Bounded tee of the request body the proxy forwarded (§6 contract). */
  readonly requestBody?: CapturedBody;
  /**
   * Bounded tee of the encoded response body relayed downstream —
   * retained out-of-row and decoded lazily on inspect.
   */
  readonly responseBody?: CapturedBody;
  /** The response's `Content-Encoding`, lower-cased; absent = identity. */
  readonly responseContentEncoding?: string;
}

/** One rule-driven in-place URL rewrite on a captured exchange. */
export interface ProxyInternalRedirect {
  readonly ruleUid: string;
  readonly sourceUrl: string;
  readonly redirectUrl: string;
  readonly atMs: number;
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
  /**
   * A rule rewrote the URL in place (redirect/query-param) — fired after
   * `onRequestStart` (which carries the original URL), before any
   * response callback, once per rewrite in application order.
   */
  onInternalRedirect(id: string, redirect: ProxyInternalRedirect): void;
  /**
   * A request-body rule substituted the outgoing body — the two-sided
   * capture (`sent` vs `original`), fired before re-origination.
   */
  onRequestOverride(id: string, override: RequestOverride): void;
  /**
   * A response rule acted on the exchange — `served` is what went
   * downstream; `original` is the real reply for a `network`-source rule
   * (a `mock` never hit the server, so there is no original). Fired at
   * exchange end, when the original tee is complete.
   */
  onResponseOverride(id: string, override: ResponseOverride): void;
  onResponseHeaders(id: string, head: ProxyResponseHead): void;
  onComplete(id: string, end: ProxyExchangeEnd): void;
  onError(id: string, error: ProxyExchangeError): void;
}
