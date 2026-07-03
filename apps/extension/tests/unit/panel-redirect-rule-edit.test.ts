/**
 * Inspector redirect quick-editor Save payload — `buildRedirectRuleUpdate`.
 *
 * Same atomic-edit contract as `panel-response-rule-edit.test.ts`: the
 * popover commits in one gesture, so a published rule must carry
 * `published: true` in the same batch (the publication gate reads it as
 * the explicit publish gesture and skips the streaming-edit
 * auto-unpublish).
 */

import type { RedirectRule, RuleCondition } from '@openheaders/core/types';
import { buildRedirectRuleUpdate } from '@openheaders/ui/panel/data/rule-create/redirect-rule-edit';
import { describe, expect, it } from 'vitest';

function makeRule(over: Partial<RedirectRule> = {}): RedirectRule {
  return {
    schemaVersion: 5,
    uid: 'rule-1',
    path: 'rules/API/Redirect example',
    name: 'Redirect example',
    enabled: true,
    type: 'redirect',
    conditions: [{ uid: 'c0', type: 'url-filter', values: ['https://example.com/'] }],
    action: { redirectTo: 'https://example.org' },
    ...over,
  };
}

const DRAFT = { redirectTo: '{{redirect_url_example_org}}' };

describe('buildRedirectRuleUpdate — publication preservation', () => {
  it('keeps a published rule published', () => {
    const updates = buildRedirectRuleUpdate(makeRule({ published: true }), DRAFT);
    expect(updates.published).toBe(true);
  });

  it('does not add a published flag for a draft rule (no surprise publish)', () => {
    const updates = buildRedirectRuleUpdate(makeRule(), DRAFT);
    expect('published' in updates).toBe(false);
  });

  it('leaves an explicitly-unpublished rule a draft', () => {
    const updates = buildRedirectRuleUpdate(makeRule({ published: false }), DRAFT);
    expect('published' in updates).toBe(false);
  });
});

describe('buildRedirectRuleUpdate — conditions', () => {
  const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'request-domains', values: ['openheaders.io'] }];

  it('carries the edited conditions in the same batch when supplied', () => {
    const updates = buildRedirectRuleUpdate(makeRule({ published: true }), DRAFT, CONDITIONS);
    expect(updates.conditions).toBe(CONDITIONS);
    expect(updates.published).toBe(true);
  });

  it('omits conditions from the batch when not supplied (untouched row)', () => {
    const updates = buildRedirectRuleUpdate(makeRule(), DRAFT);
    expect('conditions' in updates).toBe(false);
  });
});

describe('buildRedirectRuleUpdate — action rebuild', () => {
  it('applies the drafted target', () => {
    const updates = buildRedirectRuleUpdate(makeRule({ published: true }), DRAFT);
    expect(updates.action?.redirectTo).toBe('{{redirect_url_example_org}}');
  });
});
