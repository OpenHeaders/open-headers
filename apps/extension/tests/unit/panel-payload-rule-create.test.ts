/**
 * Inspector Payload-tab quick-editor CREATE seeds — `payload-rule-create`.
 *
 * Counterpart of `panel-url-rule-create.test.ts` for the Payload tab's
 * two CTAs: request-body and query-param seeds must derive conditions
 * from the captured draft, carry the edited action fields, mint row
 * identity on query-param entries, and honor the per-operation entry
 * shape (remove drops the value, remove-all drops param and value).
 */

import type { QueryParamRuleDraft, RequestBodyRuleDraft } from '@openheaders/core/types';
import {
  appendQueryParamQuickRow,
  buildQueryParamRuleSeed,
  buildRequestBodyRuleSeed,
  generateQueryParamRuleName,
  generateRequestBodyRuleName,
  mergeQuickIntoQueryParamDraft,
  mergeQuickIntoRequestBodyDraft,
  type QueryParamQuickRow,
  queryParamRowsValid,
  seedQueryParamQuickRows,
  seedRequestBodyQuickDraft,
} from '@openheaders/ui/panel/data/payload-rule-create';
import { describe, expect, it } from 'vitest';

const URL = 'https://api.openheaders.io/v1/users?page=2&sort=name';

function makeBodyDraft(over: Partial<RequestBodyRuleDraft> = {}): RequestBodyRuleDraft {
  return {
    type: 'request-body',
    url: URL,
    requestMethods: ['POST'],
    bodyType: 'static',
    requestBody: '{"name":"oh"}',
    resourceType: 'rest',
    ...over,
  };
}

function makeParamDraft(over: Partial<QueryParamRuleDraft> = {}): QueryParamRuleDraft {
  return {
    type: 'query-param',
    url: URL,
    requestMethods: ['GET'],
    params: [
      { operation: 'override', param: 'page', value: '2' },
      { operation: 'override', param: 'sort', value: 'name' },
    ],
    ...over,
  };
}

describe('seedRequestBodyQuickDraft', () => {
  it('seeds the captured body and defaults to empty', () => {
    expect(seedRequestBodyQuickDraft(makeBodyDraft())).toEqual({ requestBody: '{"name":"oh"}' });
    expect(seedRequestBodyQuickDraft(makeBodyDraft({ requestBody: undefined }))).toEqual({ requestBody: '' });
  });
});

describe('mergeQuickIntoRequestBodyDraft', () => {
  it('folds the edited body, preserving the capture context', () => {
    const merged = mergeQuickIntoRequestBodyDraft(makeBodyDraft(), { requestBody: '{"name":"edited"}' });
    expect(merged.requestBody).toBe('{"name":"edited"}');
    expect(merged.url).toBe(URL);
    expect(merged.resourceType).toBe('rest');
  });
});

describe('buildRequestBodyRuleSeed', () => {
  it('derives conditions and carries the edited body with the captured shape', () => {
    const seed = buildRequestBodyRuleSeed(makeBodyDraft(), { requestBody: '{"n":1}' }, 'Rule', 'exact');
    expect(seed.type).toBe('request-body');
    expect(seed.conditions).toHaveLength(2);
    expect(seed.conditions[0].values).toEqual([URL]);
    expect(seed.conditions[1].values).toEqual(['POST']);
    expect(seed.action).toEqual({ bodyType: 'static', requestBody: '{"n":1}', resourceType: 'rest' });
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildRequestBodyRuleSeed(makeBodyDraft(), { requestBody: '' }, 'Swap payload', 'exact');
    expect(seed.name).toBe('Swap payload');
    expect(seed.enabled).toBe(true);
    expect('published' in seed).toBe(false);
  });
});

describe('seedQueryParamQuickRows', () => {
  it('seeds one row per captured param with minted uids', () => {
    const rows = seedQueryParamQuickRows(makeParamDraft());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ operation: 'override', param: 'page', value: '2' });
    expect(rows[1]).toMatchObject({ operation: 'override', param: 'sort', value: 'name' });
    expect(rows[0].uid).toBeTruthy();
    expect(rows[0].uid).not.toBe(rows[1].uid);
  });

  it('scaffolds one empty Add row when nothing was captured', () => {
    const rows = seedQueryParamQuickRows(makeParamDraft({ params: [] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ operation: 'add', param: '', value: '' });
  });
});

