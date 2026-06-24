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

import type { HeaderModification, HeaderRule } from '@openheaders/core/types';
import { buildHeaderModUpdate } from '@openheaders/ui/panel/data/header-mod-edit';
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
