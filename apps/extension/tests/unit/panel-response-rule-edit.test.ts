/**
 * Response editors' Save payload — `buildResponseRuleWireUpdate` (one
 * wire-space builder for the quick popover AND the rule-editor tab
 * document).
 *
 * Same atomic-edit contract as `panel-header-mod-edit.test.ts`: the
 * edit commits in one gesture, so a published rule must carry
 * `published: true` in the same batch (the publication gate reads it as
 * the explicit publish gesture and skips the streaming-edit
 * auto-unpublish). The action rebuild must preserve the fields the
 * compact editor doesn't surface (source, body type, headers, filters),
 * and the body stores AS IS — the form value is wire text
 * (`FormatAwareBodyEditor` encodes per edit; Raw mode is verbatim).
 */

import type { ResponseRule, RuleCondition } from '@openheaders/core/types';
import { buildResponseRuleWireUpdate } from '@openheaders/ui/panel/data/rule-create/response-rule-edit';
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

describe('buildResponseRuleWireUpdate — publication preservation', () => {
  it('keeps a published rule published', () => {
    const updates = buildResponseRuleWireUpdate(makeRule({ published: true }), DRAFT);
    expect(updates.published).toBe(true);
  });

  it('does not add a published flag for a draft rule (no surprise publish)', () => {
    const updates = buildResponseRuleWireUpdate(makeRule(), DRAFT);
    expect('published' in updates).toBe(false);
  });

  it('leaves an explicitly-unpublished rule a draft', () => {
    const updates = buildResponseRuleWireUpdate(makeRule({ published: false }), DRAFT);
    expect('published' in updates).toBe(false);
  });
});

describe('buildResponseRuleWireUpdate — conditions', () => {
  const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'request-domains', values: ['openheaders.io'] }];

  it('carries the edited conditions in the same batch when supplied', () => {
    const updates = buildResponseRuleWireUpdate(makeRule({ published: true }), DRAFT, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
    expect(updates.published).toBe(true);
  });

  it('omits conditions from the batch when not supplied (untouched row)', () => {
    const updates = buildResponseRuleWireUpdate(makeRule(), DRAFT);
    expect('conditions' in updates).toBe(false);
  });
});

describe('buildResponseRuleWireUpdate — action rebuild', () => {
  it('applies the drafted status, content-type and body', () => {
    const updates = buildResponseRuleWireUpdate(makeRule({ published: true }), DRAFT);
    expect(updates.action?.statusCode).toBe(404);
    expect(updates.action?.contentType).toBe('text/plain');
    expect(updates.action?.responseBody).toBe('not found');
  });

  it('preserves the fields the compact editor does not surface', () => {
    const rule = makeRule({ published: true });
    const updates = buildResponseRuleWireUpdate(rule, DRAFT);
    expect(updates.action?.responseSource).toBe('network');
    expect(updates.action?.bodyType).toBe('static');
    expect(updates.action?.responseHeaders).toEqual({ 'x-served-by': 'openheaders.io' });
    expect(updates.action?.resourceType).toBe('rest');
  });
});

describe('buildResponseRuleWireUpdate — wire-space body', () => {
  const stored = '{"users":[],"total":0}';

  it('stores the wire-space draft body VERBATIM — a Raw-mode profile change is honored', () => {
    // The FormatAwareBodyEditor already encoded the form value; a
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
});
