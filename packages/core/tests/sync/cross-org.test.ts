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
 *      the authorized set. Per the unified-oracle model §6.1 / §8.2,
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

/**
 * Phase U4.1 — Coexist double-import, receiver side (the unified-oracle model
 * §6.3).
 *
 * Models the desktop receiver after a mode-switch to "keep both as
 * separate workspaces". The desktop ingest stream carries:
 *
 *   1. the desktop's own workspace data (orgId = desktop home-org),
 *   2. the explicit Coexist push that mints "W1 (imported)" on the
 *      desktop (orgId = desktop home-org — the workspace was created
 *      locally), and
 *   3. the LEAK: the live WS link replays the extension's W1 data plus
 *      the extension's `__global__` workspace-list singleton, all
 *      stamped with the extension's home-org.
 *
 * The sender-side transport readers never block (3) — a host's own log
 * always carries its own Orgs. The receiver-side filter the ingest path
 * now composes ({@link filterEnvelopesByOrg} over the host's authorized
 * set) is what drops it. Property: after the filter, exactly the
 * desktop-org envelopes survive — so the desktop's `__global__` registers
 * exactly ONE imported copy of W1 and the extension's `__global__` row
 * never lands as a bare duplicate.
 */
describe('U4.1 — Coexist double-import (receiver-side org filter)', () => {
  const GLOBAL_SCOPE = '__global__';
  const DESKTOP_ORG = ORG_HOME;
  const EXT_ORG = ORG_LOCAL_A;

  it('ext W1 + desktop W2 → exactly ONE imported copy on desktop (1024 scenarios)', () => {
    const SCENARIOS = 1024;
    for (let s = 0; s < SCENARIOS; s += 1) {
      const rng = makeRng(0xc0ec51 ^ s);
      const ingest: MutationEnvelope[] = [];
      let physicalMs = s * 10_000;

      const mint = (workspaceId: string, orgId: string, node: string, i: number): void => {
        ingest.push(
          mintEnvelope({
            workspaceId,
            orgId,
            hlc: hlcAt(physicalMs, 0, node),
            body: pickBody(rng),
            mutationId: `${node}-${workspaceId}-${i}`,
          }),
        );
        physicalMs += 1;
      };

      // (1) The desktop's own workspaces, registered through the
      // desktop's `__global__` singleton.
      const desktopWorkspaceCount = 1 + rng.int(3);
      const desktopRegistered: string[] = [];
      for (let w = 0; w < desktopWorkspaceCount; w += 1) {
        const ws = `desktop-ws-${w}`;
        desktopRegistered.push(ws);
        const dataCount = 1 + rng.int(5);
        for (let i = 0; i < dataCount; i += 1) mint(ws, DESKTOP_ORG, 'desktop-node', i);
      }
      // (2) Coexist push: "W1 (imported)" minted locally on the desktop.
      const importedWs = 'w1-imported';
      desktopRegistered.push(importedWs);
      const importedCount = 1 + rng.int(5);
      for (let i = 0; i < importedCount; i += 1) mint(importedWs, DESKTOP_ORG, 'desktop-node', i);
      for (let i = 0; i < desktopRegistered.length; i += 1) {
        mint(GLOBAL_SCOPE, DESKTOP_ORG, 'desktop-node', i);
      }

      // (3) The leak: the extension replays its own W1 data + its
      // `__global__` workspace-list row over the live link.
      const extDataCount = 1 + rng.int(5);
      for (let i = 0; i < extDataCount; i += 1) mint('ext-w1', EXT_ORG, 'ext-node', i);
      mint(GLOBAL_SCOPE, EXT_ORG, 'ext-node', 0);

      // The desktop's ingest path filters by ITS authorized set.
      const accepted = [...filterEnvelopesByOrg(ingest, authorize(DESKTOP_ORG))];

      const seed = 0xc0ec51 ^ s;
      // No foreign-org envelope survives.
      for (const env of accepted) {
        if (env.orgId !== DESKTOP_ORG) {
          throw new Error(`scenario ${s} (seed=${seed}): leaked envelope ${env.mutationId} orgId=${env.orgId}`);
        }
      }
      // The extension's `__global__` row never lands — no bare duplicate.
      const leakedGlobal = accepted.filter(
        (e) => e.workspaceId === GLOBAL_SCOPE && e.origin.deviceId === 'ext-node',
      );
      expect(leakedGlobal).toEqual([]);
      // The extension's W1 data never lands.
      expect(accepted.some((e) => e.workspaceId === 'ext-w1')).toBe(false);
      // Exactly the desktop's own `__global__` rows survive → the
      // imported W1 has exactly one copy (the explicit Coexist push).
      const survivingGlobal = accepted.filter((e) => e.workspaceId === GLOBAL_SCOPE);
      expect(survivingGlobal).toHaveLength(desktopRegistered.length);
      expect(accepted.filter((e) => e.workspaceId === importedWs)).toHaveLength(importedCount);
    }
  });
});

