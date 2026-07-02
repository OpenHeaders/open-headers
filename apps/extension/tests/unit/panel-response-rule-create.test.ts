/**
 * Inspector response quick-editor CREATE seed — `response-rule-create`.
 *
 * Counterpart of `panel-response-rule-edit.test.ts` for the create
 * mode: the seed must derive conditions from the captured draft (URL
 * per strategy + request methods), carry the captured action fields the
 * compact editor doesn't surface, apply the user's edits, and leave
 * publication to the write client (`applyRuleCreate` forces
 * `published: false`; the save flow publishes explicitly).
 */

import type { ResponseRuleDraft } from '@openheaders/core/types';
import {
  buildResponseRuleSeed,
  generateResponseRuleName,
  mergeQuickIntoResponseDraft,
  seedQuickDraft,
} from '@openheaders/ui/panel/data/response-rule-create';
import { describe, expect, it } from 'vitest';

function makeDraft(over: Partial<ResponseRuleDraft> = {}): ResponseRuleDraft {
  return {
    type: 'response',
    url: 'https://api.openheaders.io/v1/users?page=2',
    requestMethods: ['GET'],
    responseSource: 'network',
    bodyType: 'static',
    statusCode: 0,
    responseBody: '{\n  "users": []\n}',
    contentType: 'application/json',
    resourceType: 'rest',
    ...over,
  };
}

const QUICK = { statusCode: 404, contentType: 'text/plain', responseBody: 'not found' };

describe('seedQuickDraft', () => {
  it('seeds the editable fields from the captured draft', () => {
    expect(seedQuickDraft(makeDraft())).toEqual({
      statusCode: 0,
      contentType: 'application/json',
      responseBody: '{\n  "users": []\n}',
    });
  });

  it('defaults missing fields to keep-original / empty', () => {
    const draft = makeDraft({ statusCode: undefined, contentType: undefined, responseBody: undefined });
    expect(seedQuickDraft(draft)).toEqual({ statusCode: 0, contentType: '', responseBody: '' });
  });
});

describe('mergeQuickIntoResponseDraft', () => {
  it('folds the edits into the handoff draft, preserving the capture context', () => {
    const merged = mergeQuickIntoResponseDraft(makeDraft(), QUICK);
    expect(merged.statusCode).toBe(404);
    expect(merged.contentType).toBe('text/plain');
    expect(merged.responseBody).toBe('not found');
    expect(merged.url).toBe('https://api.openheaders.io/v1/users?page=2');
    expect(merged.requestMethods).toEqual(['GET']);
    expect(merged.responseSource).toBe('network');
  });
});

describe('generateResponseRuleName', () => {
  it('uses the base name when free', () => {
    expect(generateResponseRuleName([])).toBe('New API Response Rule');
  });

  it('counts up past taken names', () => {
    const rules = [{ name: 'New API Response Rule' }, { name: 'New API Response Rule (2)' }];
    expect(generateResponseRuleName(rules)).toBe('New API Response Rule (3)');
  });
});

describe('buildResponseRuleSeed — conditions', () => {
  it('derives an exact url-filter and request-methods condition', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', 'exact');
    expect(seed.conditions).toHaveLength(2);
    const [urlCond, methodCond] = seed.conditions;
    expect(urlCond.type).toBe('url-filter');
    expect(urlCond.values).toEqual(['https://api.openheaders.io/v1/users?page=2']);
    expect(urlCond.uid).toBeTruthy();
    expect(methodCond.type).toBe('request-methods');
    expect(methodCond.values).toEqual(['GET']);
  });

  it('honors the workspace draft-URL strategy', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', 'host-only');
    expect(seed.conditions[0].values).toEqual(['https://api.openheaders.io/*']);
  });

  it('omits the methods condition when the capture carried none', () => {
    const seed = buildResponseRuleSeed(makeDraft({ requestMethods: undefined }), QUICK, 'Rule', 'exact');
    expect(seed.conditions).toHaveLength(1);
    expect(seed.conditions[0].type).toBe('url-filter');
  });
});

describe('buildResponseRuleSeed — action + identity', () => {
  it('applies the drafted status, content-type and body', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', 'exact');
    expect(seed.action.statusCode).toBe(404);
    expect(seed.action.contentType).toBe('text/plain');
    expect(seed.action.responseBody).toBe('not found');
  });

  it('carries the captured fields the compact editor does not surface', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', 'exact');
    expect(seed.action.responseSource).toBe('network');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
    expect(seed.action.responseHeaders).toEqual({});
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Mock users', 'exact');
    expect(seed.name).toBe('Mock users');
    expect(seed.enabled).toBe(true);
    expect(seed.type).toBe('response');
    expect('published' in seed).toBe(false);
  });

  it('falls back to mock/static/rest defaults for a bare draft', () => {
    const draft = makeDraft({ responseSource: undefined, bodyType: undefined, resourceType: undefined });
    const seed = buildResponseRuleSeed(draft, QUICK, 'Rule', 'exact');
    expect(seed.action.responseSource).toBe('mock');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
  });
});
