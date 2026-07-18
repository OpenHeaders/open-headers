/**
 * `oh tui` — the Phase 3 read dashboard runner. Owns everything the
 * app state machine deliberately doesn't: the terminal session, the
 * Esc-timer decoder glue (the canonical wiring from Phase 2), the
 * poll/backoff/staleness timers, the RPC fetches, and the OSC 52
 * clipboard write. Connection resolution is identical to every CLI
 * command: flag → env → config file → loopback default. Unreachable
 * parks and auto-retries with backoff; policy denials render verbatim
 * and are never retried around (plan §4 honesty law).
 */

import { parseArgs } from 'node:util';
import { cliConfigPath, readCliConfig } from '../config-store';
import { resolveConnection } from '../connection';
import { AuthError, UnreachableError, UsageError } from '../exit-codes';
import { callTool } from '../rpc';
import { createTuiApp, type Effect } from './app';
import { detectCapabilities, type EnvLike } from './capability';
import { osc52Copy } from './clipboard';
import {
  fetchDashboardSnapshot,
  fetchRuleDetail,
  publishRule,
  switchEnvironment,
  switchWorkspace,
  type ToolCaller,
  toggleRule,
} from './data';
import { createTuiTranslator } from './i18n';
import { createInputDecoder, ESCAPE_TIMEOUT_MS, type TuiInputEvent } from './input';
import { measureTerminal, watchResize } from './resize';
import { createScreenRenderer } from './screen';
import { openTerminalSession } from './terminal-session';
import type { ProcessLike, TtyInput, TtyOutput } from './tty';
import { viewTui } from './view';

export interface TuiIo {
  readonly input: TtyInput;
  readonly output: TtyOutput;
  readonly errorOutput: TtyOutput;
  readonly proc: ProcessLike;
}

export interface TuiRunOptions {
  /** argv after the `tui` word — `--daemon/--token/--no-color/--ascii`. */
  readonly argv?: readonly string[];
  readonly env?: EnvLike;
  /** Injected tool caller (tests); defaults to the JSON-RPC client. */
  readonly call?: ToolCaller;
  /** Injected daemon URL label when `call` is injected. */
  readonly daemonUrl?: string;
  readonly clock?: () => number;
}

export const POLL_INTERVAL_MS = 2000;
export const TICK_INTERVAL_MS = 1000;
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30000;

interface TuiFlags {
  daemon?: string;
  token?: string;
  noColor: boolean;
  ascii: boolean;
}

function parseTuiFlags(argv: readonly string[]): TuiFlags {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options: {
        daemon: { type: 'string' },
        token: { type: 'string' },
        'no-color': { type: 'boolean' },
        ascii: { type: 'boolean' },
      },
      allowPositionals: true,
    });
    if (positionals.length > 0) throw new UsageError(`unexpected argument: ${positionals[0]}`);
    return {
      daemon: values.daemon,
      token: values.token,
      noColor: values['no-color'] === true,
      ascii: values.ascii === true,
    };
  } catch (err) {
    if (err instanceof UsageError) throw err;
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
}

