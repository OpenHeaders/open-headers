/**
 * Regex filter compilation for the message-stream grids — host
 * semantics: case-insensitive; an invalid pattern degrades to a literal
 * match on the Messages tab and to match-nothing on EventStream.
 */

import { compileStreamFilter } from '@openheaders/ui/panel/components/detail/streams/stream-filter';
import { describe, expect, it } from 'vitest';

describe('compileStreamFilter', () => {
  it('empty input means no filter', () => {
    expect(compileStreamFilter('', 'literal')).toBeNull();
    expect(compileStreamFilter('', 'never')).toBeNull();
  });

  it('compiles a valid pattern case-insensitively', () => {
    const re = compileStreamFilter('(web)?socket', 'literal');
    expect(re?.test('WebSocket')).toBe(true);
    expect(re?.test('socket')).toBe(true);
    expect(re?.test('frame')).toBe(false);
  });

  it('an invalid pattern degrades to a literal match (Messages)', () => {
    const re = compileStreamFilter('push (', 'literal');
    expect(re?.test('push (1/9999')).toBe(true);
    expect(re?.test('push 1')).toBe(false);
  });

  it('an invalid pattern matches nothing (EventStream)', () => {
    const re = compileStreamFilter('https?(', 'never');
    expect(re?.test('https://openheaders.io')).toBe(false);
    expect(re?.test('')).toBe(false);
  });
});
