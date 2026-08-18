/**
 * `BackendConnection` — one back-end this app instance has joined
 * (the multi-backend plan §2). A back-end is precisely a daemon the
 * client dials: a URL, a per-backend paired token, and the Orgs
 * consumed from it. The local host engine (extension SW / desktop
 * embedded oracle) is tier zero — always on, never a record here.
 *
 * `enabled` is the kill switch without forgetting config: it gates the
 * connection plane only. The Orgs joined from a disabled backend stay
 * folded into the identity snapshot so their workspaces remain usable
 * as local data; unbinding an Org is the deliberate remove flow, not a
 * toggle side effect.
 */

import * as v from 'valibot';

export const BackendConnectionSchema = v.object({
  /** UUIDv7 — stable identity; token, Org provenance, and status key off it. */
  id: v.pipe(v.string(), v.minLength(1)),
  /** User-editable display name ("Work VM", "Home NAS"). */
  label: v.string(),
  /** WebSocket endpoint — `ws://` for local / LAN, `wss://` for remote. */
  url: v.pipe(v.string(), v.regex(/^wss?:\/\//i)),
  /** Per-backend paired token; `''` is the pre-pairing state. */
  authToken: v.string(),
  /** Dial on host boot. */
  autoConnect: v.boolean(),
  /** Kill switch without forgetting config — gates dialing only. */
  enabled: v.boolean(),
  /** ISO timestamp of when the record was added. */
  addedAt: v.string(),
  /** ISO timestamp of the most recent successful connect; null until first. */
  lastConnectedAt: v.union([v.string(), v.null()]),
});
