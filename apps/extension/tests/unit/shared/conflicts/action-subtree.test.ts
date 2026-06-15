/**
 * Parity tests for `ACTION_SUBTREE` — pin the new declarative descriptor
 * against the existing `createActionEntityAdapters` factory's read-side
 * output, modulo the explicitly out-of-scope keys (conditions paths
 * + response-header paths, both handled by the entity adapter
 * wrapper rather than the walker).
 *
 * The test fixtures cover all 8 rule types so every union branch
 * exercises at least once.
 */

import type { Rule, RuleCondition, Template } from '@openheaders/core/types';
import { RULE_ACTION_PATHS, TEMPLATE_ACTION_PATHS } from '@openheaders/ui/shared/awareness';
import { createActionEntityAdapters } from '@openheaders/ui/shared/conflicts/action-entity-adapter';
import { buildActionEntitySchema } from '@openheaders/ui/shared/conflicts/field-tree/action-subtree';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';
import { describe, expect, it } from 'vitest';

const factoryAdapters = createActionEntityAdapters<Rule>(RULE_ACTION_PATHS, {
  signature: (r) => r.uid,
  getRuleType: (r) => r.type,
  discriminatorField: 'type',
  getName: (r) => r.name,
  getConditions: (r) => r.conditions,
  setName: (r, value) => {
    (r as { name: string }).name = value;
  },
  setConditions: (r, value) => {
    (r as { conditions: RuleCondition[] }).conditions = value;
  },
  getActionRoot: (r) => (r as unknown as { action?: Record<string, unknown> }).action,
  nameFormName: null,
});

const walkerAdapters = makeConflictAdapter<Rule>({
  schema: buildActionEntitySchema(RULE_ACTION_PATHS, { discriminatorField: 'type' }),
  signature: (r) => r.uid,
});

const templateWalkerAdapters = makeConflictAdapter<Template>({
  schema: buildActionEntitySchema(TEMPLATE_ACTION_PATHS, { discriminatorField: 'ruleType' }),
  signature: (t) => t.uid,
});

/**
 * Strip keys the entity adapter wrapper handles outside the walker:
 *   - `conditions.*` — emitted manually because path key `field` aliases
 *     schema field `type`.
 *   - response rule's `<root>.responseHeaders.*` — Record-shape with virtual
 *     `{name, value}` per-entry pairs; the walker would need a
 *     keyed-virtual-pair node kind to express it cleanly.
 */
function stripWrapperKeys(map: Record<string, string>, ruleType: Rule['type']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith('conditions.')) continue;
    if (ruleType === 'response' && /^action\.responseHeaders\./.test(k)) continue;
    out[k] = v;
  }
  return out;
}

function makeBase(
  uid: string,
  name = 'r',
): { uid: string; path: string; name: string; enabled: boolean; schemaVersion: 5; conditions: RuleCondition[] } {
  return { uid, path: `rules/${uid}.yaml`, name, enabled: true, schemaVersion: 5, conditions: [] };
}

const headerRule: Rule = {
  ...makeBase('r-h'),
  type: 'header',
  action: {
    requestHeaders: [{ uid: 'thm00097', operation: 'override', headerName: 'X-A', value: 'v' }],
    responseHeaders: [{ uid: 'thm00098', operation: 'append', headerName: 'X-B', value: 'w', mergeSeparator: ',' }],
  },
} as unknown as Rule;

const queryParamRule: Rule = {
  ...makeBase('r-q'),
  type: 'query-param',
  action: {
    params: [{ uid: 'qp000001', operation: 'override', param: 'page', value: '1' }],
  },
} as unknown as Rule;

const redirectRule: Rule = {
  ...makeBase('r-r'),
  type: 'redirect',
  action: { redirectTo: 'https://openheaders.io/x' },
} as unknown as Rule;

const delayRule: Rule = {
  ...makeBase('r-d'),
  type: 'delay',
  action: { delayMs: 1000 },
} as unknown as Rule;

