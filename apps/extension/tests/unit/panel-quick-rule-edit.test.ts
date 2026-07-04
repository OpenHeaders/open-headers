/**
 * Inspector quick-editor EDIT Save payloads for delay / block /
 * query-param / request-body — `quick-rule-edit.ts`.
 *
 * Same atomic-edit contract as `panel-response-rule-edit.test.ts`: the
 * popover commits in one gesture, so a published rule must carry
 * `published: true` in the same batch, and the conditions row joins
 * the batch only when supplied (dirty).
 */

import type {
  AuthRule,
  BlockRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  QueryParamRule,
  RequestBodyRule,
  RuleCondition,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import {
  buildAuthRuleUpdate,
  buildBlockRuleUpdate,
  buildDelayRuleUpdate,
  buildHeaderRuleUpdate,
  buildInjectRuleUpdate,
  buildQueryParamRuleUpdate,
  buildRequestBodyRuleUpdate,
  buildSseRuleUpdate,
  buildWsRuleUpdate,
  firstHeaderModRowIssue,
  seedHeaderModRows,
  seedInjectDraft,
  seedMessageDraft,
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

describe('inject — seed and rebuild', () => {
  const codeRule: InjectRule = {
    ...base('inject'),
    action: { injectType: 'script', code: 'console.log(1);', source: 'code', position: 'head', bypassCSP: true },
  };
  const urlRule: InjectRule = {
    ...base('inject'),
    action: {
      injectType: 'css',
      code: '',
      sourceUrl: 'https://openheaders.io/theme.css',
      source: 'url',
      position: 'body-end',
    },
  };

  it('seeds only the field the code source uses', () => {
    expect(seedInjectDraft(codeRule)).toEqual({ code: 'console.log(1);' });
    expect(seedInjectDraft(urlRule)).toEqual({ sourceUrl: 'https://openheaders.io/theme.css' });
  });

  it('rebuilds a code-source action preserving type, position and CSP bypass', () => {
    const updates = buildInjectRuleUpdate({ ...codeRule, published: true }, { code: 'console.log(2);' });
    expect(updates.action).toEqual({
      injectType: 'script',
      code: 'console.log(2);',
      source: 'code',
      position: 'head',
      bypassCSP: true,
    });
    expect(updates.published).toBe(true);
  });

  it('rebuilds a url-source action touching only the source URL', () => {
    const updates = buildInjectRuleUpdate(urlRule, { sourceUrl: 'https://openheaders.io/other.css' });
    expect(updates.action?.sourceUrl).toBe('https://openheaders.io/other.css');
    expect(updates.action?.code).toBe('');
    expect(updates.action?.injectType).toBe('css');
    expect('published' in updates).toBe(false);
  });

  it('carries dirty conditions in the same batch', () => {
    const updates = buildInjectRuleUpdate(codeRule, { code: 'console.log(2);' }, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
  });
});

describe('ws/sse messages — seed and rebuild', () => {
  const wsRule: WsRule = {
    ...base('ws'),
    action: {
      operation: 'modify',
      direction: 'receive',
      messageFilter: { matchType: 'contains', value: 'heartbeat' },
      payload: '{"type":"heartbeat"}',
    },
  };
  const sseRule: SseRule = {
    ...base('sse'),
    action: { operation: 'inject', eventName: 'update', payload: '{"v":1}', injectTrigger: 'open' },
  };
  const dropRule: WsRule = {
    ...base('ws'),
    action: { operation: 'drop', direction: 'send' },
  };

  it('seeds the payload for modify/inject and null for drop', () => {
    expect(seedMessageDraft(wsRule)).toEqual({ payload: '{"type":"heartbeat"}' });
    expect(seedMessageDraft(sseRule)).toEqual({ payload: '{"v":1}' });
    expect(seedMessageDraft(dropRule)).toEqual({ payload: null });
  });

  it('rebuilds the ws action preserving direction and filter', () => {
    const updates = buildWsRuleUpdate({ ...wsRule, published: true }, { payload: '{"type":"ping"}' });
    expect(updates.action).toEqual({
      operation: 'modify',
      direction: 'receive',
      messageFilter: { matchType: 'contains', value: 'heartbeat' },
      payload: '{"type":"ping"}',
    });
    expect(updates.published).toBe(true);
  });

  it('rebuilds the sse action preserving event name and inject trigger', () => {
    const updates = buildSseRuleUpdate(sseRule, { payload: '{"v":2}' }, CONDITIONS);
    expect(updates.action).toEqual({ operation: 'inject', eventName: 'update', payload: '{"v":2}', injectTrigger: 'open' });
    expect(updates.conditions).toBe(CONDITIONS);
  });

  it('is conditions-only for a drop rule — the action is left untouched', () => {
    const updates = buildWsRuleUpdate({ ...dropRule, published: true }, { payload: null }, CONDITIONS);
    expect('action' in updates).toBe(false);
    expect(updates.conditions).toBe(CONDITIONS);
    expect(updates.published).toBe(true);
  });
});

describe('buildAuthRuleUpdate', () => {
  const rule: AuthRule = {
    ...base('auth'),
    action: { username: 'dev-user', password: '{{vault.STAGING_PW}}' },
  };

  it('applies both credentials and keeps a published rule published', () => {
    const updates = buildAuthRuleUpdate({ ...rule, published: true }, { username: 'qa-user', password: '{{vault.QA_PW}}' });
    expect(updates.action).toEqual({ username: 'qa-user', password: '{{vault.QA_PW}}' });
    expect(updates.published).toBe(true);
  });

  it('does not surprise-publish a draft rule', () => {
    const updates = buildAuthRuleUpdate(rule, { username: 'qa-user', password: '' });
    expect('published' in updates).toBe(false);
  });

  it('carries dirty conditions in the same batch', () => {
    const updates = buildAuthRuleUpdate(rule, { username: 'dev-user', password: 'x' }, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
  });
});

describe('header rows — seed, rebuild and validation', () => {
  const rule: HeaderRule = {
    ...base('header'),
    action: {
      requestHeaders: [
        { uid: 'm1', operation: 'override', headerName: 'X-Debug', value: 'on' },
        { uid: 'm2', operation: 'remove', headerName: 'X-Trace' },
      ],
      responseHeaders: [
        { uid: 'm3', operation: 'merge', headerName: 'Cache-Control', value: 'no-store', mergeSeparator: ', ' },
      ],
    },
  };

  it('seeds rows across both directions preserving mod uids', () => {
    expect(seedHeaderModRows(rule.action)).toEqual([
      { uid: 'm1', direction: 'request', operation: 'override', headerName: 'X-Debug', value: 'on' },
      { uid: 'm2', direction: 'request', operation: 'remove', headerName: 'X-Trace', value: '' },
      {
        uid: 'm3',
        direction: 'response',
        operation: 'merge',
        headerName: 'Cache-Control',
        value: 'no-store',
        mergeSeparator: ', ',
      },
    ]);
  });

  it('rebuilds both lists from rows, honoring per-operation shapes', () => {
    const rows = seedHeaderModRows(rule.action);
    const updates = buildHeaderRuleUpdate({ ...rule, published: true }, rows);
    expect(updates.action).toEqual(rule.action);
    expect(updates.published).toBe(true);
  });

  it('moves a row across directions when its direction changes', () => {
    const rows = seedHeaderModRows(rule.action).map((r) =>
      r.uid === 'm1' ? { ...r, direction: 'response' as const } : r,
    );
    const updates = buildHeaderRuleUpdate(rule, rows, CONDITIONS);
    expect(updates.action?.requestHeaders.map((m) => m.uid)).toEqual(['m2']);
    expect(updates.action?.responseHeaders.map((m) => m.uid)).toEqual(['m1', 'm3']);
    expect(updates.conditions).toBe(CONDITIONS);
    expect('published' in updates).toBe(false);
  });

  it('flags the first broken row and passes templates through', () => {
    const rows = seedHeaderModRows(rule.action);
    expect(firstHeaderModRowIssue(rows)).toBeNull();
    expect(firstHeaderModRowIssue([{ ...rows[0]!, headerName: '' }])).toEqual({
      uid: 'm1',
      message: 'Header name is required.',
    });
    expect(firstHeaderModRowIssue([{ ...rows[0]!, headerName: 'bad name' }])?.uid).toBe('m1');
    expect(firstHeaderModRowIssue([{ ...rows[0]!, headerName: '{{collection.HEADER}}' }])).toBeNull();
  });
});
