/**
 * Hybrid Logical Clock — `(physicalMs, logical, nodeId)`.
 *
 * Carries all ordering responsibility in the server-less sync model
 * (see SYNC_ENGINE_DESIGN §4). Total-ordered via {@link compareHlc}.
 *
 * `physicalMs` is the best available wall/monotonic reading at the
 * issuing node. `logical` breaks ties when two events share a physical
 * tick or when a clock is observed running ahead of local. `nodeId`
 * breaks the final tie so two distinct nodes can never produce equal
 * HLCs (the lock guarantees this within a node).
 */
export interface HLC {
  readonly physicalMs: number;
  readonly logical: number;
  readonly nodeId: string;
}
