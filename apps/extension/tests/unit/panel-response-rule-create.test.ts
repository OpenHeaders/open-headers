/**
 * Inspector response quick-editor CREATE seed — `response-rule-create`.
 *
 * Counterpart of `panel-response-rule-edit.test.ts` for the create
 * mode: the popover SEEDS conditions from the captured draft (URL per
 * strategy + request methods — `buildDraftConditions`, pinned here) and
 * the seed passes the edited list through unchanged, carries the
 * captured action fields the compact editor doesn't surface, applies
 * the user's edits, and leaves publication to the write client
 * (`applyRuleCreate` forces `published: false`; the save flow publishes
 * explicitly).
 */

import type { ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import {
  buildResponseRuleSeed,
  buildResponseRuleSeedFromWire,
  mergeQuickIntoResponseDraft,
  seedQuickDraft,
} from '@openheaders/ui/panel/data/rule-create/response-rule-create';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';
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

const CONDITIONS: RuleCondition[] = [
  { uid: 'c1', type: 'url-filter', values: ['https://api.openheaders.io/v1/users?page=2'] },
  { uid: 'c2', type: 'request-methods', values: ['GET'] },
];

describe('seedQuickDraft', () => {
  it('seeds the editable fields from the captured draft', () => {
    expect(seedQuickDraft(makeDraft())).toEqual({
      statusCode: 0,
      contentType: 'application/json',
      responseBody: '{\n  "users": []\n}',
    });
  });

  it('seeds a minified capture as its formatted view', () => {
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    expect(seedQuickDraft(draft).responseBody).toBe('{\n  "users": [],\n  "total": 0\n}');
  });

  it('seeds non-JSON bodies verbatim', () => {
    const draft = makeDraft({ responseBody: '<html>openheaders.io</html>', contentType: 'text/html' });
    expect(seedQuickDraft(draft).responseBody).toBe('<html>openheaders.io</html>');
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

  it('hands off a formatted-view edit re-encoded to the wire profile', () => {
    const draft = makeDraft({ responseBody: '{"users":[]}' });
    const quick = { ...seedQuickDraft(draft), responseBody: '{\n  "users": [\n    "oh"\n  ]\n}' };
    expect(mergeQuickIntoResponseDraft(draft, quick).responseBody).toBe('{"users":["oh"]}');
  });

  it('an untouched formatted view hands off the captured bytes exactly', () => {
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    expect(mergeQuickIntoResponseDraft(draft, seedQuickDraft(draft)).responseBody).toBe('{"users":[],"total":0}');
  });
});

describe('conditions seeding (buildDraftConditions) + pass-through', () => {
  it('seeds an exact url-filter and request-methods condition', () => {
    const conditions = buildDraftConditions(makeDraft(), 'exact');
    expect(conditions).toHaveLength(2);
    const [urlCond, methodCond] = conditions;
    expect(urlCond.type).toBe('url-filter');
    expect(urlCond.values).toEqual(['https://api.openheaders.io/v1/users?page=2']);
    expect(urlCond.uid).toBeTruthy();
    expect(methodCond.type).toBe('request-methods');
    expect(methodCond.values).toEqual(['GET']);
  });

  it('honors the workspace draft-URL strategy', () => {
    const conditions = buildDraftConditions(makeDraft(), 'host-only');
    expect(conditions[0].values).toEqual(['https://api.openheaders.io/*']);
  });

  it('omits the methods condition when the capture carried none', () => {
    const conditions = buildDraftConditions(makeDraft({ requestMethods: undefined }), 'exact');
    expect(conditions).toHaveLength(1);
    expect(conditions[0].type).toBe('url-filter');
  });

  it('the seed passes the edited conditions through unchanged', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', CONDITIONS);
    expect(seed.conditions).toBe(CONDITIONS);
  });
});

describe('buildResponseRuleSeed — action + identity', () => {
  it('applies the drafted status, content-type and body', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', CONDITIONS);
    expect(seed.action.statusCode).toBe(404);
    expect(seed.action.contentType).toBe('text/plain');
    expect(seed.action.responseBody).toBe('not found');
  });

  it('re-encodes a formatted-view edit to the captured wire profile', () => {
    const draft = makeDraft({ responseBody: '{"users":[]}' });
    const quick = { ...seedQuickDraft(draft), responseBody: '{\n  "users": [\n    1\n  ]\n}' };
    expect(buildResponseRuleSeed(draft, quick, 'Rule', CONDITIONS).action.responseBody).toBe('{"users":[1]}');
  });

  it('an untouched formatted view saves the captured bytes exactly', () => {
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    const seed = buildResponseRuleSeed(draft, seedQuickDraft(draft), 'Rule', CONDITIONS);
    expect(seed.action.responseBody).toBe('{"users":[],"total":0}');
  });

  it('carries the captured fields the compact editor does not surface', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Rule', CONDITIONS);
    expect(seed.action.responseSource).toBe('network');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
    expect(seed.action.responseHeaders).toEqual({});
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildResponseRuleSeed(makeDraft(), QUICK, 'Mock users', CONDITIONS);
    expect(seed.name).toBe('Mock users');
    expect(seed.enabled).toBe(true);
    expect(seed.type).toBe('response');
    expect('published' in seed).toBe(false);
  });

  it('falls back to mock/static/rest defaults for a bare draft', () => {
    const draft = makeDraft({ responseSource: undefined, bodyType: undefined, resourceType: undefined });
    const seed = buildResponseRuleSeed(draft, QUICK, 'Rule', CONDITIONS);
    expect(seed.action.responseSource).toBe('mock');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
  });
});

describe('buildResponseRuleSeedFromWire — the rule-editor tab document', () => {
  it('seeds the wire-space body VERBATIM — a Raw-mode profile change is honored', () => {
    // The tab's FormatAwareBodyEditor already encoded the form value; a
    // deliberately re-indented Raw edit must not snap back to the
    // captured profile.
    const draft = makeDraft({ responseBody: '{"users":[]}' });
    const rawEdit = '{\n    "users": []\n}';
    const seed = buildResponseRuleSeedFromWire(draft, { ...QUICK, responseBody: rawEdit }, 'Rule', CONDITIONS);
    expect(seed.action.responseBody).toBe(rawEdit);
  });

  it('an untouched wire body seeds the captured bytes exactly', () => {
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    const quick = { statusCode: 0, contentType: 'application/json', responseBody: '{"users":[],"total":0}' };
    expect(buildResponseRuleSeedFromWire(draft, quick, 'Rule', CONDITIONS).action.responseBody).toBe(
      '{"users":[],"total":0}',
    );
  });

  it('shares the popover seed assembly: identity, conditions and unsurfaced fields', () => {
    const seed = buildResponseRuleSeedFromWire(makeDraft(), QUICK, 'Mock users', CONDITIONS);
    expect(seed.name).toBe('Mock users');
    expect(seed.enabled).toBe(true);
    expect(seed.type).toBe('response');
    expect(seed.conditions).toBe(CONDITIONS);
    expect(seed.action.statusCode).toBe(404);
    expect(seed.action.contentType).toBe('text/plain');
    expect(seed.action.responseSource).toBe('network');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
    expect('published' in seed).toBe(false);
  });
});
