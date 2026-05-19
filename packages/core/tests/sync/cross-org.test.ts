/**
 * Phase U2 slice 5 — cross-org property test (U2.10).
 *
 * Asserts the transport-boundary org filter never leaks envelopes
 * outside the host's authorized Org set. Generates random scenarios
 * with mixed-org workspaces and org-flip events, runs the same pure
 * filter the IDB / SQLite readers compose
 * ({@link filterEnvelopesByOrg}), and checks two invariants:
 *
 *   1. **No cross-org leak** — every yielded envelope's `orgId` is in
 *      the authorized set. Per UNIFIED_ORACLE_MODEL.md §6.1 / §8.2,
 *      this is the property that gates the wire.
 *   2. **Snapshot-bootstrap not history-replay** — for a workspace
 *      whose `orgId` was flipped from local-org → team-org per §6.5.3,
 *      a new team peer (authorized only for team-org) must see ZERO
 *      pre-flip envelopes in the delta stream. The historical tail
 *      stamped with the old `orgId` is filtered out; the team peer
 *      receives current state via snapshot bootstrap instead.
 *
 * Reuses {@link mintEnvelope} from the existing harness — the same
 * helper the convergence test uses, already extended with per-envelope
 * `orgId` (slice 4, {@link TEST_ORG_ID}).
 *
 * Determinism: each scenario seeds {@link makeRng} so any failure
 * reproduces from the printed seed.
 */

import { describe, expect, it } from 'vitest';

import type { HLC, MutationBody, MutationEnvelope } from '../../src/sync';
import { filterEnvelopesByOrg } from '../../src/sync';
import { hlcAt, mintEnvelope } from './harness/envelope-gen';
import { makeRng, type Rng } from './harness/random';

/**
 * Pool of fixed Org ids the property test draws from. UUIDv7-shaped so
 * any future identity-resolver consumer of these values still
 * round-trips through the strict schemas without bespoke fixtures.
 */
const ORG_HOME = '01900000-0000-7000-8000-000000000001';
const ORG_LOCAL_A = '01900000-0000-7000-8000-000000000002';
const ORG_TEAM = '01900000-0000-7000-8000-000000000003';
const ORG_FOREIGN = '01900000-0000-7000-8000-000000000004';

const ALL_ORG_IDS = [ORG_HOME, ORG_LOCAL_A, ORG_TEAM, ORG_FOREIGN] as const;

interface WorkspaceFixture {
  workspaceId: string;
  /** `orgId` at the time the envelope was minted — pre-flip for the historical tail, post-flip after. */
  preFlipOrgId: string;
  /** Optional post-flip `orgId`. Absent when the workspace never flipped. */
  postFlipOrgId?: string;
  /** Envelope index (within the generated log) where the flip takes effect. */
  flipAt?: number;
}

const RULE_DELETE_BODY: MutationBody = { kind: 'delete', type: 'rule', id: 'r' };
const WORKSPACE_VAR_SET_BODY: MutationBody = {
  kind: 'setField',
  type: 'workspace-variables',
  id: 'ws-vars',
  path: 'variables.dummy.value',
  value: 'x',
};

function pickBody(rng: Rng): MutationBody {
  return rng.next() < 0.5 ? RULE_DELETE_BODY : WORKSPACE_VAR_SET_BODY;
}

function genWorkspace(rng: Rng, workspaceIndex: number): WorkspaceFixture {
  const preFlipOrgId = rng.pick(ALL_ORG_IDS);
  // ~30% of workspaces flip orgId mid-log (§6.5.3 scenario).
  if (rng.next() < 0.3) {
    let postFlipOrgId = rng.pick(ALL_ORG_IDS);
    if (postFlipOrgId === preFlipOrgId) {
      postFlipOrgId = ALL_ORG_IDS[(ALL_ORG_IDS.indexOf(postFlipOrgId) + 1) % ALL_ORG_IDS.length];
    }
    return {
      workspaceId: `ws-${workspaceIndex}`,
      preFlipOrgId,
      postFlipOrgId,
      flipAt: 1 + rng.int(9),
    };
  }
  return { workspaceId: `ws-${workspaceIndex}`, preFlipOrgId };
}

function genScenario(rng: Rng, scenarioIndex: number): {
  envelopes: MutationEnvelope[];
  fixtures: WorkspaceFixture[];
} {
  const workspaceCount = 1 + rng.int(4);
  const fixtures = Array.from({ length: workspaceCount }, (_, i) => genWorkspace(rng, i));
  const envelopes: MutationEnvelope[] = [];
  let physicalMs = scenarioIndex * 10_000;
  for (const fixture of fixtures) {
    const total = 6 + rng.int(10);
    for (let i = 0; i < total; i += 1) {
      const orgId =
        fixture.postFlipOrgId !== undefined && fixture.flipAt !== undefined && i >= fixture.flipAt
          ? fixture.postFlipOrgId
          : fixture.preFlipOrgId;
      const hlc: HLC = hlcAt(physicalMs, 0, `node-${fixture.workspaceId}`);
      envelopes.push(
        mintEnvelope({
          workspaceId: fixture.workspaceId,
          orgId,
          hlc,
          body: pickBody(rng),
          mutationId: `${fixture.workspaceId}-${i}`,
        }),
      );
      physicalMs += 1;
    }
  }
  return { envelopes, fixtures };
}