describe('queryParamRowsValid', () => {
  const row = (over: Partial<QueryParamQuickRow>): QueryParamQuickRow => ({
    uid: 'u1',
    operation: 'add',
    param: 'p',
    value: 'v',
    ...over,
  });

  it('requires at least one row and a param on every named-op row', () => {
    expect(queryParamRowsValid([])).toBe(false);
    expect(queryParamRowsValid([row({ param: ' ' })])).toBe(false);
    expect(queryParamRowsValid([row({})])).toBe(true);
  });

  it('remove-all rows need no param', () => {
    expect(queryParamRowsValid([row({ operation: 'remove-all', param: '' })])).toBe(true);
  });
});

describe('mergeQuickIntoQueryParamDraft', () => {
  it('folds the rows with per-operation shapes', () => {
    const rows: QueryParamQuickRow[] = [
      { uid: 'u1', operation: 'add', param: 'debug', value: '1' },
      { uid: 'u2', operation: 'remove', param: 'sort', value: 'stale' },
      { uid: 'u3', operation: 'remove-all', param: 'ignored', value: 'ignored' },
    ];
    const merged = mergeQuickIntoQueryParamDraft(makeParamDraft(), rows);
    expect(merged.params).toEqual([
      { operation: 'add', param: 'debug', value: '1' },
      { operation: 'remove', param: 'sort' },
      { operation: 'remove-all', param: '' },
    ]);
    expect(merged.url).toBe(URL);
  });
});

describe('appendQueryParamQuickRow', () => {
  it('appends an empty Add row without mutating the input', () => {
    const rows = seedQueryParamQuickRows(makeParamDraft());
    const grown = appendQueryParamQuickRow(rows);
    expect(rows).toHaveLength(2);
    expect(grown).toHaveLength(3);
    expect(grown[2]).toMatchObject({ operation: 'add', param: '', value: '' });
  });
});

describe('name generation', () => {
  it('uses the workbench base labels and counts up past taken names', () => {
    expect(generateRequestBodyRuleName([])).toBe('New API Request Body Rule');
    expect(generateQueryParamRuleName([])).toBe('New Query Param Rule');
    expect(generateQueryParamRuleName([{ name: 'New Query Param Rule' }])).toBe('New Query Param Rule (2)');
  });
});

describe('buildQueryParamRuleSeed', () => {
  it('carries row identity into the persisted entries', () => {
    const rows = seedQueryParamQuickRows(makeParamDraft());
    const seed = buildQueryParamRuleSeed(makeParamDraft(), rows, 'Rule', 'exact');
    expect(seed.type).toBe('query-param');
    expect(seed.action.params).toHaveLength(2);
    expect(seed.action.params[0]).toEqual({ uid: rows[0].uid, operation: 'override', param: 'page', value: '2' });
  });

  it('honors per-operation entry shapes', () => {
    const rows: QueryParamQuickRow[] = [
      { uid: 'u1', operation: 'remove', param: 'sort', value: 'stale' },
      { uid: 'u2', operation: 'remove-all', param: 'x', value: 'y' },
    ];
    const seed = buildQueryParamRuleSeed(makeParamDraft(), rows, 'Rule', 'exact');
    expect(seed.action.params[0]).toEqual({ uid: 'u1', operation: 'remove', param: 'sort' });
    expect(seed.action.params[1]).toEqual({ uid: 'u2', operation: 'remove-all', param: '' });
  });

  it('derives conditions and leaves publication to the write client', () => {
    const seed = buildQueryParamRuleSeed(makeParamDraft(), seedQueryParamQuickRows(makeParamDraft()), 'Rule', 'exact');
    expect(seed.conditions[0].type).toBe('url-filter');
    expect(seed.conditions[0].values).toEqual([URL]);
    expect(seed.conditions[1].values).toEqual(['GET']);
    expect('published' in seed).toBe(false);
  });
});
