import { describe, expect, it } from 'vitest';

import { jsContextKey, jsContextSessionPrefix } from '../../src/js-contexts/types';
import { JS_CONTEXTS_PORT_PREFIX, jsContextsPortName, parseJsContextsPortName } from '../../src/js-contexts/wire';

describe('js-contexts port name', () => {
  it('round-trips jsContextsPortName ↔ parseJsContextsPortName', () => {
    expect(parseJsContextsPortName(jsContextsPortName(7))).toBe(7);
    expect(parseJsContextsPortName(jsContextsPortName(0))).toBe(0);
    expect(JS_CONTEXTS_PORT_PREFIX).toBe('oh-contexts:');
  });

  it('rejects sibling prefixes + malformed suffixes', () => {
    expect(parseJsContextsPortName('oh-console:1')).toBeNull();
    expect(parseJsContextsPortName('oh-contexts:')).toBeNull();
    expect(parseJsContextsPortName('oh-contexts:nope')).toBeNull();
    expect(parseJsContextsPortName('oh-contexts:-1')).toBeNull();
    // The \d+ gate rejects numeric-prefix-then-garbage a bare parseInt accepts.
    expect(parseJsContextsPortName('oh-contexts:12abc')).toBeNull();
    expect(parseJsContextsPortName('oh-contexts:0x1f')).toBeNull();
  });
});

describe('js-contexts identity keys', () => {
  it('mints session-scoped keys and a matching session prefix', () => {
    expect(jsContextKey('page', 3)).toBe('page::3');
    expect(jsContextKey('child-abc', 3)).toBe('child-abc::3');
    expect(jsContextKey('page', 3).startsWith(jsContextSessionPrefix('page'))).toBe(true);
    expect(jsContextKey('child-abc', 3).startsWith(jsContextSessionPrefix('page'))).toBe(false);
  });
});
