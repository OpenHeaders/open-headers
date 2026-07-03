/**
 * Stateful HAR synthesis for the CDP correlator.
 *
 * A single `InspectorHarEntry` spans several CDP events
 * (`requestWillBeSent` → `responseReceived` → `loadingFinished`), so it
 * cannot be assembled by the pure per-event mapper. This builder
 * accumulates a partial entry per `(requestId, hopIndex)` and emits a
 * `har-attached` update once the response is known — first a partial at
 * `responseReceived`, then a refined one at `loadingFinished` carrying
 * `_transferSize` and the body-download (`receive`) leg. The store's
 * `setHopSlot` reducer overwrites the slot, so the re-attach is a clean
 * refinement (invariant 5 governs lifecycle fields, not HAR slot
 * contents).
 *
 * Redirect hops are synthesized from `requestWillBeSent.redirectResponse`:
 * each redirect carries the just-finished prior hop's full response, so
 * the prior hop's HAR lands at the builder's current hop cursor before
 * the cursor advances to the new hop. CDP reuses `requestId` across
 * hops, matching lifecycle invariants 1 and 4.
 *
 * The two `*ExtraInfo` events carry the on-the-wire header sets (the real
 * `Cookie` the page never sees; the `Set-Cookie` the cooked response
 * omits). They have no hop index and no guaranteed order vs their base
 * event, so the builder pairs them to a hop by ordinal — the k-th
 * request-extra to hop k, the k-th response-extra to hop k (hops finalize
 * strictly in order, so the response ordinal tracks the hop). An extra
 * that arrives before its hop is stashed and applied when the base event
 * creates the hop; one that arrives after re-emits a refined `har-attached`
 * immediately. The merged headers supersede the cooked base headers
 * wholesale for the section they cover (see {@link ./cdp-har-synth}).
 *
 * State posture mirrors the heuristic correlator's per-tab maps: scoped
 * by tab, cleared by {@link CdpHarBuilder.forgetTab}, bounded by a per-tab
 * cap on concurrent in-flight requests, and pruned by a lazy retention
 * sweep after a terminal event (no timers — the monotonic event
 * timestamp drives gc, keeping it deterministic under fake clocks and
 * SW-suspend-safe). The pure shape conversions live in
 * {@link ./cdp-har-synth}.
 */

export { CdpHarBuilder } from './builder';
export {
  CDP_HAR_RETENTION_MS,
  type CdpBodyFetchContext,
  type CdpBodyRef,
  MAX_CDP_BODY_REFS_PER_TAB,
  MAX_CDP_HAR_REQUESTS_PER_TAB,
} from './state';
