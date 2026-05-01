import type { V5 } from '@openheaders/core/types';
import { VariableResolver } from '@openheaders/core/variables';
import {
  type CollectionFamilies,
  feedCollectionVariablesToResolver,
  findCollectionByPath,
  findCollectionByUid,
  iterateAllCollections,
} from '@/shared/variables/collection-scope';
import { describe, expect, it } from 'vitest';

function coll(uid: string, path: string, vars: V5.Variable[] = []): V5.Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name: path.split('/').pop() ?? path,
    variables: vars,
    defaultEnvironmentId: null,
    pinnedEnvironmentIds: [],
  } as V5.Collection;
}

const RULE_A = coll('rc-a', 'rules/A', [{ name: 'X', value: 'rule', type: 'default' }]);
const RULE_B = coll('rc-b', 'rules/B');
const REQ_A = coll('qc-a', 'requests/A', [{ name: 'X', value: 'request', type: 'default' }]);
const REQ_NESTED = coll('qc-n', 'requests/A/nested');
const TEMPL_A = coll('tc-a', 'templates/A', [{ name: 'X', value: 'template', type: 'default' }]);

const FAMILIES: CollectionFamilies = {
  ruleCollections: [RULE_A, RULE_B],
  requestCollections: [REQ_A, REQ_NESTED],
  templateCollections: [TEMPL_A],
};

describe('findCollectionByUid', () => {
  it('finds across all three families', () => {
    expect(findCollectionByUid('rc-a', FAMILIES)).toBe(RULE_A);
    expect(findCollectionByUid('qc-a', FAMILIES)).toBe(REQ_A);
    expect(findCollectionByUid('tc-a', FAMILIES)).toBe(TEMPL_A);
  });
  it('returns null for unknown uid', () => {
    expect(findCollectionByUid('does-not-exist', FAMILIES)).toBeNull();
  });
});

describe('findCollectionByPath', () => {
  it('matches a rule path against a rule collection', () => {
    expect(findCollectionByPath('rules/A/r1', FAMILIES)).toBe(RULE_A);
  });
  it('matches a request path against a request collection (NOT a rule one)', () => {
    expect(findCollectionByPath('requests/A/q1', FAMILIES)).toBe(REQ_A);
  });
  it('matches a template path against a template collection', () => {
    expect(findCollectionByPath('templates/A/t1', FAMILIES)).toBe(TEMPL_A);
  });
  it('prefers the longest prefix within a family', () => {
    expect(findCollectionByPath('requests/A/nested/q1', FAMILIES)).toBe(REQ_NESTED);
  });
  it('returns null for an orphan path', () => {
    expect(findCollectionByPath('orphan/x', FAMILIES)).toBeNull();
  });
});

describe('feedCollectionVariablesToResolver', () => {
  it('feeds variables from every family into one resolver', () => {
    const resolver = new VariableResolver();
    feedCollectionVariablesToResolver(resolver, FAMILIES);
    expect(resolver.resolve('X', { collectionId: 'rc-a' })?.value).toBe('rule');
    expect(resolver.resolve('X', { collectionId: 'qc-a' })?.value).toBe('request');
    expect(resolver.resolve('X', { collectionId: 'tc-a' })?.value).toBe('template');
  });

  it('drops uids no longer present when previousUids is provided', () => {
    const resolver = new VariableResolver();
    const first = feedCollectionVariablesToResolver(resolver, FAMILIES);
    expect(resolver.resolve('X', { collectionId: 'rc-a' })?.value).toBe('rule');
    // Re-feed without RULE_A
    feedCollectionVariablesToResolver(
      resolver,
      { ...FAMILIES, ruleCollections: [RULE_B] },
      first,
    );
    expect(resolver.resolve('X', { collectionId: 'rc-a' })).toBeNull();
    // Other families intact.
    expect(resolver.resolve('X', { collectionId: 'qc-a' })?.value).toBe('request');
  });
});

describe('iterateAllCollections', () => {
  it('yields all five collections in family order', () => {
    const uids = [...iterateAllCollections(FAMILIES)].map((c) => c.uid);
    expect(uids).toEqual(['rc-a', 'rc-b', 'qc-a', 'qc-n', 'tc-a']);
  });
});
