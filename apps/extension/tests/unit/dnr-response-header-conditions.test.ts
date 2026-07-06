/**
 * Response-header condition compilation (Chrome 128+).
 *
 * Two contracts, both discovered by the playground's conditions-axis page:
 *
 *   1. A per-header condition row with a name but NO values is the
 *      legitimate "any value" form — `buildDnrCondition` must emit it
 *      (`values: undefined`), not drop it as an unconfigured row.
 *   2. Chrome evaluates response-header conditions only after the reply's
 *      headers arrive, so a rule matched on them cannot modify REQUEST
 *      headers — one such rule rejects the entire updateDynamicRules
 *      batch atomically. The header compiler must drop the request side
 *      (including the Live Rules Mode cache-bypass injection) on those
 *      rules instead of poisoning the batch.
 */
import type { HeaderRule, RuleCondition } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/utils', async () => {
  const actual = await vi.importActual<typeof import('@openheaders/core/utils')>('@openheaders/core/utils');
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

import type { CompilerContext } from '@openheaders/rule-engine/builders';
import { buildDnrCondition, CHROMIUM_RESOURCE_VOCABULARY, headerCompiler } from '@openheaders/rule-engine/builders';

function makeCtx(start = 1, liveRulesMode = true): CompilerContext {
  let id = start;
  return { allocateId: () => id++, settings: { liveRulesMode, resourceVocabulary: CHROMIUM_RESOURCE_VOCABULARY } };
}

function makeRule(conditions: RuleCondition[], action: HeaderRule['action']): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'h1',
    path: 'rules/header',
    name: 'Rule',
    type: 'header',
    enabled: true,
    conditions,
    action,
  };
}

describe('buildDnrCondition — per-header rows', () => {
  it('keeps a value-less response-header row (any-value match)', () => {
    const { base } = buildDnrCondition([
      { uid: 'tc1', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tc2', type: 'response-header', headerName: 'X-OH-Echo', values: [] },
    ]);
    expect(base.responseHeaders).toEqual([{ header: 'X-OH-Echo', values: undefined }]);
  });

  it('keeps a value-less exclude-response-header row', () => {
    const { base } = buildDnrCondition([
      { uid: 'tc1', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
      { uid: 'tc2', type: 'exclude-response-header', headerName: 'X-OH-Echo', values: [] },
    ]);
    expect(base.excludedResponseHeaders).toEqual([{ header: 'X-OH-Echo', values: undefined }]);
  });

  it('carries header values when present', () => {
    const { base } = buildDnrCondition([
      { uid: 'tc1', type: 'response-header', headerName: 'X-OH-Echo', values: ['true'] },
    ]);
    expect(base.responseHeaders).toEqual([{ header: 'X-OH-Echo', values: ['true'] }]);
  });

  it('still drops a per-header row with no header name', () => {
    const { base } = buildDnrCondition([{ uid: 'tc1', type: 'response-header', values: [] }]);
    expect(base.responseHeaders).toBeUndefined();
  });
});

describe('headerCompiler — response-header-matched rules stay response-only', () => {
  const RH_CONDITIONS: RuleCondition[] = [
    { uid: 'tc1', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
    { uid: 'tc2', type: 'response-header', headerName: 'X-OH-Echo', values: ['true'] },
  ];

  it('skips the Live Rules Mode request-side injection', () => {
    const plan = headerCompiler.compile(
      makeRule(RH_CONDITIONS, {
        requestHeaders: [],
        responseHeaders: [{ uid: 'tm1', operation: 'override', headerName: 'X-Custom', value: 'yes' }],
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.action.requestHeaders).toBeUndefined();
      expect(r.action.responseHeaders).toHaveLength(1);
      expect(r.condition.responseHeaders).toEqual([{ header: 'X-OH-Echo', values: ['true'] }]);
    }
  });

  it("drops the user's own request-header modifications", () => {
    const plan = headerCompiler.compile(
      makeRule(RH_CONDITIONS, {
        requestHeaders: [{ uid: 'tm1', operation: 'override', headerName: 'Authorization', value: 'Bearer xyz' }],
        responseHeaders: [{ uid: 'tm2', operation: 'override', headerName: 'X-Custom', value: 'yes' }],
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.action.requestHeaders).toBeUndefined();
    }
  });

  it('emits nothing when only request-header modifications remain', () => {
    const plan = headerCompiler.compile(
      makeRule(RH_CONDITIONS, {
        requestHeaders: [{ uid: 'tm1', operation: 'override', headerName: 'Authorization', value: 'Bearer xyz' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    expect(plan.dynamicRules ?? []).toEqual([]);
  });

  it('exclude-response-header conditions get the same treatment', () => {
    const plan = headerCompiler.compile(
      makeRule(
        [
          { uid: 'tc1', type: 'url-filter', values: ['*://api.openheaders.io/*'] },
          { uid: 'tc2', type: 'exclude-response-header', headerName: 'X-OH-Echo', values: [] },
        ],
        {
          requestHeaders: [],
          responseHeaders: [{ uid: 'tm1', operation: 'override', headerName: 'X-Custom', value: 'yes' }],
        },
      ),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.action.requestHeaders).toBeUndefined();
      expect(r.condition.excludedResponseHeaders).toEqual([{ header: 'X-OH-Echo', values: undefined }]);
    }
  });

  it('rules without response-header conditions keep the request side untouched', () => {
    const plan = headerCompiler.compile(
      makeRule([{ uid: 'tc1', type: 'url-filter', values: ['*://api.openheaders.io/*'] }], {
        requestHeaders: [{ uid: 'tm1', operation: 'override', headerName: 'Authorization', value: 'Bearer xyz' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const reqMods = (plan.dynamicRules ?? [])[0]!.action.requestHeaders ?? [];
    expect(reqMods.map((m) => m.header)).toEqual(['Cache-Control', 'Pragma', 'Authorization']);
  });
});
