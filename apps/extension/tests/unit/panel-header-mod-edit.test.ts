/**
 * Inspector header-row popover Save payload — `buildHeaderModUpdate`.
 *
 * The headline contract is the publication-gate fix: the popover is an
 * atomic edit, so committing a value tweak on a LIVE (published) rule
 * must keep it published. `applyRuleUpdate` auto-unpublishes a published
 * rule on any runtime-affecting edit; the workbench re-publishes in a
 * second batch, but the popover has no such step, so it carries
 * `published: true` in the same batch — which the publication gate reads
 * as the explicit publish gesture and so skips the auto-unpublish.
 * Without this, editing an injected header's value in the popover
 * silently dropped the rule to draft and it stopped firing.
 */

import type { HeaderModification, HeaderRule, RuleCondition } from '@openheaders/core/types';
import {
  buildHeaderModUpdate,
  buildHeaderModValueUpdate,
} from '@openheaders/ui/panel/data/rule-create/header-mod-edit';
import { describe, expect, it } from 'vitest';

function makeMod(over: Partial<HeaderModification> = {}): HeaderModification {
  return { uid: 'mod-1', operation: 'override', headerName: 'x-debug', value: 'true', ...over };
}

function makeRule(over: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'rule-1',
    path: 'rules/Debug/Header',
    name: 'Debug header',
    enabled: true,
    type: 'header',
    conditions: [],
    action: { requestHeaders: [makeMod()], responseHeaders: [] },
    ...over,
  };
}

