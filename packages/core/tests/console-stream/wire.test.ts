import { describe, expect, it } from 'vitest';

import {
  CONSOLE_STREAM_PORT_PREFIX,
  consoleStreamPortName,
  parseConsoleStreamPortName,
} from '../../src/console-stream/wire';

describe('console-stream port name', () => {
  it('round-trips consoleStreamPortName ↔ parseConsoleStreamPortName', () => {
    expect(parseConsoleStreamPortName(consoleStreamPortName(7))).toBe(7);
    expect(parseConsoleStreamPortName(consoleStreamPortName(0))).toBe(0);
    expect(CONSOLE_STREAM_PORT_PREFIX).toBe('oh-console:');
  });

  it('rejects sibling prefixes + malformed suffixes', () => {
    expect(parseConsoleStreamPortName('oh-fires:1')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:nope')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:-1')).toBeNull();
    // The \d+ gate rejects numeric-prefix-then-garbage a bare parseInt accepts.
    expect(parseConsoleStreamPortName('oh-console:12abc')).toBeNull();
    expect(parseConsoleStreamPortName('oh-console:0x1f')).toBeNull();
  });
});
