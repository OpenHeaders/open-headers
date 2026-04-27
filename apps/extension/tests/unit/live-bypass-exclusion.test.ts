/**
 * Live Variable bypass exclusion — DNR compile contract.
 *
 * Contract:
 *   - `computeRuleLiveBypass(rule)` walks every templatable string in a
 *     V5.Rule, finds `{{live.X}}` references, and returns the set of
 *     workflow uids those LVs bind to. Disabled LVs don't contribute.
 *   - `attachLiveBypassExclusion(condition, workflowUids, opts)` appends
 *     the extension's runtime id to `excludedInitiatorDomains` when the
 *     rule references at least one LV. Chain fetches issued from the
 *     SW carry the extension origin as their initiator, so the rule is
 *     excluded from firing on the very fetch that produces the LV
 *     value. No-op when workflowUids is empty or extensionDomain is
 *     not supplied.
 *   - Constant drift check: the DNR builder's `LIVE_BYPASS_HEADER_NAME`
 *     matches the executor's `LIVE_BYPASS_HEADER` — chain fetches still
 *     stamp the header as an observability marker even though DNR
 *     cannot (yet) filter on it.
 *
 * Feedback-loop note: without DNR-level exclusion, a header rule
 * injecting `Authorization: {{live.token}}` whose URL pattern overlaps
 * the workflow that produces `live.token` can loop on the chain fetch.
 * Known limitation — `computeRuleLiveBypass` still computes the correct
 * workflow-uid set so the future exclusion mechanism can drop in
 * without a rule-walk refactor.
 */

import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { attachLiveBypassExclusion, LIVE_BYPASS_HEADER_NAME } from '@/background/dnr-builders';
import * as liveVarStore from '@/background/modules/live-variable-store';
import { LIVE_BYPASS_HEADER, liveBypassHeaderValue } from '@/background/modules/request-executor';
import { computeRuleLiveBypass, __resetForTests as resetResolver } from '@/background/modules/variables-resolver';
import * as workspaceStore from '@/background/modules/workspace-store';

const LV_A: V5.LiveVariable = {
  schemaVersion: 5,
  version: 1,
  uid: 'lvaaaaa1',
  path: 'live-variables/a',
  name: 'token',
  workflowUid: 'wflowaa1',
  stepId: 'login',
  captureName: 'access',
  enabled: true,
};

const LV_B_DISABLED: V5.LiveVariable = {
  schemaVersion: 5,
  version: 1,
  uid: 'lvbbbbb1',
  path: 'live-variables/b',
  name: 'csrf',
  workflowUid: 'wflowbb2',
  stepId: 'setup',
  captureName: 'token',
  enabled: false,
};

function makeHeaderRule(value: string): V5.HeaderRule {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'hr000001',
    path: 'rules/header-rule',
    name: 'Auth',
    type: 'header',
    enabled: true,
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'Authorization', value }],
      responseHeaders: [],
    },
  };
}

describe('bypass header constant drift', () => {
  it('dnr-builders LIVE_BYPASS_HEADER_NAME matches executor LIVE_BYPASS_HEADER', () => {
    expect(LIVE_BYPASS_HEADER_NAME).toBe(LIVE_BYPASS_HEADER);
    // Value format is the opaque workflow uid alone — no step suffix —
    // so the DNR exact-match exclusion lands deterministically.
    expect(liveBypassHeaderValue('wflowuid')).toBe('wflowuid');
  });
});

