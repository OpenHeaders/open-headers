/**
 * Daemon logger — the one-event-one-line guarantee behind service
 * logs (grep/journalctl/fail2ban consumers), level filtering from the
 * resolved config, and error/warn routing to stderr.
 */

import { describe, expect, it } from 'vitest';

import { createDaemonLogger, formatLogLine } from '../../src/logger';

function capture(level: 'error' | 'warn' | 'info' | 'debug') {
  const out: string[] = [];
  const err: string[] = [];
  const log = createDaemonLogger({ level, writeOut: (line) => out.push(line), writeErr: (line) => err.push(line) });
  return { log, out, err };
}

describe('formatLogLine', () => {
  it('renders timestamp, level label, scope, and message', () => {
    const line = formatLogLine('info', 'oh-daemon', ['starting']);
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO {2}\[oh-daemon\] starting$/);
  });

  it('flattens every argument into one physical line', () => {
    const line = formatLogLine('warn', 'Scope', [
      'context',
      new Error('boom\nwith stack-ish newline'),
      { peer: '192.168.1.20' },
    ]);
    expect(line).not.toContain('\n');
    expect(line).toContain('Error: boom\\nwith stack-ish newline');
    expect(line).toContain('{"peer":"192.168.1.20"}');
  });

  it('escapes newlines embedded in the message itself', () => {
    expect(formatLogLine('error', 'S', ['a\nb\r\nc'])).not.toContain('\n');
  });
});

describe('createDaemonLogger', () => {
  it('filters below the configured level', () => {
    const { log, out, err } = capture('warn');
    log.debug('S', 'nope');
    log.info('S', 'nope');
    log.warn('S', 'yes');
    log.error('S', 'yes');
    expect(out).toHaveLength(0);
    expect(err).toHaveLength(2);
  });

  it('routes info/debug to stdout and warn/error to stderr', () => {
    const { log, out, err } = capture('debug');
    log.info('S', 'operational');
    log.debug('S', 'detail');
    log.warn('S', 'anomaly');
    expect(out).toHaveLength(2);
    expect(err).toHaveLength(1);
    expect(err[0]).toContain('WARN  [S] anomaly');
  });
});
