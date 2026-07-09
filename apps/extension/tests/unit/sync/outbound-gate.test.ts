/**
 * Phase U6.2 — outbound transport gate.
 *
 * Covers the three eligibility layers and their cheapest-first
 * precedence. The authz layer's branches are exercised by the core
 * resolver suite; here we pin the echo + consumed-Org tenancy layers
 * and the allow path.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import {
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  type MutationEnvelope,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
} from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import {
  __resetOutboundGateForTests,
  evaluateOutboundEnvelope,
  setOutboundEchoGuard,
  setOutboundReachGuard,
} from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installSyntheticIdentityForTests } from './_identity-test-setup';

const CONSUMED_ORG: Org = { id: 'org-backend', name: 'Backend Org', hostKind: 'desktop', isPrivate: false };

const envelope = (overrides: Partial<MutationEnvelope> = {}): MutationEnvelope =>
  ({
    mutationId: 'm-1',
    hlc: { physicalMs: 1000, logical: 0, nodeId: 'sw' },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId: 'ws-1',
    orgId: CONSUMED_ORG.id,
    mutatorVersion: 1,
    body: { kind: 'delete', type: 'rule', id: 'r' },
    ...overrides,
  }) as MutationEnvelope;

let teardownIdentity: () => void = () => undefined;

beforeEach(async () => {
  teardownIdentity = await installSyntheticIdentityForTests([], [CONSUMED_ORG]);
  __resetOutboundGateForTests();
});

afterEach(() => {
  __resetOutboundGateForTests();
  teardownIdentity();
});

describe('evaluateOutboundEnvelope', () => {
  it('allows an envelope stamped with a consumed Org', () => {
    expect(evaluateOutboundEnvelope(envelope())).toEqual({ allow: true });
  });

  it('withholds an envelope the echo guard flags as a wire echo', () => {
    setOutboundEchoGuard(() => true);
    expect(evaluateOutboundEnvelope(envelope())).toEqual({ allow: false, layer: 'echo' });
  });

  it('withholds an own-home-Org envelope (consume-only — never push the joiner’s data up)', () => {
    const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
    const verdict = evaluateOutboundEnvelope(envelope({ orgId: homeOrgId }));
    expect(verdict.allow).toBe(false);
    expect(verdict.allow === false && verdict.layer).toBe('tenancy');
  });

  it('withholds an envelope stamped with an unknown Org', () => {
    const verdict = evaluateOutboundEnvelope(envelope({ orgId: 'org-never-joined' }));
    expect(verdict.allow).toBe(false);
    expect(verdict.allow === false && verdict.layer).toBe('tenancy');
  });

  it('runs echo before tenancy — an echoed home-Org envelope reports the echo layer', () => {
    setOutboundEchoGuard(() => true);
    const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
    const verdict = evaluateOutboundEnvelope(envelope({ orgId: homeOrgId }));
    expect(verdict.allow === false && verdict.layer).toBe('echo');
  });

  const vaultEnvelope = (): MutationEnvelope =>
    envelope({ body: { kind: 'delete', type: VAULT_ENTITY_TYPE, id: VAULT_ID } });

  it('allows a same-device-only (vault) mutation when the backend is loopback (default)', () => {
    // No reach guard installed → backend treated as same-device → vault passes.
    expect(evaluateOutboundEnvelope(vaultEnvelope())).toEqual({ allow: true });
  });

  it('withholds a same-device-only (vault) mutation when the backend is off-device', () => {
    setOutboundReachGuard(() => true);
    const verdict = evaluateOutboundEnvelope(vaultEnvelope());
    expect(verdict.allow).toBe(false);
    expect(verdict.allow === false && verdict.layer).toBe('reach');
  });

  it('reach guard leaves a non-sensitive mutation untouched even when off-device', () => {
    setOutboundReachGuard(() => true);
    expect(evaluateOutboundEnvelope(envelope())).toEqual({ allow: true });
  });

  it('runs reach before echo — an echoed vault mutation to an off-device backend reports the reach layer', () => {
    setOutboundReachGuard(() => true);
    setOutboundEchoGuard(() => true);
    const verdict = evaluateOutboundEnvelope(vaultEnvelope());
    expect(verdict.allow === false && verdict.layer).toBe('reach');
  });

  const layoutEnvelope = (): MutationEnvelope =>
    envelope({
      body: { kind: 'setField', type: LAYOUT_STATE_ENTITY_TYPE, id: LAYOUT_STATE_ID, path: 'layout', value: {} },
    });

  it('withholds a host-local (layout) mutation on every wire, loopback included', () => {
    // No reach guard installed → backend is same-device — host-local is an
    // ownership boundary, not a reach one, so it still never crosses.
    const verdict = evaluateOutboundEnvelope(layoutEnvelope());
    expect(verdict.allow).toBe(false);
    expect(verdict.allow === false && verdict.layer).toBe('local');
  });

  it('runs the host-local floor before echo — an echoed layout mutation reports the local layer', () => {
    setOutboundEchoGuard(() => true);
    const verdict = evaluateOutboundEnvelope(layoutEnvelope());
    expect(verdict.allow === false && verdict.layer).toBe('local');
  });
});