describe('buildHeaderModUpdate — publication preservation', () => {
  it('keeps a published rule published (the regression fix)', () => {
    const rule = makeRule({ published: true });
    const mod = rule.action.requestHeaders[0];
    const result = buildHeaderModUpdate(rule, 'request', mod, {
      operation: 'override',
      headerName: 'x-debug',
      value: 'false',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.published).toBe(true);
    expect(result.updates.action?.requestHeaders[0].value).toBe('false');
  });

  it('does not add a published flag for a draft rule (no surprise publish)', () => {
    const rule = makeRule(); // published omitted = draft
    const mod = rule.action.requestHeaders[0];
    const result = buildHeaderModUpdate(rule, 'request', mod, {
      operation: 'override',
      headerName: 'x-debug',
      value: 'false',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('published' in result.updates).toBe(false);
  });

  it('leaves an explicitly-unpublished rule a draft', () => {
    const rule = makeRule({ published: false });
    const mod = rule.action.requestHeaders[0];
    const result = buildHeaderModUpdate(rule, 'request', mod, {
      operation: 'override',
      headerName: 'x-debug',
      value: 'false',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('published' in result.updates).toBe(false);
  });
});

describe('buildHeaderModUpdate — conditions', () => {
  const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'request-domains', values: ['openheaders.io'] }];
  const DRAFT = { operation: 'override' as const, headerName: 'x-debug', value: 'false' };

  it('carries the edited conditions in the same batch when supplied', () => {
    const rule = makeRule({ published: true });
    const result = buildHeaderModUpdate(rule, 'request', rule.action.requestHeaders[0], DRAFT, CONDITIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.conditions).toBe(CONDITIONS);
    expect(result.updates.published).toBe(true);
  });

  it('omits conditions from the batch when not supplied (untouched row)', () => {
    const rule = makeRule();
    const result = buildHeaderModUpdate(rule, 'request', rule.action.requestHeaders[0], DRAFT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('conditions' in result.updates).toBe(false);
  });
});

describe('buildHeaderModUpdate — mod rebuild', () => {
  it('preserves the row uid on edit', () => {
    const rule = makeRule({ published: true });
    const mod = rule.action.requestHeaders[0];
    const result = buildHeaderModUpdate(rule, 'request', mod, {
      operation: 'override',
      headerName: 'x-debug',
      value: 'false',
    });
    expect(result.ok && result.updates.action?.requestHeaders[0].uid).toBe('mod-1');
  });

  it('drops value/separator for a remove edit', () => {
    const rule = makeRule({ published: true });
    const mod = rule.action.requestHeaders[0];
    const result = buildHeaderModUpdate(rule, 'request', mod, {
      operation: 'remove',
      headerName: 'x-debug',
      value: 'false',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.updates.action?.requestHeaders[0];
    expect(next).toEqual({ uid: 'mod-1', operation: 'remove', headerName: 'x-debug' });
  });

  it('carries the merge separator for a merge edit', () => {
    const rule = makeRule({ published: true });
    const mod = rule.action.requestHeaders[0];
    const result = buildHeaderModUpdate(rule, 'request', mod, {
      operation: 'merge',
      headerName: 'x-debug',
      value: 'extra',
      mergeSeparator: '; ',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.action?.requestHeaders[0]).toEqual({
      uid: 'mod-1',
      operation: 'merge',
      headerName: 'x-debug',
      value: 'extra',
      mergeSeparator: '; ',
    });
  });

  it('edits the response list and leaves the request list reference untouched', () => {
    const responseMod = makeMod({ uid: 'mod-r', headerName: 'x-frame-options', value: 'DENY' });
    const rule = makeRule({
      published: true,
      action: { requestHeaders: [makeMod()], responseHeaders: [responseMod] },
    });
    const result = buildHeaderModUpdate(rule, 'response', responseMod, {
      operation: 'override',
      headerName: 'x-frame-options',
      value: 'SAMEORIGIN',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.action?.responseHeaders[0].value).toBe('SAMEORIGIN');
    // Untouched direction passes the original array reference through.
    expect(result.updates.action?.requestHeaders).toBe(rule.action.requestHeaders);
  });

  it('reports mod-detached when the live mod is no longer in the list', () => {
    const rule = makeRule({ published: true });
    const orphan = makeMod({ uid: 'mod-gone' });
    const result = buildHeaderModUpdate(rule, 'request', orphan, {
      operation: 'override',
      headerName: 'x-debug',
      value: 'false',
    });
    expect(result).toEqual({ ok: false, reason: 'mod-detached' });
  });
});

describe('buildHeaderModValueUpdate — value-document Save payload', () => {
  it('replaces only the targeted mod value, everything else carried verbatim', () => {
    const other = makeMod({ uid: 'mod-2', headerName: 'x-tenant', value: 'openheaders' });
    const merge = makeMod({ uid: 'mod-3', operation: 'merge', headerName: 'x-tags', value: 'a', mergeSeparator: ',' });
    const rule = makeRule({
      published: true,
      action: { requestHeaders: [makeMod(), other, merge], responseHeaders: [] },
    });
    const result = buildHeaderModValueUpdate(rule, 'request', 'mod-3', 'a,b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.action?.requestHeaders[2]).toEqual({
      uid: 'mod-3',
      operation: 'merge',
      headerName: 'x-tags',
      value: 'a,b',
      mergeSeparator: ',',
    });
    expect(result.updates.action?.requestHeaders[0]).toBe(rule.action.requestHeaders[0]);
    expect(result.updates.action?.requestHeaders[1]).toBe(other);
  });

  it('keeps a published rule published in the same batch', () => {
    const rule = makeRule({ published: true });
    const result = buildHeaderModValueUpdate(rule, 'request', 'mod-1', 'next');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.published).toBe(true);
  });

  it('does not add a published flag for a draft rule', () => {
    const rule = makeRule();
    const result = buildHeaderModValueUpdate(rule, 'request', 'mod-1', 'next');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('published' in result.updates).toBe(false);
  });

  it('edits the response list and passes the request list reference through', () => {
    const responseMod = makeMod({ uid: 'mod-r', headerName: 'x-frame-options', value: 'DENY' });
    const rule = makeRule({
      published: true,
      action: { requestHeaders: [makeMod()], responseHeaders: [responseMod] },
    });
    const result = buildHeaderModValueUpdate(rule, 'response', 'mod-r', 'SAMEORIGIN');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updates.action?.responseHeaders[0].value).toBe('SAMEORIGIN');
    expect(result.updates.action?.requestHeaders).toBe(rule.action.requestHeaders);
  });

  it('reports mod-detached when no mod carries the uid', () => {
    const rule = makeRule({ published: true });
    expect(buildHeaderModValueUpdate(rule, 'request', 'mod-gone', 'x')).toEqual({
      ok: false,
      reason: 'mod-detached',
    });
  });

  it('reports mod-detached for a remove-operation mod (no value to hold)', () => {
    const removeMod = makeMod({ uid: 'mod-rm', operation: 'remove', value: undefined });
    const rule = makeRule({ action: { requestHeaders: [removeMod], responseHeaders: [] } });
    expect(buildHeaderModValueUpdate(rule, 'request', 'mod-rm', 'x')).toEqual({
      ok: false,
      reason: 'mod-detached',
    });
  });
});
