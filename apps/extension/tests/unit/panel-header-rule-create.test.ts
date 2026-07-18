/**
 * Inspector header quick-editor CREATE seed — `header-rule-create`.
 *
 * Counterpart of `panel-response-rule-create.test.ts` for the Headers
 * tab's server-row Override CTA: the seed must pass the popover's
 * edited conditions through unchanged, mint row identity on the
 * modification, place it in the clicked direction, and honor the
 * per-operation mod shape
 * (remove carries no value, merge carries the separator) — the same
 * split `buildHeaderModUpdate` applies on the edit path.
 */

import type { HeaderRuleDraft, RuleCondition } from '@openheaders/core/types';
import {
  buildHeaderRuleSeed,
  mergeQuickIntoHeaderDraft,
  seedHeaderQuickDraft,
} from '@openheaders/ui/panel/data/rule-create/header-rule-create';
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

const CONDITIONS: RuleCondition[] = [
  { uid: 'c1', type: 'url-filter', values: ['https://api.openheaders.io/v1/users?page=2'] },
  { uid: 'c2', type: 'request-methods', values: ['GET'] },
];

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

  it('seeds the captured name and value VERBATIM — no trim or case drift', () => {
    const draft = makeDraft({
      responseHeaders: [{ operation: 'override', headerName: 'X-Custom-Header', value: '  spaced value\t' }],
    });
    expect(seedHeaderQuickDraft(draft, 'response')).toEqual({
      operation: 'override',
      headerName: 'X-Custom-Header',
      value: '  spaced value\t',
    });
  });

  it('keeps a captured merge separator on the seed', () => {
    const draft = makeDraft({
      responseHeaders: [{ operation: 'merge', headerName: 'vary', value: 'accept', mergeSeparator: '; ' }],
    });
    expect(seedHeaderQuickDraft(draft, 'response')).toEqual({
      operation: 'merge',
      headerName: 'vary',
      value: 'accept',
      mergeSeparator: '; ',
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

  it('carries the merge separator through the hand-off', () => {
    const merged = mergeQuickIntoHeaderDraft(
      makeDraft(),
      { operation: 'merge', headerName: 'vary', value: 'accept', mergeSeparator: '; ' },
      'response',
    );
    expect(merged.responseHeaders).toEqual([
      { operation: 'merge', headerName: 'vary', value: 'accept', mergeSeparator: '; ' },
    ]);
  });
});

describe('buildHeaderRuleSeed — conditions + identity', () => {
  const QUICK = { operation: 'override' as const, headerName: 'cache-control', value: 'no-store' };

  it('passes the edited conditions through unchanged', () => {
    const seed = buildHeaderRuleSeed(QUICK, 'response', 'Rule', CONDITIONS);
    expect(seed.conditions).toBe(CONDITIONS);
  });

  it('names the rule, enables it, and leaves publication to the write client', () => {
    const seed = buildHeaderRuleSeed(QUICK, 'response', 'Kill caching', CONDITIONS);
    expect(seed.name).toBe('Kill caching');
    expect(seed.enabled).toBe(true);
    expect(seed.type).toBe('header');
    expect('published' in seed).toBe(false);
  });
});

describe('buildHeaderRuleSeed — action', () => {
  it('places the mod in the clicked direction with a minted uid', () => {
    const seed = buildHeaderRuleSeed(
      { operation: 'override', headerName: 'cache-control', value: 'no-store' },
      'response',
      'Rule',
      CONDITIONS,
    );
    expect(seed.action.requestHeaders).toEqual([]);
    expect(seed.action.responseHeaders).toHaveLength(1);
    const mod = seed.action.responseHeaders[0];
    expect(mod.uid).toBeTruthy();
    expect(mod).toMatchObject({ operation: 'override', headerName: 'cache-control', value: 'no-store' });
  });

  it('places a request-direction mod on the request side', () => {
    const seed = buildHeaderRuleSeed(
      { operation: 'override', headerName: 'authorization', value: 'Bearer t' },
      'request',
      'Rule',
      CONDITIONS,
    );
    expect(seed.action.responseHeaders).toEqual([]);
    expect(seed.action.requestHeaders[0]).toMatchObject({ headerName: 'authorization' });
  });

  it('builds a remove mod without a value', () => {
    const seed = buildHeaderRuleSeed(
      { operation: 'remove', headerName: 'x-powered-by', value: 'leftover' },
      'response',
      'Rule',
      CONDITIONS,
    );
    const mod = seed.action.responseHeaders[0];
    expect(mod.operation).toBe('remove');
    expect('value' in mod).toBe(false);
  });

  it('carries the merge separator on a merge mod', () => {
    const seed = buildHeaderRuleSeed(
      { operation: 'merge', headerName: 'vary', value: 'accept', mergeSeparator: ', ' },
      'response',
      'Rule',
      CONDITIONS,
    );
    expect(seed.action.responseHeaders[0]).toMatchObject({
      operation: 'merge',
      value: 'accept',
      mergeSeparator: ', ',
    });
  });
});