/**
 * Phase U5.8 — a join never lands a joiner-`Org` envelope on an
 * authenticated target (the unified-oracle model §6.1, Phase U5).
 *
 * Models the authenticated-backend join. The joiner connects to a
 * target it does NOT control. Per U5.2 the join is consume-first: the
 * joiner folds the *target's* `Org` into ITS authorized set so the
 * target's workspaces sync down — but the target never folds the
 * joiner's `Org` into the *target's* set.
 *
 * The joiner forwards its full live stream: its own workspace data and
 * its `__global__` workspace-list singleton, all stamped with the
 * joiner's `Org`, plus any target-`Org` data that synced down and gets
 * echoed back. The target's receiver-side ingest filter runs over the
 * TARGET's authorized set.
 *
 * Property: every joiner-`Org` envelope is dropped — the joiner's
 * workspaces never materialize on the authenticated target, and the
 * joiner's `__global__` row never registers a workspace there. The
 * echoed target-`Org` data still flows (the filter is a precise org
 * gate, not a blanket drop). Pushing the joiner's data up is the
 * explicit, permission-gated per-workspace Publish (U5.6) — never a
 * join side effect; trust-by-process Combine (U5.3), which re-homes
 * the joiner's workspaces onto the target `Org` first, is the only
 * other path and is offered on loopback alone.
 */
describe('U5.8 — join never leaks joiner-Org data to an authenticated target', () => {
  const GLOBAL_SCOPE = '__global__';
  const JOINER_ORG = ORG_LOCAL_A;
  // Org ids a target legitimately holds — never the joiner's.
  const TARGET_ORG_POOL = [ORG_HOME, ORG_TEAM, ORG_FOREIGN] as const;

  it('drops every joiner-Org envelope across 1024 join scenarios', () => {
    const SCENARIOS = 1024;
    let totalJoinerEnvelopes = 0;
    let totalEchoedEnvelopes = 0;
    for (let s = 0; s < SCENARIOS; s += 1) {
      const seed = 0x501501 ^ s;
      const rng = makeRng(seed);
      const stream: MutationEnvelope[] = [];
      let physicalMs = s * 10_000;

      const mint = (workspaceId: string, orgId: string, node: string, i: number): string => {
        const mutationId = `${node}-${workspaceId}-${i}`;
        stream.push(
          mintEnvelope({
            workspaceId,
            orgId,
            hlc: hlcAt(physicalMs, 0, node),
            body: pickBody(rng),
            mutationId,
          }),
        );
        physicalMs += 1;
        return mutationId;
      };

      // The joiner's own workspaces + the `__global__` rows that
      // register them — all stamped with the joiner's Org.
      const joinerWsCount = 1 + rng.int(4);
      for (let w = 0; w < joinerWsCount; w += 1) {
        const ws = `joiner-ws-${w}`;
        const dataCount = 1 + rng.int(5);
        for (let i = 0; i < dataCount; i += 1) {
          mint(ws, JOINER_ORG, 'joiner-node', i);
          totalJoinerEnvelopes += 1;
        }
        mint(GLOBAL_SCOPE, JOINER_ORG, 'joiner-node', w);
        totalJoinerEnvelopes += 1;
      }

      // The target the joiner consumed (U5.2): some target-Org data
      // synced down and the joiner echoes it back over the live link.
      const targetOrg = rng.pick(TARGET_ORG_POOL);
      const echoedMutationIds = new Set<string>();
      const echoCount = rng.int(5);
      for (let i = 0; i < echoCount; i += 1) {
        echoedMutationIds.add(mint('target-ws', targetOrg, 'joiner-node', i));
        totalEchoedEnvelopes += 1;
      }

      // The target authorizes ITS OWN Orgs — a non-empty subset of the
      // target pool that always includes the Org the joiner consumed,
      // and NEVER the joiner's Org.
      const extra = rng.shuffle(TARGET_ORG_POOL.filter((o) => o !== targetOrg).slice());
      const authorized = authorize(targetOrg, ...extra.slice(0, rng.int(extra.length + 1)));
      expect(authorized.has(JOINER_ORG)).toBe(false);

      const accepted = [...filterEnvelopesByOrg(stream, authorized)];

      // Invariant: zero joiner-Org envelopes survive on the target.
      for (const env of accepted) {
        if (env.orgId === JOINER_ORG) {
          throw new Error(
            `scenario ${s} (seed=${seed}): joiner-Org envelope ${env.mutationId} ` +
              `landed on the authenticated target (authorized=${[...authorized].join(',')})`,
          );
        }
      }
      // The joiner's `__global__` workspace-list rows never register a
      // workspace on the target.
      expect(accepted.some((e) => e.workspaceId === GLOBAL_SCOPE)).toBe(false);
      // Sanity — the echoed target-Org data still flows through; the
      // filter is a precise org gate, not a blanket drop.
      for (const id of echoedMutationIds) {
        expect(accepted.some((e) => e.mutationId === id)).toBe(true);
      }
    }
    expect(totalJoinerEnvelopes).toBeGreaterThan(0);
    expect(totalEchoedEnvelopes).toBeGreaterThan(0);
  });
});
