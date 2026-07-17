/**
 * Inspector response quick-editor Save payload — `buildResponseRuleUpdate`.
 *
 * Same atomic-edit contract as `panel-header-mod-edit.test.ts`: the
 * popover commits in one gesture, so a published rule must carry
 * `published: true` in the same batch (the publication gate reads it as
 * the explicit publish gesture and skips the streaming-edit
 * auto-unpublish). The action rebuild must also preserve the fields the
 * compact editor doesn't surface (source, body type, headers, filters).
 */

import type { ResponseRule, RuleCondition } from '@openheaders/core/types';
import {
  buildResponseRuleUpdate,
  buildResponseRuleWireUpdate,
} from '@openheaders/ui/panel/data/rule-create/response-rule-edit';
import { describe, expect, it } from 'vitest';

function makeRule(over: Partial<ResponseRule> = {}): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'rule-1',
    path: 'rules/API/Mock users',
    name: 'Mock users',
    enabled: true,
    type: 'response',
    conditions: [],
    action: {
      responseSource: 'network',
      bodyType: 'static',
      responseBody: '{"users": []}',
      statusCode: 0,
      contentType: 'application/json',
      responseHeaders: { 'x-served-by': 'openheaders.io' },
      resourceType: 'rest',
    },
    ...over,
  };
}

const DRAFT = { statusCode: 404, contentType: 'text/plain', responseBody: 'not found' };

describe('buildResponseRuleUpdate — publication preservation', () => {
  it('keeps a published rule published', () => {
    const updates = buildResponseRuleUpdate(makeRule({ published: true }), DRAFT);
    expect(updates.published).toBe(true);
  });

  it('does not add a published flag for a draft rule (no surprise publish)', () => {
    const updates = buildResponseRuleUpdate(makeRule(), DRAFT);
    expect('published' in updates).toBe(false);
  });

  it('leaves an explicitly-unpublished rule a draft', () => {
    const updates = buildResponseRuleUpdate(makeRule({ published: false }), DRAFT);
    expect('published' in updates).toBe(false);
  });
});

describe('buildResponseRuleUpdate — conditions', () => {
  const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'request-domains', values: ['openheaders.io'] }];

  it('carries the edited conditions in the same batch when supplied', () => {
    const updates = buildResponseRuleUpdate(makeRule({ published: true }), DRAFT, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
    expect(updates.published).toBe(true);
  });

  it('omits conditions from the batch when not supplied (untouched row)', () => {
    const updates = buildResponseRuleUpdate(makeRule(), DRAFT);
    expect('conditions' in updates).toBe(false);
  });
});

describe('buildResponseRuleUpdate — action rebuild', () => {
  it('applies the drafted status, content-type and body', () => {
    const updates = buildResponseRuleUpdate(makeRule({ published: true }), DRAFT);
    expect(updates.action?.statusCode).toBe(404);
    expect(updates.action?.contentType).toBe('text/plain');
    expect(updates.action?.responseBody).toBe('not found');
  });

  it('preserves the fields the compact editor does not surface', () => {
    const rule = makeRule({ published: true });
    const updates = buildResponseRuleUpdate(rule, DRAFT);
    expect(updates.action?.responseSource).toBe('network');
    expect(updates.action?.bodyType).toBe('static');
    expect(updates.action?.responseHeaders).toEqual({ 'x-served-by': 'openheaders.io' });
    expect(updates.action?.resourceType).toBe('rest');
  });
});

describe('buildResponseRuleUpdate — wire re-encoding', () => {
  const stored = '{"users":[],"total":0}';

  it('re-encodes a formatted-view edit to the stored profile', () => {
    const rule = makeRule({ action: { ...makeRule().action, responseBody: stored } });
    const draft = {
      statusCode: 0,
      contentType: 'application/json',
      responseBody: '{\n  "users": [],\n  "total": 7\n}',
    };
    expect(buildResponseRuleUpdate(rule, draft).action?.responseBody).toBe('{"users":[],"total":7}');
  });

  it('an untouched formatted view keeps the stored bytes exactly', () => {
    const rule = makeRule({ action: { ...makeRule().action, responseBody: stored } });
    const draft = {
      statusCode: 404,
      contentType: 'application/json',
      responseBody: '{\n  "users": [],\n  "total": 0\n}',
    };
    expect(buildResponseRuleUpdate(rule, draft).action?.responseBody).toBe(stored);
  });
});

describe('buildResponseRuleWireUpdate — the rule-editor tab document', () => {
  const stored = '{"users":[],"total":0}';

  it('stores the wire-space draft body VERBATIM — a Raw-mode profile change is honored', () => {
    // The tab's FormatAwareBodyEditor already encoded the form value; a
    // deliberately re-indented Raw edit must not snap back to the
    // stored profile.
    const rule = makeRule({ published: true, action: { ...makeRule().action, responseBody: stored } });
    const rawEdit = '{\n    "users": [],\n    "total": 0\n}';
    const updates = buildResponseRuleWireUpdate(rule, {
      statusCode: 200,
      contentType: 'application/json',
      responseBody: rawEdit,
    });
    expect(updates.action?.responseBody).toBe(rawEdit);
    expect(updates.action?.statusCode).toBe(200);
    expect(updates.published).toBe(true);
  });

  it('an untouched wire draft stores the stored bytes exactly', () => {
    const rule = makeRule({ action: { ...makeRule().action, responseBody: stored } });
    const updates = buildResponseRuleWireUpdate(rule, {
      statusCode: 0,
      contentType: 'application/json',
      responseBody: stored,
    });
    expect(updates.action?.responseBody).toBe(stored);
    expect('published' in updates).toBe(false);
  });

  it('gates conditions and preserves unsurfaced action fields like the popover builder', () => {
    const conditions: RuleCondition[] = [{ uid: 'c1', type: 'request-domains', values: ['openheaders.io'] }];
    const withConditions = buildResponseRuleWireUpdate(makeRule({ published: true }), DRAFT, conditions);
    expect(withConditions.conditions).toBe(conditions);
    const without = buildResponseRuleWireUpdate(makeRule(), DRAFT);
    expect('conditions' in without).toBe(false);
    expect(without.action?.responseSource).toBe('network');
    expect(without.action?.responseHeaders).toEqual({ 'x-served-by': 'openheaders.io' });
  });
});
