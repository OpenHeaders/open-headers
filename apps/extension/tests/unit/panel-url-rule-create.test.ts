/**
 * Inspector URL-action quick-editor CREATE seeds — `url-rule-create`.
 *
 * Counterpart of `panel-header-rule-create.test.ts` for the Headers
 * tab's CTA row: redirect / delay / block seeds must pass the popover's
 * edited conditions through unchanged, carry the edited action field,
 * and leave publication to the write client. Block has no action
 * configuration — the block itself is the action.
 */

import type { DelayRuleDraft, RedirectRuleDraft, RuleCondition } from '@openheaders/core/types';
import {
  buildBlockRuleSeed,
  buildDelayRuleSeed,
  buildRedirectRuleSeed,
  localhostPortVarName,
  mergeQuickIntoDelayDraft,
  mergeQuickIntoRedirectDraft,
  newHostVarName,
  redirectVarName,
  seedDelayQuickDraft,
  seedRedirectQuickDraft,
} from '@openheaders/ui/panel/data/rule-create/url-rule-create';
import { describe, expect, it } from 'vitest';

const URL = 'https://api.openheaders.io/v1/users?page=2';

function makeRedirectDraft(over: Partial<RedirectRuleDraft> = {}): RedirectRuleDraft {
  return { type: 'redirect', url: URL, redirectTo: 'https://staging.openheaders.io/v1/users?page=2', ...over };
}

function makeDelayDraft(over: Partial<DelayRuleDraft> = {}): DelayRuleDraft {
  return { type: 'delay', url: URL, delayMs: 1000, ...over };
}

const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'url-filter', values: [URL] }];

describe('redirectVarName / newHostVarName', () => {
  it('derives a domain-scoped variable name', () => {
    expect(redirectVarName(URL)).toBe('redirect_url_openheaders_io');
    expect(redirectVarName('http://localhost:5173/')).toBe('redirect_url_localhost');
    expect(newHostVarName(URL)).toBe('new_host_openheaders_io');
    expect(localhostPortVarName(URL)).toBe('port_localhost_openheaders_io');
  });

  it('returns null when the URL yields no domain', () => {
    expect(redirectVarName('not a url')).toBeNull();
    expect(newHostVarName('not a url')).toBeNull();
  });
});

describe('seedRedirectQuickDraft', () => {
  it('seeds the target from the CTA variant draft', () => {
    expect(seedRedirectQuickDraft(makeRedirectDraft())).toEqual({
      redirectTo: 'https://staging.openheaders.io/v1/users?page=2',
    });
  });

  it('seeds the domain redirect variable for the plain Redirect URL variant', () => {
    expect(seedRedirectQuickDraft(makeRedirectDraft({ redirectTo: undefined }), 'redirect')).toEqual({
      redirectTo: '{{redirect_url_openheaders_io}}',
    });
  });

  it('seeds the host variable in the host slot for the Replace host variant', () => {
    expect(seedRedirectQuickDraft(makeRedirectDraft({ redirectTo: undefined }), 'replace-host')).toEqual({
      redirectTo: 'https://{{new_host_openheaders_io}}/v1/users?page=2',
    });
  });

  it('seeds a literal localhost host with a templated port for the Point to localhost variant', () => {
    expect(seedRedirectQuickDraft(makeRedirectDraft({ redirectTo: undefined }), 'localhost')).toEqual({
      redirectTo: 'http://localhost:{{port_localhost_openheaders_io}}/v1/users?page=2',
    });
  });

  it('keeps a pre-built target untouched for any variant', () => {
    expect(seedRedirectQuickDraft(makeRedirectDraft(), 'replace-host')).toEqual({
      redirectTo: 'https://staging.openheaders.io/v1/users?page=2',
    });
  });

  it('seeds empty when the URL yields no variable name', () => {
    expect(seedRedirectQuickDraft(makeRedirectDraft({ url: 'not a url', redirectTo: undefined }), 'redirect')).toEqual({
      redirectTo: '',
    });
  });
});

describe('seedDelayQuickDraft', () => {
  it('seeds the captured delay and defaults to 1000ms', () => {
    expect(seedDelayQuickDraft(makeDelayDraft({ delayMs: 250 }))).toEqual({ delayMs: 250 });
    expect(seedDelayQuickDraft(makeDelayDraft({ delayMs: undefined }))).toEqual({ delayMs: 1000 });
  });
});

describe('merge back into the handoff draft', () => {
  it('folds the edited redirect target, preserving the capture context', () => {
    const merged = mergeQuickIntoRedirectDraft(makeRedirectDraft(), { redirectTo: 'https://openheaders.io/next' });
    expect(merged.redirectTo).toBe('https://openheaders.io/next');
    expect(merged.url).toBe(URL);
  });

  it('folds the edited delay and drops a cleared input', () => {
    expect(mergeQuickIntoDelayDraft(makeDelayDraft(), { delayMs: 5000 }).delayMs).toBe(5000);
    expect(mergeQuickIntoDelayDraft(makeDelayDraft({ delayMs: 250 }), { delayMs: null }).delayMs).toBe(250);
  });
});

describe('buildRedirectRuleSeed', () => {
  it('passes the edited conditions through and carries the edited target', () => {
    const seed = buildRedirectRuleSeed({ redirectTo: 'https://openheaders.io/next' }, 'Rule', CONDITIONS);
    expect(seed.type).toBe('redirect');
    expect(seed.conditions).toBe(CONDITIONS);
    expect(seed.action).toEqual({ redirectTo: 'https://openheaders.io/next' });
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildRedirectRuleSeed({ redirectTo: 'x' }, 'Send to staging', CONDITIONS);
    expect(seed.name).toBe('Send to staging');
    expect(seed.enabled).toBe(true);
    expect('published' in seed).toBe(false);
  });
});

describe('buildDelayRuleSeed', () => {
  it('carries the edited delay in the action', () => {
    const seed = buildDelayRuleSeed(2500, 'Rule', CONDITIONS);
    expect(seed.type).toBe('delay');
    expect(seed.action).toEqual({ delayMs: 2500 });
    expect(seed.conditions).toBe(CONDITIONS);
  });
});

describe('buildBlockRuleSeed', () => {
  it('builds a fields-less action with the edited conditions', () => {
    const seed = buildBlockRuleSeed('Rule', CONDITIONS);
    expect(seed.type).toBe('block');
    expect(seed.action).toEqual({});
    expect(seed.conditions).toBe(CONDITIONS);
    expect('published' in seed).toBe(false);
  });
});
