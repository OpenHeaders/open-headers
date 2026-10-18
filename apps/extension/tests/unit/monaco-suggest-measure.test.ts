/**
 * The Monaco picker's string math — the `{{query` run a body editor
 * opens on (never a lone `{`, which is structure in JSON and code)
 * and the edit a pick writes back, consuming the `}}` Monaco's
 * auto-close already placed after the caret.
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import {
  buildInsertEdit,
  measureLine,
} from '@openheaders/ui/workbench/components/template-input/monaco/monaco-suggest-measure';
import { describe, expect, it } from 'vitest';

function valueRow(reference: string): VariableSuggestion {
  return {
    reference,
    scope: 'env',
    name: reference.slice(reference.indexOf('.') + 1),
    preview: { kind: 'value', value: 'https://api.openheaders.io', masked: false },
    priority: 100,
  };
}

function scaffoldRow(scope: 'env' | 'vault'): VariableSuggestion {
  return {
    reference: `${scope}.`,
    scope,
    name: '',
    preview: { kind: 'namespace', subtitle: 'Add an environment variable' },
    priority: 0,
  };
}

describe('measureLine', () => {
  it('opens on `{{` with an empty query', () => {
    expect(measureLine('{ "id": {{', 11)).toEqual({ startColumn: 9, query: '' });
  });

  it('never opens on a lone `{`', () => {
    expect(measureLine('{ "id": {', 10)).toBeNull();
    expect(measureLine('{', 2)).toBeNull();
  });

  it('carries the text typed after the braces as the query', () => {
    expect(measureLine('{ "id": {{env.AP', 17)).toEqual({ startColumn: 9, query: 'env.AP' });
  });

  it('ignores the `}}` Monaco auto-closed after the caret', () => {
    expect(measureLine('{ "id": {{}}', 11)).toEqual({ startColumn: 9, query: '' });
  });

  it('stops matching once the caret passes a closed reference', () => {
    expect(measureLine('"{{env.A}}"', 11)).toBeNull();
    expect(measureLine('"{{env.A}}"', 10)).toBeNull();
  });

  it('measures the last run on the line', () => {
    expect(measureLine('{{a}} {{b', 10)).toEqual({ startColumn: 7, query: 'b' });
  });

  it('reads only the text before the caret', () => {
    expect(measureLine('{{env.AP}} tail', 7)).toEqual({ startColumn: 1, query: 'env.' });
  });
});

describe('buildInsertEdit', () => {
  it('replaces the run and the auto-closed `}}` with the reference', () => {
    const edit = buildInsertEdit('{ "id": {{}}', 3, 9, 11, valueRow('env.A'));
    expect(edit).toEqual({
      range: { startLineNumber: 3, startColumn: 9, endLineNumber: 3, endColumn: 13 },
      text: '{{env.A}}',
      caretColumn: 18,
      scaffold: false,
    });
  });

  it('ends at the caret when nothing closes the run', () => {
    const edit = buildInsertEdit('{ "id": {{en', 1, 9, 13, valueRow('env.A'));
    expect(edit.range).toEqual({ startLineNumber: 1, startColumn: 9, endLineNumber: 1, endColumn: 13 });
    expect(edit.caretColumn).toBe(18);
  });

  it('lands a scaffold caret after its dot', () => {
    const edit = buildInsertEdit('{ "id": {{', 1, 9, 11, scaffoldRow('env'));
    expect(edit.text).toBe('{{env.}}');
    expect(edit.caretColumn).toBe(15);
    expect(edit.scaffold).toBe(true);
  });

  it('replaces a complete reference the caret sits inside', () => {
    const edit = buildInsertEdit('{{old}} x', 1, 1, 4, valueRow('env.NEW'));
    expect(edit.range).toEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 8 });
    expect(edit.text).toBe('{{env.NEW}}');
  });

  it('leaves a later reference alone when its `{{` comes before the next `}}`', () => {
    const edit = buildInsertEdit('{{a {{b}}', 1, 1, 4, valueRow('env.A'));
    expect(edit.range.endColumn).toBe(4);
  });
});
