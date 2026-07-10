/**
 * Draft stores — the single-consume nonce handoff behind the devpanel →
 * workbench pre-fill flows. Covers both instances (rule drafts +
 * request seeds) through their public wrappers: schema validation at
 * stash time, single consumption, unknown nonces, and store isolation
 * (a rule nonce can't redeem a request seed).
 */

import type { RequestSeed } from '@openheaders/core/types';
import { afterEach, describe, expect, it } from 'vitest';
import { _clearAllRequestDrafts, createRequestDraft, takeRequestDraft } from '../../src/entity/request-draft-store';
import { _clearAllDrafts, createRuleDraft, takeRuleDraft } from '../../src/entity/rule-draft-store';

const SEED: RequestSeed = {
  name: 'POST api.openheaders.io/v1/things',
  method: 'POST',
  url: 'https://api.openheaders.io/v1/things',
  headers: [{ uid: 'aaaaaaaa', key: 'content-type', value: 'application/json' }],
  params: [{ uid: 'bbbbbbbb', key: 'page', value: '2' }],
  auth: { type: 'bearer', token: 'tok123' },
  body: { type: 'json', content: '{"name":"hello"}' },
};

afterEach(() => {
  _clearAllDrafts();
  _clearAllRequestDrafts();
});

describe('request draft store', () => {
  it('round-trips a seed and consumes it on take', () => {
    const nonce = createRequestDraft(SEED);
    expect(nonce).toMatch(/^[0-9a-f]{16}$/);
    expect(takeRequestDraft(nonce)).toEqual(SEED);
    expect(takeRequestDraft(nonce)).toBeNull();
  });

  it('returns null for an unknown nonce', () => {
    expect(takeRequestDraft('deadbeefdeadbeef')).toBeNull();
  });

  it('rejects a seed that fails schema validation', () => {
    expect(() => createRequestDraft({ ...SEED, method: 'connect' })).toThrow();
  });

  it('is isolated from the rule draft store', () => {
    const ruleNonce = createRuleDraft({ type: 'block', url: 'https://openheaders.io/' });
    expect(takeRequestDraft(ruleNonce)).toBeNull();
    expect(takeRuleDraft(ruleNonce)).toEqual({ type: 'block', url: 'https://openheaders.io/' });
  });
});

describe('rule draft store (factory regression)', () => {
  it('keeps the pre-factoring behavior: parse, stash, single consume', () => {
    const nonce = createRuleDraft({ type: 'delay', url: 'https://openheaders.io/', delayMs: 500 });
    expect(takeRuleDraft(nonce)).toEqual({ type: 'delay', url: 'https://openheaders.io/', delayMs: 500 });
    expect(takeRuleDraft(nonce)).toBeNull();
  });

  it('still throws on an invalid draft', () => {
    expect(() => createRuleDraft({ type: 'not-a-type' })).toThrow();
  });
});