function authorize(...orgIds: ReadonlyArray<string>): ReadonlySet<string> {
  return new Set(orgIds);
}

describe('U2.10 — cross-org property test', () => {
  it('filters 1000+ scenarios with zero cross-org leaks', () => {
    const SCENARIOS = 1024;
    let totalEnvelopes = 0;
    let totalYielded = 0;
    for (let s = 0; s < SCENARIOS; s += 1) {
      const rng = makeRng(0x51c305 ^ s);
      const { envelopes } = genScenario(rng, s);
      totalEnvelopes += envelopes.length;
      // Each scenario rolls an authorized set drawn from the same pool
      // the workspaces drew from. Empty + single-element + multi-element
      // sets all occur naturally.
      const authSize = rng.int(ALL_ORG_IDS.length + 1);
      const authPool = rng.shuffle(ALL_ORG_IDS.slice()).slice(0, authSize);
      const authorized = authorize(...authPool);

      for (const env of filterEnvelopesByOrg(envelopes, authorized)) {
        totalYielded += 1;
        if (!authorized.has(env.orgId)) {
          throw new Error(
            `cross-org leak in scenario ${s} (seed=${0x51c305 ^ s}): ` +
              `envelope ${env.mutationId} has orgId=${env.orgId}, authorized=${[...authorized].join(',') || '∅'}`,
          );
        }
      }
    }
    expect(totalEnvelopes).toBeGreaterThan(0);
    // Sanity: an empty-authorized scenario yields zero; a full-authorized
    // one yields everything. With random subsets we land somewhere in
    // between but never above the total.
    expect(totalYielded).toBeLessThanOrEqual(totalEnvelopes);
  });

  it('new team peers see snapshot-bootstrap, not history-replay (§6.5.3 step 4)', () => {
    // Generate scenarios where each workspace flips local-org → team-org
    // mid-log. The team peer is authorized only for ORG_TEAM. Property:
    // the team peer must receive zero pre-flip envelopes (those carry
    // the OLD orgId per mint-time semantics — §8.2 "Envelopes are never
    // rewritten when the workspace's org_id changes").
    const SCENARIOS = 512;
    let totalPreFlip = 0;
    let totalLeaks = 0;
    for (let s = 0; s < SCENARIOS; s += 1) {
      const rng = makeRng(0x6537ea ^ s);
      const envelopes: MutationEnvelope[] = [];
      const workspaceCount = 1 + rng.int(4);
      let physicalMs = s * 10_000;
      const preFlipEnvelopeIds = new Set<string>();
      for (let w = 0; w < workspaceCount; w += 1) {
        const workspaceId = `ws-${s}-${w}`;
        const flipAt = 2 + rng.int(8);
        const total = flipAt + 1 + rng.int(8);
        for (let i = 0; i < total; i += 1) {
          const orgId = i < flipAt ? ORG_LOCAL_A : ORG_TEAM;
          const mutationId = `${workspaceId}-${i}`;
          if (i < flipAt) preFlipEnvelopeIds.add(mutationId);
          envelopes.push(
            mintEnvelope({
              workspaceId,
              orgId,
              hlc: hlcAt(physicalMs, 0, `node-${workspaceId}`),
              body: pickBody(rng),
              mutationId,
            }),
          );
          physicalMs += 1;
        }
      }
      totalPreFlip += preFlipEnvelopeIds.size;

      // New team peer: authorized for ORG_TEAM only.
      const authorized = authorize(ORG_TEAM);
      for (const env of filterEnvelopesByOrg(envelopes, authorized)) {
        if (preFlipEnvelopeIds.has(env.mutationId)) {
          totalLeaks += 1;
        }
      }
    }
    expect(totalPreFlip).toBeGreaterThan(0);
    expect(totalLeaks).toBe(0);
  });

  it('empty / null-snapshot authorized set deny-alls (pre-bootstrap)', () => {
    const SCENARIOS = 256;
    for (let s = 0; s < SCENARIOS; s += 1) {
      const rng = makeRng(0xdead00 ^ s);
      const { envelopes } = genScenario(rng, s);
      const yielded = [...filterEnvelopesByOrg(envelopes, new Set())];
      expect(yielded).toEqual([]);
    }
  });

  it('full-authorized set passes every envelope through unchanged', () => {
    const SCENARIOS = 256;
    for (let s = 0; s < SCENARIOS; s += 1) {
      const rng = makeRng(0xbeef00 ^ s);
      const { envelopes } = genScenario(rng, s);
      const yielded = [...filterEnvelopesByOrg(envelopes, authorize(...ALL_ORG_IDS))];
      expect(yielded.map((e) => e.mutationId)).toEqual(envelopes.map((e) => e.mutationId));
    }
  });
});
