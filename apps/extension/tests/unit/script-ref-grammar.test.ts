/**
 * The script editor's reference grammar — where a script names a
 * variable the runtime resolves: the string argument of
 * `oh.variables.get` and `oh.vault.get`.
 *
 * Contract: a closed string literal of either lookup is one span,
 * quotes included, reading the literal as the reference (under
 * `vault.` for the vault lookup); an empty literal, a computed
 * template literal, a non-literal argument and any other call paint
 * nothing; the run opens on the quote of an unclosed literal with the
 * lookup's own scopes; a pick writes the bare name inside the quotes
 * and the vault lookup drops the namespace prefix.
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import { OH_API_REF_GRAMMAR as grammar } from '@openheaders/ui/workbench/components/script-editor/script-ref-grammar';
import { describe, expect, it } from 'vitest';

function valueRow(reference: string, scope: 'env' | 'vault' = 'env'): VariableSuggestion {
  return {
    reference,
    scope,
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

/** 1-based column of the n-th quote character on the line. */
function quoteColumn(line: string, nth = 1): number {
  let from = -1;
  for (let i = 0; i < nth; i++) from = line.indexOf("'", from + 1);
  return from + 1;
}

describe('OH_API_REF_GRAMMAR.refs', () => {
  it('reads the closed string of a variables lookup, quotes included', () => {
    const line = "const host = await oh.variables.get('env.HOST');";
    expect(grammar.refs(line)).toEqual([
      { startColumn: quoteColumn(line), endColumn: quoteColumn(line, 2) + 1, inner: 'env.HOST' },
    ]);
  });

  it('reads a vault lookup under the vault namespace, any quote style', () => {
    expect(grammar.refs('oh.vault.get("token")')).toEqual([{ startColumn: 14, endColumn: 21, inner: 'vault.token' }]);
    expect(grammar.refs('oh.vault.get(`token`)')[0]?.inner).toBe('vault.token');
  });

  it('reads two lookups on one line in order', () => {
    const line = "oh.setHeader(await oh.variables.get('a'), await oh.vault.get('b'));";
    expect(grammar.refs(line).map((s) => s.inner)).toEqual(['a', 'vault.b']);
  });

  it('paints nothing for an empty literal, a computed name, a non-literal or an unclosed string', () => {
    expect(grammar.refs("oh.variables.get('')")).toEqual([]);
    expect(grammar.refs(['oh.variables.get(`env.$', '{name}`)'].join(''))).toEqual([]);
    expect(grammar.refs('oh.variables.get(name)')).toEqual([]);
    expect(grammar.refs("oh.variables.get('env.HO")).toEqual([]);
  });

  it('ignores every other call and a bare {{ref}}', () => {
    expect(grammar.refs("oh.variables.set('name', 'value')")).toEqual([]);
    expect(grammar.refs("oh.setHeader('X', '{{env.HOST}}')")).toEqual([]);
    expect(grammar.refs("const x = '{{env.HOST}}'")).toEqual([]);
  });
});

describe('OH_API_REF_GRAMMAR.openRun', () => {
  it('opens on the quote of a variables lookup with every scope but step', () => {
    const line = "oh.variables.get('";
    expect(grammar.openRun(line, line.length + 1)).toEqual({
      startColumn: quoteColumn(line),
      query: '',
      allowed: { step: false },
    });
  });

  it('carries the text typed after the quote as the query', () => {
    const line = "  const v = await oh.variables.get( 'env.AP";
    expect(grammar.openRun(line, line.length + 1)).toMatchObject({ startColumn: quoteColumn(line), query: 'env.AP' });
  });

  it('a vault lookup queries the vault namespace and offers vault entries alone', () => {
    const line = "oh.vault.get('ok";
    const run = grammar.openRun(line, line.length + 1);
    expect(run).toMatchObject({ startColumn: quoteColumn(line), query: 'vault.ok' });
    expect(run?.allowed).toEqual({
      env: false,
      collection: false,
      workspace: false,
      live: false,
      step: false,
      file: false,
      dynamic: false,
    });
  });

  it('never opens after a closed string, inside a computed name, or on another call', () => {
    const closed = "oh.variables.get('env.A')";
    expect(grammar.openRun(closed, closed.length + 1)).toBeNull();
    expect(grammar.openRun(closed, closed.length)).toBeNull();
    const computed = ['oh.variables.get(`env.$', '{x'].join('');
    expect(grammar.openRun(computed, computed.length + 1)).toBeNull();
    const set = "oh.variables.set('";
    expect(grammar.openRun(set, set.length + 1)).toBeNull();
    expect(grammar.openRun('{{env.', 7)).toBeNull();
  });

  it('measures the caret, not the line end', () => {
    const line = "oh.variables.get('env.HOST')";
    expect(grammar.openRun(line, quoteColumn(line) + 1)).toMatchObject({ query: '' });
    expect(grammar.openRun(line, quoteColumn(line) + 4)).toMatchObject({ query: 'env' });
  });
});

describe('OH_API_REF_GRAMMAR.insert', () => {
  it('writes the reference inside the quotes and lands the caret after it', () => {
    const line = "oh.variables.get('en')";
    const start = quoteColumn(line);
    expect(grammar.insert(line, 3, start, start + 3, valueRow('env.HOST'))).toEqual({
      range: { startLineNumber: 3, startColumn: start + 1, endLineNumber: 3, endColumn: start + 3 },
      text: 'env.HOST',
      caretColumn: start + 1 + 'env.HOST'.length,
      scaffold: false,
    });
  });

  it('a vault lookup drops the namespace prefix', () => {
    const line = "oh.vault.get('')";
    const start = quoteColumn(line);
    expect(grammar.insert(line, 1, start, start + 1, valueRow('vault.token', 'vault'))).toMatchObject({
      text: 'token',
      caretColumn: start + 1 + 'token'.length,
    });
  });

  it('a scaffold pick keeps the list open narrowed', () => {
    const line = "oh.variables.get('')";
    const start = quoteColumn(line);
    expect(grammar.insert(line, 1, start, start + 1, scaffoldRow('env'))).toMatchObject({
      text: 'env.',
      scaffold: true,
      caretColumn: start + 1 + 'env.'.length,
    });
  });
});
