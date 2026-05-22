/**
 * Phase U6.2 — outbound transport gate.
 *
 * Covers the three eligibility layers and their cheapest-first
 * precedence. The authz layer's branches are exercised by the core
 * resolver suite; here we pin the echo + consumed-Org tenancy layers
 * and the allow path.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import type { MutationEnvelope } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { __resetOutboundGateForTests, evaluateOutboundEnvelope, setOutboundEchoGuard } from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installSyntheticIdentityForTests } from './_identity-test-setup';

const CONSUMED_ORG: Org = { id: 'org-backend', name: 'Backend Org', hostKind: 'desktop', isSynthetic: false };

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
});