describe('attachLiveBypassExclusion', () => {
  const EXT = 'kjdsljfsdjslkfsdjsdfdj';

  it('returns the condition unchanged when workflowUids is empty', () => {
    const input = { urlFilter: 'openheaders.io' };
    expect(attachLiveBypassExclusion(input, new Set(), { extensionDomain: EXT })).toEqual(input);
  });

  it('returns the condition unchanged when no extensionDomain is supplied', () => {
    const input = { urlFilter: 'openheaders.io' };
    expect(attachLiveBypassExclusion(input, new Set(['wflowaa1']))).toEqual(input);
  });

  it('appends the extension id to excludedInitiatorDomains when LV references exist', () => {
    const out = attachLiveBypassExclusion({ urlFilter: 'openheaders.io' }, new Set(['wflowaa1']), {
      extensionDomain: EXT,
    });
    expect(out.excludedInitiatorDomains).toEqual([EXT]);
  });

  it('preserves any existing excludedInitiatorDomains entries', () => {
    const out = attachLiveBypassExclusion(
      { urlFilter: 'openheaders.io', excludedInitiatorDomains: ['ads.example.com'] },
      new Set(['wflowaa1']),
      { extensionDomain: EXT },
    );
    expect(out.excludedInitiatorDomains).toEqual(['ads.example.com', EXT]);
  });

  it('does not duplicate the extension id if already present', () => {
    const out = attachLiveBypassExclusion(
      { urlFilter: 'openheaders.io', excludedInitiatorDomains: [EXT] },
      new Set(['wflowaa1', 'wflowbb2']),
      { extensionDomain: EXT },
    );
    expect(out.excludedInitiatorDomains).toEqual([EXT]);
  });

  it('does not emit the unsupported excludedRequestHeaders property', () => {
    const out = attachLiveBypassExclusion({ urlFilter: 'openheaders.io' }, new Set(['wflowaa1', 'wflowbb2']), {
      extensionDomain: EXT,
    });
    expect(out).not.toHaveProperty('excludedRequestHeaders');
  });
});

describe('computeRuleLiveBypass', () => {
  beforeEach(() => {
    liveVarStore.__resetForTests();
    // Prime the store so assertLoaded() inside mutators doesn't throw;
    // here we only need reads, but hydrate ties the internal workspaceId
    // to a real one so the store's loader guards pass.
    vi.spyOn(workspaceStore, 'getActiveWorkspaceId').mockReturnValue('ws-1');
  });

  afterEach(() => {
    resetResolver();
    vi.restoreAllMocks();
  });

  it('returns the workflow uid for a rule referencing an enabled LV', async () => {
    await liveVarStore.hydrateFromStorage();
    liveVarStore.createLiveVariable({
      name: LV_A.name,
      workflowUid: LV_A.workflowUid,
      stepId: LV_A.stepId,
      captureName: LV_A.captureName,
    });

    const rule = makeHeaderRule('Bearer {{live.token}}');
    const result = computeRuleLiveBypass(rule);
    expect([...result]).toEqual([LV_A.workflowUid]);
  });

  it('ignores references to disabled LVs (no feedback-loop risk)', async () => {
    await liveVarStore.hydrateFromStorage();
    liveVarStore.createLiveVariable({
      name: LV_B_DISABLED.name,
      workflowUid: LV_B_DISABLED.workflowUid,
      stepId: LV_B_DISABLED.stepId,
      captureName: LV_B_DISABLED.captureName,
      enabled: false,
    });

    const rule = makeHeaderRule('X-CSRF: {{live.csrf}}');
    const result = computeRuleLiveBypass(rule);
    expect(result.size).toBe(0);
  });

  it('collects multiple distinct workflow uids for a rule touching several LVs', async () => {
    await liveVarStore.hydrateFromStorage();
    liveVarStore.createLiveVariable({
      name: LV_A.name,
      workflowUid: LV_A.workflowUid,
      stepId: LV_A.stepId,
      captureName: LV_A.captureName,
    });
    liveVarStore.createLiveVariable({
      name: 'csrf',
      workflowUid: 'wflowbb2',
      stepId: 'setup',
      captureName: 'token',
    });

    const rule = makeHeaderRule('Bearer {{live.token}} / {{live.csrf}}');
    const result = computeRuleLiveBypass(rule);
    expect(new Set(result)).toEqual(new Set(['wflowaa1', 'wflowbb2']));
  });

  it('returns an empty set for a rule with no live references', async () => {
    await liveVarStore.hydrateFromStorage();
    liveVarStore.createLiveVariable({
      name: LV_A.name,
      workflowUid: LV_A.workflowUid,
      stepId: LV_A.stepId,
      captureName: LV_A.captureName,
    });

    const rule = makeHeaderRule('Bearer {{env.API_TOKEN}}');
    const result = computeRuleLiveBypass(rule);
    expect(result.size).toBe(0);
  });

  it('returns an empty set for a rule referencing an LV that does not exist', async () => {
    await liveVarStore.hydrateFromStorage();
    // No LV named `phantom` in the store.
    const rule = makeHeaderRule('Bearer {{live.phantom}}');
    const result = computeRuleLiveBypass(rule);
    expect(result.size).toBe(0);
  });
});
