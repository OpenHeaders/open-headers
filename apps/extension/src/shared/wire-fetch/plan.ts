/**
 * Wire-fetch plan — a fully JSON-serializable description of one HTTP
 * exchange, at wire altitude: the body is already folded to what goes
 * on the socket (graphql → JSON text, form → key/value entries,
 * multipart file parts → raw bytes as base64). The SW builds a plan
 * from a `ResolvedRequest` and ships it over `chrome.runtime`
 * messaging to the offscreen document, which executes it — see
 * `execute-plan.ts` for why the execution context matters.
 */

import type { CredentialsMode } from '@openheaders/core/types';

export interface WirePlanPair {
  key: string;
  value: string;
}

export type WirePlanMultipartPart =
  | { kind: 'text'; name: string; value: string }
  | { kind: 'file'; name: string; bytesBase64: string; filename: string; mimeType: string };

export type WirePlanBody =
  | { kind: 'none' }
  | { kind: 'text'; content: string }
  | { kind: 'form'; entries: WirePlanPair[] }
  | { kind: 'multipart'; parts: WirePlanMultipartPart[] };

export interface WirePlan {
  url: string;
  method: string;
  headers: WirePlanPair[];
  body: WirePlanBody;
  redirect: 'follow' | 'manual';
  credentials: CredentialsMode;
  /** Wall-clock ceiling (ms) spanning connect + response + body read. */
  timeoutMs?: number;
  /** Response-body byte cap — bytes beyond it are dropped, `truncated` set. */
  capBytes: number;
}

export type WireFetchResult =
  | {
      ok: true;
      status: number;
      statusText: string;
      url: string;
      headers: WirePlanPair[];
      /** Wire bytes (cap applied), base64 — the transport is JSON. */
      bodyBase64: string;
      /** Total wire bytes BEFORE the cap. */
      bodyBytes: number;
      truncated: boolean;
      durationMs: number;
    }
  | { ok: false; message: string };

/** Inverse of `toBase64` — base64 string back to raw bytes. */
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
