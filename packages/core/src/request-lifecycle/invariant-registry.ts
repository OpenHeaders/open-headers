/**
 * Canonical registry of the eight request-lifecycle invariants and
 * their enforcement locations.
 *
 * The invariants themselves are declared in `./types` (the doc-comment
 * block at the top of the file). This registry is the *traceability*
 * layer: it answers "which file enforces invariant N, and by what
 * marker?" so a rename or accidental deletion can be caught by a
 * single meta-test (`tests/request-lifecycle/invariant-coverage.test.ts`)
 * rather than by hoping someone notices.
 *
 * Two states per entry:
 *
 *   - **Enforced** — `assertedBy` lists ≥1 `{ path, marker }`. The
 *     meta-test verifies the path exists relative to repo root AND
 *     the file content contains the literal `marker` string. Markers
 *     are usually the `describe(...)` block name; renaming the block
 *     without updating the registry fails CI loudly.
 *
 *   - **Pending** — `pending` is set with a `slice` (which T1–T8
 *     sub-slice will close the gap) and a `reason` (one short line of
 *     why no assertion exists yet). `assertedBy` MUST be empty in this
 *     state; mixing pending + assertions is rejected by the meta-test.
 *     Pending entries are visible, named, and time-bounded — not
 *     TODO comments that rot.
 *
 * When a slice ships, delete `pending` and add the assertion(s).
 */

export type InvariantId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface InvariantAssertion {
  /** Repo-root-relative path to the file that asserts this invariant. */
  readonly path: string;
  /**
   * Literal string the file MUST contain. Typically the `describe`
   * block name. The meta-test does a substring match — no regex —
   * so the marker is exactly what you'd `grep` for.
   */
  readonly marker: string;
}

export interface InvariantPending {
  /** Sub-slice identifier (e.g. 'B', 'C', 'D') in the T1–T8 epic. */
  readonly slice: string;
  /** One-line reason for the gap; surfaces in meta-test failure output. */
  readonly reason: string;
}

export interface InvariantEntry {
  readonly id: InvariantId;
  /** Short kebab-case handle, stable across renames. */
  readonly name: string;
  /** One-line restatement of the invariant for human readers. */
  readonly summary: string;
  /** Where the invariant is enforced. Empty iff `pending` is set. */
  readonly assertedBy: readonly InvariantAssertion[];
  /** Set iff the invariant has no enforcement yet. */
  readonly pending?: InvariantPending;
}

export const REQUEST_LIFECYCLE_INVARIANTS: readonly InvariantEntry[] = [
  {
    id: 1,
    name: 'identity-tuple',
    summary: 'Identity = (tabId, requestId), stable across redirects.',
    assertedBy: [
      {
        path: 'packages/core/tests/request-lifecycle/invariants.test.ts',
        marker: "describe('invariant 1 — identity is (tabId, requestId)'",
      },
      {
        path: 'packages/oracle/tests/request-lifecycle-store/store.test.ts',
        marker: "describe('RequestLifecycleStore — invariants 1 + 2",
      },
    ],
  },
  {
    id: 2,
    name: 'tab-scope',
    summary: 'Tab-scoped — lifecycles die with the tab.',
    assertedBy: [
      {
        path: 'packages/oracle/tests/request-lifecycle-store/store.test.ts',
        marker: 'forgetTab(t) drops only t (invariant 2 — tab scope)',
      },
    ],
  },
  {
    id: 3,
    name: 'monotonic-phase',
    summary: 'Steady-phase advance pending → headers-received → completed | failed; no retrograde (except invariant 6).',
    assertedBy: [
      {
        path: 'packages/core/tests/request-lifecycle/invariants.test.ts',
        marker: "describe('invariant 3 — monotonic steady-phase advance'",
      },
      {
        path: 'packages/oracle/tests/request-lifecycle-store/reducer.test.ts',
        marker: "describe('reducer — invariant 3 (monotonic steady-phase advance)'",
      },
    ],
  },
  {
    id: 4,
    name: 'single-lifecycle-per-request',
    summary: 'One lifecycle per request including redirects (chain in redirectHops).',
    assertedBy: [
      {
        path: 'packages/core/tests/request-lifecycle/invariants.test.ts',
        marker: "describe('invariant 4 — one lifecycle per request including redirects'",
      },
    ],
  },
  {
    id: 5,
    name: 'monotonic-information-content',
    summary: 'Fields refine but never disappear; error.code may sharpen (net::* → oh:*) but cannot be cleared.',
    assertedBy: [
      {
        path: 'packages/core/tests/request-lifecycle/invariants.test.ts',
        marker: "describe('invariant 5 — monotonic information content (fields refine, never disappear)'",
      },
      {
        path: 'packages/oracle/tests/request-lifecycle-store/reducer.test.ts',
        marker: "describe('reducer — invariant 5 (monotonic information content)'",
      },
    ],
  },
  {
    id: 6,
    name: 'redirect-sole-retrograde',
    summary: 'Redirect is the only retrograde phase transition; appends a hop + resets phase to pending.',
    assertedBy: [
      {
        path: 'packages/core/tests/request-lifecycle/invariants.test.ts',
        marker: "describe('invariant 6 — redirect is the only retrograde transition'",
      },
      {
        path: 'packages/oracle/tests/request-lifecycle-store/reducer.test.ts',
        marker: "describe('reducer — invariant 6 (redirect is the sole retrograde transition)'",
      },
    ],
  },
  {
    id: 7,
    name: 'single-webrequest-subscriber',
    summary:
      'Exactly one chrome.webRequest.*.addListener subscriber across the extension — the heuristic correlator. Integration-level, not unit.',
    assertedBy: [],
    pending: {
      slice: 'C',
      reason:
        'Runtime check not yet implemented; needs a vitest scan of apps/extension/src/ asserting only correlator-host/chrome-webrequest-source.ts subscribes.',
    },
  },
  {
    id: 8,
    name: 'totally-ordered-output',
    summary:
      'Correlator output totally ordered per (tabId, requestId); heuristic uses an in-window buffer. HAR-body attachment is exempt.',
    assertedBy: [],
    pending: {
      slice: 'B',
      reason:
        'Ordering buffer is unit-tested per-mechanism (har-waiting-buffer / hop-cursor) but no consolidated property-based assertion named for invariant 8 exists yet.',
    },
  },
];
