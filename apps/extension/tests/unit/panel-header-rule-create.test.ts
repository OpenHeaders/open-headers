/**
 * Inspector header quick-editor CREATE seed — `header-rule-create`.
 *
 * Counterpart of `panel-response-rule-create.test.ts` for the Headers
 * tab's server-row Override CTA: the seed must derive conditions from
 * the captured draft, mint row identity on the modification, place it
 * in the clicked direction, and honor the per-operation mod shape
 * (remove carries no value, merge carries the separator) — the same
 * split `buildHeaderModUpdate` applies on the edit path.
 */

import type { HeaderRuleDraft } from '@openheaders/core/types';
import {
  buildHeaderRuleSeed,
  mergeQuickIntoHeaderDraft,
  seedHeaderQuickDraft,
} from '@openheaders/ui/panel/data/header-rule-create';
import { describe, expect, it } from 'vitest';

function makeDraft(over: Partial<HeaderRuleDraft> = {}): HeaderRuleDraft {
  return {
    type: 'header',
    url: 'https://api.openheaders.io/v1/users?page=2',
    requestMethods: ['GET'],
    responseHeaders: [{ operation: 'override', headerName: 'cache-control', value: 'no-store' }],
    ...over,
  };
}

describe('seedHeaderQuickDraft', () => {
  it('seeds from the first mod in the clicked direction', () => {
    expect(seedHeaderQuickDraft(makeDraft(), 'response')).toEqual({
      operation: 'override',
      headerName: 'cache-control',
      value: 'no-store',
    });
  });

  it('defaults to an empty Add / Replace when the direction has no mod', () => {
    expect(seedHeaderQuickDraft(makeDraft(), 'request')).toEqual({
      operation: 'override',
      headerName: '',
      value: '',
    });
  });
});

describe('mergeQuickIntoHeaderDraft', () => {
  it('folds the edits into the handoff draft, preserving the capture context', () => {
    const merged = mergeQuickIntoHeaderDraft(
      makeDraft(),
      { operation: 'add', headerName: 'x-trace', value: 'on' },
      'response',
    );
    expect(merged.responseHeaders).toEqual([{ operation: 'add', headerName: 'x-trace', value: 'on' }]);
    expect(merged.requestHeaders).toBeUndefined();
    expect(merged.url).toBe('https://api.openheaders.io/v1/users?page=2');
    expect(merged.requestMethods).toEqual(['GET']);
  });

  it('drops the value on a remove mod', () => {
    const merged = mergeQuickIntoHeaderDraft(
      makeDraft(),
      { operation: 'remove', headerName: 'cache-control', value: 'stale' },
      'response',
    );
    expect(merged.responseHeaders).toEqual([{ operation: 'remove', headerName: 'cache-control' }]);
  });
});

describe('buildHeaderRuleSeed — conditions + identity', () => {
  const QUICK = { operation: 'override' as const, headerName: 'cache-control', value: 'no-store' };

  it('derives an exact url-filter and request-methods condition', () => {
    const seed = buildHeaderRuleSeed(makeDraft(), QUICK, 'response', 'Rule', 'exact');
    expect(seed.conditions).toHaveLength(2);
    expect(seed.conditions[0].type).toBe('url-filter');
    expect(seed.conditions[0].values).toEqual(['https://api.openheaders.io/v1/users?page=2']);
    expect(seed.conditions[1].type).toBe('request-methods');
    expect(seed.conditions[1].values).toEqual(['GET']);
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildHeaderRuleSeed(makeDraft(), QUICK, 'response', 'Kill caching', 'exact');
    expect(seed.name).toBe('Kill caching');
    expect(seed.enabled).toBe(true);
    expect(seed.type).toBe('header');
    expect('published' in seed).toBe(false);
  });
});

describe('buildHeaderRuleSeed — action', () => {
  it('places the mod in the clicked direction with a minted uid', () => {
    const seed = buildHeaderRuleSeed(
      makeDraft(),
      { operation: 'override', headerName: 'cache-control', value: 'no-store' },
      'response',
      'Rule',
      'exact',
    );
    expect(seed.action.requestHeaders).toEqual([]);
    expect(seed.action.responseHeaders).toHaveLength(1);
    const mod = seed.action.responseHeaders[0];
    expect(mod.uid).toBeTruthy();
    expect(mod).toMatchObject({ operation: 'override', headerName: 'cache-control', value: 'no-store' });
  });

  it('places a request-direction mod on the request side', () => {
    const seed = buildHeaderRuleSeed(
      makeDraft({ requestHeaders: [{ operation: 'override', headerName: 'authorization', value: 'Bearer t' }] }),
      { operation: 'override', headerName: 'authorization', value: 'Bearer t' },
      'request',
      'Rule',
      'exact',
    );
    expect(seed.action.responseHeaders).toEqual([]);
    expect(seed.action.requestHeaders[0]).toMatchObject({ headerName: 'authorization' });
  });

  it('builds a remove mod without a value', () => {
    const seed = buildHeaderRuleSeed(
      makeDraft(),
      { operation: 'remove', headerName: 'x-powered-by', value: 'leftover' },
      'response',
      'Rule',
      'exact',
    );
    const mod = seed.action.responseHeaders[0];
    expect(mod.operation).toBe('remove');
    expect('value' in mod).toBe(false);
  });

  it('carries the merge separator on a merge mod', () => {
    const seed = buildHeaderRuleSeed(
      makeDraft(),
      { operation: 'merge', headerName: 'vary', value: 'accept', mergeSeparator: ', ' },
      'response',
      'Rule',
      'exact',
    );
    expect(seed.action.responseHeaders[0]).toMatchObject({
      operation: 'merge',
      value: 'accept',
      mergeSeparator: ', ',
    });
  });
});