const injectRule: Rule = {
  ...makeBase('r-i'),
  type: 'inject',
  action: { injectType: 'script', code: 'console.log(1)', source: 'code', position: 'body-end' },
} as unknown as Rule;

const bodyRule: Rule = {
  ...makeBase('r-b'),
  type: 'body',
  action: { bodyType: 'replace', body: '{}', resourceType: 'xhr' },
} as unknown as Rule;

const responseRule: Rule = {
  ...makeBase('r-m'),
  type: 'response',
  action: {
    responseSource: 'mock',
    statusCode: 200,
    responseHeaders: { 'X-Foo': 'bar' },
    responseBody: '{}',
    contentType: 'application/json',
    bodyType: 'static',
  },
} as unknown as Rule;

const blockRule: Rule = { ...makeBase('r-bl'), type: 'block', action: {} } as unknown as Rule;

const FIXTURES: ReadonlyArray<{ name: string; rule: Rule }> = [
  { name: 'header', rule: headerRule },
  { name: 'query-param', rule: queryParamRule },
  { name: 'redirect', rule: redirectRule },
  { name: 'delay', rule: delayRule },
  { name: 'inject', rule: injectRule },
  { name: 'body', rule: bodyRule },
  { name: 'response', rule: responseRule },
  { name: 'block', rule: blockRule },
];

describe('ACTION_SUBTREE — Rule walker parity vs. createActionEntityAdapters', () => {
  for (const { name, rule } of FIXTURES) {
    it(`extractBaseline matches factory output for ${name} rule (modulo conditions + response-headers)`, () => {
      const factoryBaseline = stripWrapperKeys(factoryAdapters.tracking.extractBaseline(rule), rule.type);
      const walkerBaseline = stripWrapperKeys(walkerAdapters.tracking.extractBaseline(rule), rule.type);
      // Factory does not emit optional-undefined inject/body leaves
      // (sourceUrl, resourceType when missing). Walker emits them as ''.
      // Drop empty-string walker keys absent from factory to keep parity
      // focused on the structural projection — the empty-string-noise
      // diff is benign (no false-positive conflicts because both sides
      // agree on '').
      for (const key of Object.keys(walkerBaseline)) {
        if (!(key in factoryBaseline) && walkerBaseline[key] === '') delete walkerBaseline[key];
      }
      expect(walkerBaseline).toEqual(factoryBaseline);
    });
  }

  it('snapshotSets header sets match factory', () => {
    const factory = factoryAdapters.tracking.snapshotSets(headerRule);
    const walker = walkerAdapters.tracking.snapshotSets(headerRule);
    const factoryByPath = new Map(factory.map((s) => [s.setPath, [...s.byUid.keys()].sort()]));
    const walkerByPath = new Map(walker.map((s) => [s.setPath, [...s.byUid.keys()].sort()]));
    // Walker omits 'conditions' (handled by entity wrapper); compare
    // the action-rooted sets only.
    factoryByPath.delete('conditions');
    expect(walkerByPath.get('action.requestHeaders')).toEqual(factoryByPath.get('action.requestHeaders'));
    expect(walkerByPath.get('action.responseHeaders')).toEqual(factoryByPath.get('action.responseHeaders'));
  });

  it('snapshotSets query-param set matches factory', () => {
    const factory = factoryAdapters.tracking.snapshotSets(queryParamRule);
    const walker = walkerAdapters.tracking.snapshotSets(queryParamRule);
    const factoryUids = factory.find((s) => s.setPath === 'action.params')?.byUid;
    const walkerUids = walker.find((s) => s.setPath === 'action.params')?.byUid;
    expect([...(walkerUids?.keys() ?? [])].sort()).toEqual([...(factoryUids?.keys() ?? [])].sort());
  });

  it('readPath leaf reads parity for header rule', () => {
    const path = 'action.requestHeaders.thm00097.value';
    expect(walkerAdapters.tracking.readPath(headerRule, path)).toBe('v');
    expect(walkerAdapters.tracking.readPath(headerRule, path)).toBe(
      factoryAdapters.tracking.readPath(headerRule, path),
    );
  });

  it('readPath returns null for path that does not apply to this rule type', () => {
    expect(walkerAdapters.tracking.readPath(delayRule, 'action.redirectTo')).toBeNull();
    expect(walkerAdapters.tracking.readPath(headerRule, 'action.delayMs')).toBeNull();
  });
});

