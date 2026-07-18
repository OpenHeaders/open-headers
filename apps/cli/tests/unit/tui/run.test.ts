/**
 * `oh tui` runner — tty precondition, first fetch and paint, quit
 * paths (q, Ctrl+C), poll rescheduling, unreachable backoff, denial
 * stop, the OSC 52 yank write, resize repaint, and the Esc-timer
 * decoder glue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, UnreachableError, UsageError } from '../../../src/exit-codes';
import type { ToolCaller } from '../../../src/tui/data';
import { ESCAPE_TIMEOUT_MS } from '../../../src/tui/input';
import { BACKOFF_BASE_MS, POLL_INTERVAL_MS, runTui } from '../../../src/tui/run';
import { makeFakeTty } from './fake-tty';
import { makeToolCaller, TEST_ENV } from './fixtures';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const OPTIONS = { env: TEST_ENV, daemonUrl: 'http://127.0.0.1:8137' };

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('runTui', () => {
  it('refuses without an interactive terminal', async () => {
    const tty = makeFakeTty({ inputIsTTY: false });
    await expect(runTui(tty, OPTIONS)).rejects.toThrow(UsageError);
    const piped = makeFakeTty({ outputIsTTY: false });
    await expect(runTui(piped, OPTIONS)).rejects.toThrow(UsageError);
  });

  it('rejects unknown flags with the usage class', async () => {
    const tty = makeFakeTty();
    await expect(runTui(tty, { ...OPTIONS, argv: ['--bogus'] })).rejects.toThrow(UsageError);
  });

  it('enters the alt screen, paints the dashboard from the first fetch, quits on q', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    expect(tty.output.written()).toContain('\x1b[?1049h');
    expect(tty.output.written()).toContain('auth-header-inject');
    expect(tty.output.written()).toContain('team-a');

    tty.input.emit('q');
    await done;
    expect(tty.output.written()).toContain('\x1b[?1049l');
    expect(tty.input.rawMode).toBe(false);
    expect(tty.proc.listenerCount('SIGINT')).toBe(0);
    expect(tty.proc.listenerCount('SIGWINCH')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('quits on Ctrl+C delivered as a raw byte', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    tty.input.emit('\x03');
    await done;
    expect(tty.output.written()).toContain('\x1b[?1049l');
  });

  it('polls on the interval and r refreshes immediately', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    const initial = fixture.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fixture.calls.length).toBe(initial + 3);
    tty.input.emit('r');
    await flush();
    expect(fixture.calls.length).toBe(initial + 6);
    tty.input.emit('q');
    await done;
  });

  it('parks on unreachable and retries with backoff', async () => {
    const tty = makeFakeTty();
    let attempts = 0;
    const call: ToolCaller = async () => {
      attempts += 1;
      throw new UnreachableError('no daemon');
    };
    const done = runTui(tty, { ...OPTIONS, call });
    await flush();
    expect(attempts).toBe(3);
    expect(tty.output.written()).toContain('Daemon unreachable or MCP disabled');
    await vi.advanceTimersByTimeAsync(BACKOFF_BASE_MS);
    expect(attempts).toBe(6);
    tty.input.emit('q');
    await done;
  });

  it('a policy denial renders verbatim and is never retried around', async () => {
    const tty = makeFakeTty();
    let attempts = 0;
    const call: ToolCaller = async () => {
      attempts += 1;
      throw new AuthError('permission denied: read tools are disabled on this host');
    };
    const done = runTui(tty, { ...OPTIONS, call });
    await flush();
    const after = attempts;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts).toBe(after);
    expect(tty.output.written()).toContain('permission denied');
    tty.input.emit('q');
    await done;
  });

  it('y on the rules pane writes the OSC 52 clipboard escape', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    tty.input.emit('3');
    tty.input.emit('y');
    await flush();
    expect(tty.output.written()).toContain(`\x1b]52;c;${Buffer.from('rule-auth').toString('base64')}\x07`);
    tty.input.emit('q');
    await done;
  });

  it('Enter on a rule fetches the definition and renders the drill-in', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    tty.input.emit('3');
    tty.input.emit('\r');
    await flush();
    expect(fixture.calls.some((entry) => entry.tool === 'rules_get')).toBe(true);
    expect(tty.output.written()).toContain('Rule: auth-header-inject');
    tty.input.emit('\x1b');
    await vi.advanceTimersByTimeAsync(ESCAPE_TIMEOUT_MS + 1);
    tty.input.emit('q');
    await done;
  });

  it('repaints on resize with the new geometry', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    tty.output.clear();
    tty.output.columns = 60;
    tty.output.rows = 20;
    tty.proc.emit('SIGWINCH');
    expect(tty.output.written()).toContain('1 Workspaces');
    tty.input.emit('q');
    await done;
  });

  it('a lone Esc resolves through the timer without side effects', async () => {
    const tty = makeFakeTty();
    const fixture = makeToolCaller();
    const done = runTui(tty, { ...OPTIONS, call: fixture.call });
    await flush();
    tty.input.emit('\x1b');
    await vi.advanceTimersByTimeAsync(ESCAPE_TIMEOUT_MS + 1);
    expect(tty.output.written()).not.toContain('\x1b[?1049l');
    tty.input.emit('q');
    await done;
  });
});
