/**
 * Valibot schema for the {@link HLC} wire shape.
 *
 * Lives next to the HLC types so any consumer that needs to validate an
 * HLC arriving from outside the local oracle (WS handshake messages,
 * mutation envelopes received from a peer, snapshot blobs read from
 * disk) gets the same boundary check. The HLC type itself stays the
 * source of truth for in-memory ordering; this schema is for the
 * boundary — and only the boundary — so internal callers continue to
 * pay no runtime cost.
 *
 * Field constraints:
 * - `physicalMs` — finite non-negative integer (Unix-epoch millisecond
 *   readings from any reasonable clock are well under `Number.MAX_SAFE_INTEGER`).
 * - `logical` — non-negative integer; the tie-breaker counter.
 * - `nodeId` — non-empty string; concrete id format is platform-decided
 *   (deviceId, SW process id, daemon name) and intentionally opaque
 *   here so core/sync can stay catalogue-free.
 */
import * as v from 'valibot';

import type { HLC } from './types';

export const HlcSchema = v.object({
  physicalMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  logical: v.pipe(v.number(), v.integer(), v.minValue(0)),
  nodeId: v.pipe(v.string(), v.minLength(1)),
}) satisfies v.GenericSchema<HLC>;
