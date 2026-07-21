import { describe, expect, it } from 'vitest';

import {
  CONSOLE_STREAM_PORT_PREFIX,
  consoleStreamPortName,
  parseConsoleStreamPortName,
} from '../../src/console-stream/wire';
import { parseQualifiedConsolePortName, qualifiedConsolePortName } from '../../src/protocol/telemetry-console';

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

  it('the local parser rejects the qualified remote shape and vice versa', () => {
    expect(parseConsoleStreamPortName(qualifiedConsolePortName(7, 'node-a'))).toBeNull();
    expect(parseQualifiedConsolePortName(consoleStreamPortName(7))).toBeNull();
  });
});

describe('qualified console port name', () => {
  it('round-trips qualifiedConsolePortName ↔ parseQualifiedConsolePortName', () => {
    expect(parseQualifiedConsolePortName(qualifiedConsolePortName(7, 'node-a'))).toEqual({
      tabId: 7,
      nodeId: 'node-a',
    });
  });

  it('rejects sibling prefixes + malformed shapes', () => {
    expect(parseQualifiedConsolePortName('oh-storage:7@node-a')).toBeNull();
    expect(parseQualifiedConsolePortName('oh-console:@node-a')).toBeNull();
    expect(parseQualifiedConsolePortName('oh-console:7@')).toBeNull();
    expect(parseQualifiedConsolePortName('oh-console:12abc@node-a')).toBeNull();
  });
});
