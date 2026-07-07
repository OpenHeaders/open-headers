import {
  filterScriptSnippetGroups,
  getScriptSnippetGroups,
} from '@openheaders/ui/workbench/components/script-editor/script-snippets';
import { describe, expect, it } from 'vitest';

const KINDS = ['pre-request', 'post-response'] as const;

describe('getScriptSnippetGroups', () => {
  it('returns non-empty groups with non-empty labels and code for both kinds', () => {
    for (const kind of KINDS) {
      const groups = getScriptSnippetGroups(kind);
      expect(groups.length).toBeGreaterThan(0);
      for (const group of groups) {
        expect(group.label).toBeTruthy();
        expect(group.snippets.length).toBeGreaterThan(0);
        for (const snippet of group.snippets) {
          expect(snippet.id).toBeTruthy();
          expect(snippet.label).toBeTruthy();
          expect(snippet.code.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps snippet ids unique within a kind', () => {
    for (const kind of KINDS) {
      const ids = getScriptSnippetGroups(kind).flatMap((g) => g.snippets.map((s) => s.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('scopes request mutators to pre-request and tests to post-response', () => {
    const preLabels = getScriptSnippetGroups('pre-request').map((g) => g.label);
    const postLabels = getScriptSnippetGroups('post-response').map((g) => g.label);
    expect(preLabels).toContain('Request');
    expect(preLabels).not.toContain('Tests');
    expect(postLabels).toContain('Tests');
    expect(postLabels).not.toContain('Request');
  });

  it('every snippet parses under the sandbox async-function wrapper', () => {
    for (const kind of KINDS) {
      for (const group of getScriptSnippetGroups(kind)) {
        for (const snippet of group.snippets) {
          // Same wrapper the sandbox uses to run scripts — constructing
          // the Function parses without executing.
          expect(
            () => new Function('oh', 'console', `"use strict";\nreturn (async () => {\n${snippet.code}\n})();`),
          ).not.toThrow();
        }
      }
    }
  });
});

describe('filterScriptSnippetGroups', () => {
  it('returns the input untouched for an empty or whitespace query', () => {
    const groups = getScriptSnippetGroups('pre-request');
    expect(filterScriptSnippetGroups(groups, '')).toBe(groups);
    expect(filterScriptSnippetGroups(groups, '   ')).toBe(groups);
  });

  it('matches labels case-insensitively and drops emptied groups', () => {
    const groups = getScriptSnippetGroups('post-response');
    const filtered = filterScriptSnippetGroups(groups, 'STATUS CODE');
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.label).toBe('Tests');
    expect(filtered[0]?.snippets.map((s) => s.id)).toEqual(['status-code-200']);
  });

  it('returns no groups when nothing matches', () => {
    expect(filterScriptSnippetGroups(getScriptSnippetGroups('pre-request'), 'zzz-no-match')).toEqual([]);
  });
});
