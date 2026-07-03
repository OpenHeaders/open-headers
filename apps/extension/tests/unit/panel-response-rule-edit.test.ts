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
import { buildResponseRuleUpdate } from '@openheaders/ui/panel/data/rule-create/response-rule-edit';
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