/** Resolves when the user quits; the session restores the terminal on every other path itself. */
export async function runTui(io: TuiIo, options: TuiRunOptions = {}): Promise<void> {
  const { input, output, proc } = io;
  if (input.isTTY !== true || output.isTTY !== true) {
    throw new UsageError('oh tui needs an interactive terminal (a tty on stdin and stdout)');
  }
  const env: EnvLike = options.env ?? {};
  const flags = parseTuiFlags(options.argv ?? []);
  const clock = options.clock ?? Date.now;

  let call = options.call;
  let daemonUrl = options.daemonUrl ?? '';
  if (call === undefined) {
    const config = await readCliConfig(cliConfigPath());
    const envRecord: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(env)) envRecord[key] = value;
    const conn = resolveConnection({ daemon: flags.daemon, token: flags.token }, envRecord, config);
    daemonUrl = conn.daemonUrl;
    call = (tool, args) => callTool(conn, tool, args);
  }
  const toolCall: ToolCaller = call;

  const caps = detectCapabilities(env, { noColor: flags.noColor, ascii: flags.ascii });
  const t = createTuiTranslator(env);
  const app = createTuiApp({ t, daemonUrl, now: clock });

  return new Promise((resolve) => {
    const renderer = createScreenRenderer(output, measureTerminal(output));
    const decoder = createInputDecoder();
    let escapeTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let tickTimer: ReturnType<typeof setInterval> | undefined;
    let refreshing = false;
    let backoffAttempts = 0;
    let closed = false;

    function render(): void {
      if (closed) return;
      const size = measureTerminal(output);
      renderer.render(viewTui(app, size, { caps, t, now: clock() }));
    }

    function schedulePoll(delayMs: number): void {
      if (closed) return;
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => {
        pollTimer = undefined;
        void refresh();
      }, delayMs);
    }

    async function refresh(): Promise<void> {
      if (closed || refreshing) return;
      refreshing = true;
      app.setRefreshing();
      try {
        const snapshot = await fetchDashboardSnapshot(toolCall);
        if (closed) return;
        backoffAttempts = 0;
        app.applySnapshot(snapshot);
        app.setNextRetryAt(null);
        schedulePoll(POLL_INTERVAL_MS);
      } catch (err) {
        if (closed) return;
        if (err instanceof UnreachableError) {
          const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** backoffAttempts);
          backoffAttempts += 1;
          app.applyUnreachable(err.message);
          app.setNextRetryAt(clock() + delay);
          schedulePoll(delay);
        } else if (err instanceof AuthError) {
          // Policy denial: verbatim copy, no automatic retry (honesty law).
          app.applyDenied(err.message);
        } else {
          app.applyToolError(err instanceof Error ? err.message : String(err));
          schedulePoll(POLL_INTERVAL_MS);
        }
      } finally {
        refreshing = false;
        render();
      }
    }

    async function loadRuleDetail(uid: string): Promise<void> {
      try {
        const detail = await fetchRuleDetail(toolCall, uid);
        if (closed) return;
        app.applyRuleDetail(detail);
      } catch (err) {
        if (closed) return;
        app.applyToolError(err instanceof Error ? err.message : String(err));
        if (app.state.detail?.kind === 'rule' && app.state.detail.uid === uid) app.state.detail = null;
      }
      render();
    }

    function refreshNow(): void {
      if (pollTimer !== undefined) {
        clearTimeout(pollTimer);
        pollTimer = undefined;
      }
      void refresh();
    }

    /**
     * One write, apply-from-ack: the ack's state renders immediately,
     * then a snapshot refetch reconciles (and re-pulls an open rule
     * drill-in). A policy denial renders verbatim as a sticky notice and
     * is never retried; any other failure shows its copy and refetches
     * so the panes return to daemon truth.
     */
    async function performWrite(
      effect: Extract<Effect, { type: 'toggle-rule' | 'publish-rule' | 'switch-workspace' | 'switch-environment' }>,
    ): Promise<void> {
      try {
        if (effect.type === 'toggle-rule') {
          const ack = await toggleRule(toolCall, effect.uid, effect.enabled);
          if (closed) return;
          app.applyRuleWriteAck(ack);
        } else if (effect.type === 'publish-rule') {
          const ack = await publishRule(toolCall, effect.uid, effect.published);
          if (closed) return;
          app.applyRuleWriteAck(ack);
        } else if (effect.type === 'switch-environment') {
          const ack = await switchEnvironment(toolCall, effect.environmentId);
          if (closed) return;
          app.applyEnvironmentSwitchAck(ack.environmentId);
        } else {
          const ack = await switchWorkspace(toolCall, effect.workspaceId);
          if (closed) return;
          app.applyWorkspaceSwitchAck(ack.workspaceId);
        }
        const detail = app.state.detail;
        if (
          (effect.type === 'toggle-rule' || effect.type === 'publish-rule') &&
          detail?.kind === 'rule' &&
          detail.uid === effect.uid
        ) {
          void loadRuleDetail(effect.uid);
        }
        refreshNow();
      } catch (err) {
        if (closed) return;
        if (err instanceof AuthError) {
          app.applyWriteDenied(err.message);
        } else if (err instanceof UnreachableError) {
          app.applyWriteFailed(t('tui.notice.writeLost'));
          refreshNow();
        } else {
          app.applyWriteFailed(err instanceof Error ? err.message : String(err));
          refreshNow();
        }
      } finally {
        render();
      }
    }

    function runEffects(effects: readonly Effect[]): void {
      for (const effect of effects) {
        if (effect.type === 'quit') {
          quit();
          return;
        }
        if (effect.type === 'refresh') {
          refreshNow();
        } else if (effect.type === 'fetch-rule') {
          void loadRuleDetail(effect.uid);
        } else if (effect.type === 'yank') {
          output.write(osc52Copy(effect.text));
        } else {
          void performWrite(effect);
        }
      }
    }

    function handle(events: TuiInputEvent[]): void {
      const size = measureTerminal(output);
      for (const event of events) {
        runEffects(app.handleEvent(event, size));
        if (closed) return;
      }
      render();
    }

    function quit(): void {
      if (closed) return;
      closed = true;
      if (escapeTimer !== undefined) clearTimeout(escapeTimer);
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      if (tickTimer !== undefined) clearInterval(tickTimer);
      unwatch();
      session.close();
      resolve();
    }

    const session = openTerminalSession({
      input,
      output,
      proc,
      errorOutput: io.errorOutput,
      onData(chunk) {
        if (escapeTimer !== undefined) {
          clearTimeout(escapeTimer);
          escapeTimer = undefined;
        }
        handle(decoder.feed(chunk));
        if (!session.closed && decoder.pending) {
          escapeTimer = setTimeout(() => {
            escapeTimer = undefined;
            handle(decoder.flushPending());
          }, ESCAPE_TIMEOUT_MS);
        }
      },
    });
    const unwatch = watchResize(output, proc, (size) => {
      renderer.resize(size);
      render();
    });

    tickTimer = setInterval(() => {
      app.tick(clock());
      render();
    }, TICK_INTERVAL_MS);

    render();
    void refresh();
  });
}
