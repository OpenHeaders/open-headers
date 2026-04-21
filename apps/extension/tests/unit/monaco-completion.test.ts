/**
 * Unit coverage for the Monaco completion provider factory
 * (docs/VARIABLE_AUTOCOMPLETE_PLAN.md §Phase D).
 *
 * The registration API (`monaco.languages.registerCompletionItemProvider`)
 * is exercised with a minimal stub; we capture the registered provider
 * and invoke its `provideCompletionItems` directly with a fake model
 * so tests run fast without a real Monaco worker.
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import { describe, expect, it, vi } from 'vitest';
import {
  COMPLETION_LANGUAGES,
  registerVariableCompletionProvider,
} from '@/workbench/components/template-input/monaco-completion';

// ── Fake Monaco shim ──────────────────────────────────────────────

interface CapturedProvider {
  language: string;
  provider: {
    triggerCharacters?: ReadonlyArray<string>;
    provideCompletionItems: (
      model: { getLineContent: (n: number) => string },
      position: { lineNumber: number; column: number },
    ) => { suggestions: unknown[] };
  };
  dispose: ReturnType<typeof vi.fn>;
}

function fakeMonaco() {
  const captured: CapturedProvider[] = [];
  return {
    captured,
    api: {
      languages: {
        CompletionItemKind: { Variable: 5 },
        CompletionItemTag: { Deprecated: 1 },
        registerCompletionItemProvider: (language: string, provider: CapturedProvider['provider']) => {
          const dispose = vi.fn();
          captured.push({ language, provider, dispose });
          return { dispose };
        },
      },
    } as unknown as Parameters<typeof registerVariableCompletionProvider>[0],
  };
}

// ── Fixtures ──────────────────────────────────────────────────────

function sug(reference: string, scope: VariableSuggestion['scope'] = 'env'): VariableSuggestion {
  return {
    reference,
    scope,
    name: reference.split('.').slice(1).join('.') || reference,
    preview: { kind: 'value', value: `value-of-${reference}`, masked: false },
    priority: 100,
  };
}

function fakeModel(line: string) {
  return {
    getLineContent: (_n: number) => line,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('registerVariableCompletionProvider', () => {
  it('registers one provider per default language', () => {
    const fake = fakeMonaco();
    registerVariableCompletionProvider(fake.api, { getSuggestions: () => [] });
    expect(fake.captured.map((c) => c.language).sort()).toEqual([...COMPLETION_LANGUAGES].sort());
  });

  it('registers only against explicitly-requested languages', () => {
    const fake = fakeMonaco();
    registerVariableCompletionProvider(fake.api, { getSuggestions: () => [], languages: ['json'] });
    expect(fake.captured.map((c) => c.language)).toEqual(['json']);
  });

  it('returns a disposable that disposes every registration', () => {
    const fake = fakeMonaco();
    const handle = registerVariableCompletionProvider(fake.api, { getSuggestions: () => [] });
    handle.dispose();
    for (const c of fake.captured) expect(c.dispose).toHaveBeenCalledTimes(1);
  });

  it('includes `{` and `.` in triggerCharacters', () => {
    const fake = fakeMonaco();
    registerVariableCompletionProvider(fake.api, { getSuggestions: () => [] });
    const provider = fake.captured[0].provider;
    expect(provider.triggerCharacters).toEqual(['{', '.']);
  });

  describe('provideCompletionItems', () => {
    function firstProvider(getSuggestions: () => VariableSuggestion[]) {
      const fake = fakeMonaco();
      registerVariableCompletionProvider(fake.api, { getSuggestions, languages: ['json'] });
      return fake.captured[0].provider;
    }

    it('returns empty when no `{{` appears before the caret', () => {
      const provider = firstProvider(() => [sug('env.API_URL')]);
      const model = fakeModel('{ "url": "https://openheaders.io" ');
      const result = provider.provideCompletionItems(model, { lineNumber: 1, column: 20 });
      expect(result.suggestions).toEqual([]);
    });

    it('returns empty when the reference is already closed (has `}}` after the `{{`)', () => {
      const provider = firstProvider(() => [sug('env.API_URL')]);
      // Line: `{ "url": "{{env.API_URL}}"`. Caret after closing quote.
      const line = '{ "url": "{{env.API_URL}}"';
      const model = fakeModel(line);
      const result = provider.provideCompletionItems(model, { lineNumber: 1, column: line.length + 1 });
      expect(result.suggestions).toEqual([]);
    });

    it('returns ranked suggestions when the caret is inside an open `{{`', () => {
      const provider = firstProvider(() => [
        sug('env.API_URL'),
        sug('vault.TOKEN', 'vault'),
        sug('workspace.FLAG', 'workspace'),
      ]);
      // Line: `{ "url": "{{` with caret at end.
      const line = '{ "url": "{{';
      const model = fakeModel(line);
      const result = provider.provideCompletionItems(model, { lineNumber: 1, column: line.length + 1 });
      expect(result.suggestions.length).toBeGreaterThan(0);
      const refs = (result.suggestions as Array<{ insertText: string }>).map((s) => s.insertText);
      expect(refs).toContain('env.API_URL}}');
      expect(refs).toContain('vault.TOKEN}}');
    });

    it('narrows to ci-prefix matches when the user has typed part of the reference', () => {
      const provider = firstProvider(() => [sug('env.API_URL'), sug('env.DEBUG'), sug('workspace.OTHER', 'workspace')]);
      const line = '{ "url": "{{env.ap';
      const model = fakeModel(line);
      const result = provider.provideCompletionItems(model, { lineNumber: 1, column: line.length + 1 });
      const insertTexts = (result.suggestions as Array<{ insertText: string }>).map((s) => s.insertText);
      expect(insertTexts[0]).toBe('env.API_URL}}');
      // env.DEBUG does NOT contain "env.ap" anywhere — should not appear.
      expect(insertTexts.some((t) => t.startsWith('env.DEBUG'))).toBe(false);
    });

    it('computes the replace range starting right after the `{{`', () => {
      const provider = firstProvider(() => [sug('env.API_URL')]);
      // `{{` at columns 11..12 (1-based). Caret at column 15 (after "env").
      const line = '  prefix {{env';
      const model = fakeModel(line);
      const result = provider.provideCompletionItems(model, { lineNumber: 1, column: line.length + 1 });
      const first = (result.suggestions as Array<{ range: { startColumn: number; endColumn: number } }>)[0];
      // `{{` starts at line.indexOf('{{') = 9 (0-based) → column 10 (1-based).
      // replaceStart should be the column AFTER `{{` → column 12 (1-based).
      expect(first.range.startColumn).toBe(12);
      expect(first.range.endColumn).toBe(line.length + 1);
    });

    it('marks reserved suggestions as Deprecated', () => {
      const reserved: VariableSuggestion = {
        reference: 'dynamic.',
        scope: 'dynamic',
        name: '',
        preview: { kind: 'reserved', subtitle: 'Coming soon' },
        priority: 0,
        disabled: true,
      };
      const provider = firstProvider(() => [reserved]);
      const line = '{{';
      const model = fakeModel(line);
      const result = provider.provideCompletionItems(model, { lineNumber: 1, column: line.length + 1 });
      const first = (result.suggestions as Array<{ tags?: number[] }>)[0];
      expect(first.tags).toEqual([1]); // Deprecated (our stub value).
    });
  });
});