describe('ACTION_SUBTREE — union:<path> divergence emission', () => {
  it('emits union:action structural marker in baseline for header rule', () => {
    const baseline = walkerAdapters.tracking.extractBaseline(headerRule);
    expect(baseline['union:action']).toBeDefined();
    expect(baseline['union:action']).toContain('"kind":"header"');
  });

  it('readPath returns the same stableStringified payload at union:action', () => {
    const baseline = walkerAdapters.tracking.extractBaseline(headerRule);
    expect(walkerAdapters.tracking.readPath(headerRule, 'union:action')).toBe(baseline['union:action']);
  });

  it('different rule types produce different union:action payloads', () => {
    const headerBaseline = walkerAdapters.tracking.extractBaseline(headerRule);
    const redirectBaseline = walkerAdapters.tracking.extractBaseline(redirectRule);
    expect(headerBaseline['union:action']).not.toBe(redirectBaseline['union:action']);
    expect(redirectBaseline['union:action']).toContain('"kind":"redirect"');
  });
});

describe('ACTION_SUBTREE — union:<prefix> whole-branch resolution', () => {
  it('readUnionBranchInfo returns the live branch + discriminator at union:action', () => {
    const info = walkerAdapters.tracking.readUnionBranchInfo?.(redirectRule, 'action');
    expect(info).not.toBeNull();
    expect(info?.kind).toBe('redirect');
    expect(info?.branch).toEqual({ redirectTo: 'https://openheaders.io/x' });
  });

  it('applyResolutionToEntity replaces the branch + discriminator on union:action', () => {
    const target = JSON.parse(JSON.stringify(headerRule)) as Rule;
    const ok = walkerAdapters.resolve.applyResolutionToEntity(target, 'union:action', {
      base: '',
      theirs: '',
      rowPayload: { kind: 'redirect', branch: { redirectTo: 'https://openheaders.io/new' } },
    });
    expect(ok).toBe(true);
    expect(target.type).toBe('redirect');
    if (target.type !== 'redirect') throw new Error('expected redirect after swap');
    expect(target.action.redirectTo).toBe('https://openheaders.io/new');
  });

  it('applyResolutionToEntity returns false when rowPayload is missing', () => {
    const target = JSON.parse(JSON.stringify(headerRule)) as Rule;
    expect(walkerAdapters.resolve.applyResolutionToEntity(target, 'union:action', { base: '', theirs: '' })).toBe(
      false,
    );
    expect(target.type).toBe('header');
  });
});

describe('ACTION_SUBTREE — Template bundle uses the alternative actionRoot + queryParamKey', () => {
  const template: Template = {
    uid: 't-q',
    path: 'templates/t-q.yaml',
    name: 't',
    schemaVersion: 5,
    conditions: [],
    ruleType: 'query-param',
    formValues: {
      queryParams: [{ uid: 'qp000002', operation: 'override', param: 'q', value: '1' }],
    },
  } as unknown as Template;

  it('emits paths under formValues.queryParams (not action.params)', () => {
    const baseline = templateWalkerAdapters.tracking.extractBaseline(template);
    expect(baseline['formValues.queryParams.qp000002.param']).toBe('q');
    expect(baseline['formValues.queryParams.qp000002.value']).toBe('1');
    expect(baseline['action.params.qp000002.param']).toBeUndefined();
  });
});
