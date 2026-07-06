/**
 * Query-param compiler — remove-all composition contract.
 *
 * Remove All compiles to a full-query replacement, and Add / Replace
 * entries in the same rule become the new query string — the only DNR
 * shape that composes "clear everything, then add" in one action.
 * Replace Only and Remove entries are inert alongside Remove All.
 */
import type { QueryParamRule } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { CompilerContext } from '@openheaders/rule-engine/builders';
import { CHROMIUM_RESOURCE_VOCABULARY, queryParamCompiler } from '@openheaders/rule-engine/builders';
import type { QueryParamEntry } from '@openheaders/core/types';

function makeCtx(): CompilerContext {
  let id = 1;
  return { allocateId: () => id++, settings: { liveRulesMode: true, resourceVocabulary: CHROMIUM_RESOURCE_VOCABULARY } };
}

function qpRule(params: QueryParamEntry[]): QueryParamRule {
  return {
    schemaVersion: 5,
    uid: 'q1',
    path: 'rules/qp',
    name: 'qp',
    type: 'query-param',
    enabled: true,
    conditions: [{ uid: 'tcd00001', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: { params },
  };
}

function redirectOf(rule: QueryParamRule) {
  const plan = queryParamCompiler.compile(rule, makeCtx());
  return (plan.dynamicRules ?? [])[0]?.action.redirect;
}

describe('queryParamCompiler — remove-all composition', () => {
  it('remove-all alone clears the query', () => {
    const redirect = redirectOf(qpRule([{ uid: 'qp000001', operation: 'remove-all', param: '' }]));
    expect(redirect).toEqual({ transform: { query: '' } });
  });

  it('remove-all + add composes into a full-query replacement', () => {
    const redirect = redirectOf(
      qpRule([
        { uid: 'qp000001', operation: 'remove-all', param: '' },
        { uid: 'qp000002', operation: 'add', param: 'keep', value: '1' },
        { uid: 'qp000003', operation: 'add', param: 'lang', value: 'en us' },
      ]),
    );
    expect(redirect).toEqual({ transform: { query: '?keep=1&lang=en%20us' } });
  });

  it('remove-all ignores replace-only and remove entries (nothing left to act on)', () => {
    const redirect = redirectOf(
      qpRule([
        { uid: 'qp000001', operation: 'remove-all', param: '' },
        { uid: 'qp000002', operation: 'override', param: 'ro', value: 'x' },
        { uid: 'qp000003', operation: 'remove', param: 'gone' },
      ]),
    );
    expect(redirect).toEqual({ transform: { query: '' } });
  });
});
