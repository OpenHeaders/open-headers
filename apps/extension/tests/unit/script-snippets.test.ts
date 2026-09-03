/**
 * The snippet catalog — every slot kind's list against the laws the
 * catalog states: the hook's own group leads and the tail is shared in
 * one order; a snippet only calls what its kind's ambient `oh`
 * declares; a test snippet's label is its test name; the container
 * mount drops the request-only entries.
 */

import { SCRIPT_KINDS } from '@openheaders/core/scripts';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { ohAmbientDts } from '@openheaders/ui/workbench/components/script-editor/oh-types';
import {
  filterScriptSnippetGroups,
  getScriptSnippetGroups,
} from '@openheaders/ui/workbench/components/script-editor/script-snippets';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

const OWN_GROUP: Record<(typeof SCRIPT_KINDS)[number], string> = {
  'pre-request': 'Request',
  'post-response': 'Response',
  'ws-before-connect': 'Connect',
  'ws-before-send': 'Send',
  'ws-on-message': 'Message',
  'ws-after-close': 'Close',
  'mqtt-before-connect': 'Connect',
  'mqtt-before-publish': 'Publish',
  'mqtt-on-message': 'Message',
  'mqtt-after-close': 'Close',
  'grpc-before-invoke': 'Invoke',
  'grpc-on-message': 'Message',
  'grpc-after-response': 'Response',
};

/** The hooks that assert — the after / on hooks; the before hooks
 *  carry no Tests group. */
const TESTED = new Set([
  'post-response',
  'ws-on-message',
  'ws-after-close',
  'mqtt-on-message',
  'mqtt-after-close',
  'grpc-on-message',
  'grpc-after-response',
]);

describe('getScriptSnippetGroups', () => {
  it('returns non-empty groups with non-empty labels and code for every kind', () => {
    for (const kind of SCRIPT_KINDS) {
      const groups = getScriptSnippetGroups(kind);
      expect(groups.length).toBeGreaterThan(0);
      for (const group of groups) {
        expect(t(group.labelKey)).toBeTruthy();
        expect(group.snippets.length).toBeGreaterThan(0);
        for (const snippet of group.snippets) {
          expect(snippet.id).toBeTruthy();
          expect(t(snippet.labelKey)).toBeTruthy();
          expect(snippet.code.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps snippet ids unique within a kind', () => {
    for (const kind of SCRIPT_KINDS) {
      const ids = getScriptSnippetGroups(kind).flatMap((g) => g.snippets.map((s) => s.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('leads with the hook’s own group and shares one tail in one order', () => {
    for (const kind of SCRIPT_KINDS) {
      const labels = getScriptSnippetGroups(kind).map((g) => t(g.labelKey));
      const tail = TESTED.has(kind) ? ['Tests', 'Variables', 'Requests'] : ['Variables', 'Requests'];
      expect(labels, kind).toEqual([OWN_GROUP[kind], ...tail]);
    }
  });

  it('every snippet parses under the sandbox async-function wrapper', () => {
    for (const kind of SCRIPT_KINDS) {
      for (const group of getScriptSnippetGroups(kind)) {
        for (const snippet of group.snippets) {
          // Same wrapper the sandbox uses to run scripts — constructing
          // the Function parses without executing.
          expect(
            () => new Function('oh', 'console', `"use strict";\nreturn (async () => {\n${snippet.code}\n})();`),
            `${kind} / ${snippet.id}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('a snippet only reaches what its kind’s ambient `oh` declares', () => {
    for (const kind of SCRIPT_KINDS) {
      const dts = ohAmbientDts(kind);
      for (const group of getScriptSnippetGroups(kind)) {
        for (const snippet of group.snippets) {
          for (const [, member] of snippet.code.matchAll(/\boh\.([A-Za-z_]+)/g)) {
            // A method reads `name(`; a view or field `name:` / `name?:`.
            expect(new RegExp(`\\b${member}\\??\\s*[(:]`).test(dts), `${kind} / ${snippet.id} → oh.${member}`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it('a test snippet’s label is its test name, verbatim', () => {
    let tests = 0;
    for (const kind of SCRIPT_KINDS) {
      for (const group of getScriptSnippetGroups(kind)) {
        if (t(group.labelKey) !== 'Tests') continue;
        for (const snippet of group.snippets) {
          tests += 1;
          const name = /oh\.test\('([^']+)'/.exec(snippet.code)?.[1];
          expect(name, `${kind} / ${snippet.id}`).toBe(t(snippet.labelKey));
        }
      }
    }
    expect(tests).toBeGreaterThan(0);
  });

  it('the container mount drops the request-only entries and nothing else', () => {
    const requestOnly = SCRIPT_KINDS.flatMap((kind) =>
      getScriptSnippetGroups(kind)
        .flatMap((g) => g.snippets)
        .filter((s) => s.requestOnly)
        .map((s) => s.id),
    );
    expect(requestOnly).toEqual(['set-url', 'set-method', 'set-json-body', 'grpc-set-message', 'ws-set-url']);
    for (const kind of SCRIPT_KINDS) {
      const all = getScriptSnippetGroups(kind, 'request').flatMap((g) => g.snippets.map((s) => s.id));
      const container = getScriptSnippetGroups(kind, 'container').flatMap((g) => g.snippets.map((s) => s.id));
      expect(container).toEqual(all.filter((id) => !requestOnly.includes(id)));
    }
    expect(getScriptSnippetGroups('pre-request', 'container').map((g) => t(g.labelKey))).toEqual([
      'Request',
      'Variables',
      'Requests',
    ]);
  });

  it('carries no Packages group — the Packages menu beside it inserts the real requires', () => {
    for (const kind of SCRIPT_KINDS) {
      const groups = getScriptSnippetGroups(kind);
      expect(groups.map((g) => t(g.labelKey))).not.toContain('Packages');
      expect(groups.flatMap((g) => g.snippets).some((s) => s.code.includes('oh.require('))).toBe(false);
    }
  });
});

describe('filterScriptSnippetGroups', () => {
  it('returns the input untouched for an empty or whitespace query', () => {
    const groups = getScriptSnippetGroups('pre-request');
    expect(filterScriptSnippetGroups(groups, '', t)).toBe(groups);
    expect(filterScriptSnippetGroups(groups, '   ', t)).toBe(groups);
  });

  it('matches labels case-insensitively and drops emptied groups', () => {
    const groups = getScriptSnippetGroups('post-response');
    const filtered = filterScriptSnippetGroups(groups, 'STATUS CODE', t);
    expect(filtered.length).toBe(1);
    const firstGroup = filtered[0];
    expect(firstGroup && t(firstGroup.labelKey)).toBe('Tests');
    expect(filtered[0]?.snippets.map((s) => s.id)).toEqual(['status-code-200']);
  });

  it('returns no groups when nothing matches', () => {
    expect(filterScriptSnippetGroups(getScriptSnippetGroups('pre-request'), 'zzz-no-match', t)).toEqual([]);
  });
});
