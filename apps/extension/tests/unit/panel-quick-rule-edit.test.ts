/**
 * Inspector quick-editor EDIT Save payloads for delay / block /
 * query-param / request-body — `quick-rule-edit.ts`.
 *
 * Same atomic-edit contract as `panel-response-rule-edit.test.ts`: the
 * popover commits in one gesture, so a published rule must carry
 * `published: true` in the same batch, and the conditions row joins
 * the batch only when supplied (dirty).
 */

import type { BlockRule, DelayRule, QueryParamRule, RequestBodyRule, RuleCondition } from '@openheaders/core/types';
import {
  buildBlockRuleUpdate,
  buildDelayRuleUpdate,
  buildQueryParamRuleUpdate,
  buildRequestBodyRuleUpdate,
  seedQueryParamRowsFromAction,
} from '@openheaders/ui/panel/data/rule-create/quick-rule-edit';
import { describe, expect, it } from 'vitest';

const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'request-domains', values: ['openheaders.io'] }];

function base<T extends string>(type: T) {
  return {
    schemaVersion: 5 as const,
    uid: 'rule-1',
    path: `rules/API/${type}`,
    name: `${type} rule`,
    enabled: true,
    type,
    conditions: [{ uid: 'c0', type: 'url-filter', values: ['https://openheaders.io/'] }] as RuleCondition[],
  };
}

describe('buildDelayRuleUpdate', () => {
  const rule: DelayRule = { ...base('delay'), action: { delayMs: 1000 } };

  it('applies the drafted delay and keeps a published rule published', () => {
    const updates = buildDelayRuleUpdate({ ...rule, published: true }, { delayMs: 2500 });
    expect(updates.action?.delayMs).toBe(2500);
    expect(updates.published).toBe(true);
    expect('conditions' in updates).toBe(false);
  });

  it('does not add a published flag for a draft rule', () => {
    const updates = buildDelayRuleUpdate(rule, { delayMs: 2500 });
    expect('published' in updates).toBe(false);
  });

  it('carries dirty conditions in the same batch', () => {
    const updates = buildDelayRuleUpdate({ ...rule, published: true }, { delayMs: 2500 }, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
    expect(updates.published).toBe(true);
  });

  it('falls back to the current delay when the input is cleared (gate makes this unreachable)', () => {
    const updates = buildDelayRuleUpdate(rule, { delayMs: null });
    expect(updates.action?.delayMs).toBe(1000);
  });
});

describe('buildBlockRuleUpdate', () => {
  const rule: BlockRule = { ...base('block'), action: {} };

  it('is conditions-only and keeps a published rule published', () => {
    const updates = buildBlockRuleUpdate({ ...rule, published: true }, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
    expect(updates.published).toBe(true);
    expect('action' in updates).toBe(false);
  });

  it('does not surprise-publish a draft rule', () => {
    const updates = buildBlockRuleUpdate(rule, CONDITIONS);
    expect('published' in updates).toBe(false);
  });
});

describe('query-param rows — seed and rebuild', () => {
  const rule: QueryParamRule = {
    ...base('query-param'),
    action: {
      params: [
        { uid: 'p1', operation: 'add', param: 'debug', value: 'true' },
        { uid: 'p2', operation: 'remove', param: 'utm_source' },
      ],
    },
  };

  it('seeds rows from the action preserving entry uids', () => {
    const rows = seedQueryParamRowsFromAction(rule.action);
    expect(rows).toEqual([
      { uid: 'p1', operation: 'add', param: 'debug', value: 'true' },
      { uid: 'p2', operation: 'remove', param: 'utm_source', value: '' },
    ]);
  });

  it('rebuilds entries from rows, dropping the value for remove ops', () => {
    const rows = seedQueryParamRowsFromAction(rule.action);
    const updates = buildQueryParamRuleUpdate({ ...rule, published: true }, rows);
    expect(updates.action?.params).toEqual([
      { uid: 'p1', operation: 'add', param: 'debug', value: 'true' },
      { uid: 'p2', operation: 'remove', param: 'utm_source' },
    ]);
    expect(updates.published).toBe(true);
  });

  it('carries dirty conditions in the same batch', () => {
    const updates = buildQueryParamRuleUpdate(rule, seedQueryParamRowsFromAction(rule.action), CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
  });
});

describe('buildRequestBodyRuleUpdate', () => {
  const rule: RequestBodyRule = {
    ...base('request-body'),
    action: {
      bodyType: 'static',
      requestBody: '{"a":1}',
      resourceType: 'graphql',
      graphqlFilter: { key: 'operationName', operator: 'Equals', value: 'GetUsers' },
    },
  };

  it('applies the drafted body and preserves the fields the editor does not surface', () => {
    const updates = buildRequestBodyRuleUpdate({ ...rule, published: true }, { requestBody: '{"a":2}' });
    expect(updates.action?.requestBody).toBe('{"a":2}');
    expect(updates.action?.bodyType).toBe('static');
    expect(updates.action?.resourceType).toBe('graphql');
    expect(updates.action?.graphqlFilter).toEqual({ key: 'operationName', operator: 'Equals', value: 'GetUsers' });
    expect(updates.published).toBe(true);
  });

  it('does not surprise-publish a draft rule', () => {
    const updates = buildRequestBodyRuleUpdate(rule, { requestBody: '{"a":2}' });
    expect('published' in updates).toBe(false);
  });
});
