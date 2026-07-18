/**
 * Response quick-editor / rule-editor tab CREATE seed —
 * `response-rule-create` (one wire-space plane for both surfaces).
 *
 * Counterpart of `panel-response-rule-edit.test.ts` for the create
 * mode: the editors SEED conditions from the captured draft (URL per
 * strategy + request methods — `buildDraftConditions`, pinned here) and
 * the seed passes the edited list through unchanged, carries the
 * captured action fields the compact editor doesn't surface, applies
 * the user's edits, stores the body AS IS (the form value is wire text
 * — `FormatAwareBodyEditor` encodes per edit), and leaves publication
 * to the write client (`applyRuleCreate` forces `published: false`;
 * the save flow publishes explicitly).
 */

import type { ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import {
  buildResponseRuleSeedFromWire,
  mergeQuickIntoResponseDraft,
  seedResponseQuickDraft,
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

describe('seedResponseQuickDraft', () => {
  it('seeds the editable fields from the captured draft', () => {
    expect(seedResponseQuickDraft(makeDraft())).toEqual({
      statusCode: 0,
      contentType: 'application/json',
      responseBody: '{\n  "users": []\n}',
    });
  });

  it('seeds the captured body VERBATIM — a minified capture stays minified', () => {
    // The body editor formats its own view; the form record must carry
    // the wire bytes so a no-edit save is byte-identical.
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    expect(seedResponseQuickDraft(draft).responseBody).toBe('{"users":[],"total":0}');
  });

  it('defaults missing fields to keep-original / empty', () => {
    const draft = makeDraft({ statusCode: undefined, contentType: undefined, responseBody: undefined });
    expect(seedResponseQuickDraft(draft)).toEqual({ statusCode: 0, contentType: '', responseBody: '' });
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

  it('hands the wire body off AS IS — no re-encode, no re-profile', () => {
    const draft = makeDraft({ responseBody: '{"users":[]}' });
    const rawEdit = '{\n    "users": []\n}';
    expect(mergeQuickIntoResponseDraft(draft, { ...QUICK, responseBody: rawEdit }).responseBody).toBe(rawEdit);
  });

  it('an untouched seed hands off the captured bytes exactly', () => {
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    expect(mergeQuickIntoResponseDraft(draft, seedResponseQuickDraft(draft)).responseBody).toBe(
      '{"users":[],"total":0}',
    );
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
    const seed = buildResponseRuleSeedFromWire(makeDraft(), QUICK, 'Rule', CONDITIONS);
    expect(seed.conditions).toBe(CONDITIONS);
  });
});

describe('buildResponseRuleSeedFromWire — action + identity', () => {
  it('applies the drafted status, content-type and body', () => {
    const seed = buildResponseRuleSeedFromWire(makeDraft(), QUICK, 'Rule', CONDITIONS);
    expect(seed.action.statusCode).toBe(404);
    expect(seed.action.contentType).toBe('text/plain');
    expect(seed.action.responseBody).toBe('not found');
  });

  it('seeds the wire-space body VERBATIM — a Raw-mode profile change is honored', () => {
    // The FormatAwareBodyEditor already encoded the form value; a
    // deliberately re-indented Raw edit must not snap back to the
    // captured profile.
    const draft = makeDraft({ responseBody: '{"users":[]}' });
    const rawEdit = '{\n    "users": []\n}';
    const seed = buildResponseRuleSeedFromWire(draft, { ...QUICK, responseBody: rawEdit }, 'Rule', CONDITIONS);
    expect(seed.action.responseBody).toBe(rawEdit);
  });

  it('an untouched seed saves the captured bytes exactly', () => {
    const draft = makeDraft({ responseBody: '{"users":[],"total":0}' });
    const seed = buildResponseRuleSeedFromWire(draft, seedResponseQuickDraft(draft), 'Rule', CONDITIONS);
    expect(seed.action.responseBody).toBe('{"users":[],"total":0}');
  });

  it('carries the captured fields the compact editor does not surface', () => {
    const seed = buildResponseRuleSeedFromWire(makeDraft(), QUICK, 'Rule', CONDITIONS);
    expect(seed.action.responseSource).toBe('network');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
    expect(seed.action.responseHeaders).toEqual({});
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildResponseRuleSeedFromWire(makeDraft(), QUICK, 'Mock users', CONDITIONS);
    expect(seed.name).toBe('Mock users');
    expect(seed.enabled).toBe(true);
    expect(seed.type).toBe('response');
    expect('published' in seed).toBe(false);
  });

  it('falls back to mock/static/rest defaults for a bare draft', () => {
    const draft = makeDraft({ responseSource: undefined, bodyType: undefined, resourceType: undefined });
    const seed = buildResponseRuleSeedFromWire(draft, QUICK, 'Rule', CONDITIONS);
    expect(seed.action.responseSource).toBe('mock');
    expect(seed.action.bodyType).toBe('static');
    expect(seed.action.resourceType).toBe('rest');
  });
});
