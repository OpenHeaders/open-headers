/**
 * In-daemon unattended auto-update — arming gates (opt-in default off,
 * dev builds, non-binary installs, env kill-switch), the daily timer
 * loop, the stage → supervised-restart handoff, and the staged-version
 * memory that stops a unit-less daemon re-downloading the same release
 * every day.
 */

import { describe, expect, it } from 'vitest';
import { installDaemonAutoUpdate } from '../../src/auto-update';
import type { StageOutcome, StageUpgradeDeps } from '../../src/cli/upgrade';

interface Harness {
  timers: Array<{ fn: () => void; ms: number }>;
  stageCalls: StageUpgradeDeps[];
  restarts: number;
  logs: string[];
  handle: ReturnType<typeof installDaemonAutoUpdate>;
}

function makeHarness(
  overrides: {
    enabled?: boolean;
    channel?: 'stable' | 'beta' | null;
    installKind?: 'binary' | 'node' | 'container';
    env?: NodeJS.ProcessEnv;
    stageResults?: Array<StageOutcome | Error>;
    restartFn?: (() => void) | null;
  } = {},
): Harness {
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const stageCalls: StageUpgradeDeps[] = [];
  const logs: string[] = [];
  const results = [...(overrides.stageResults ?? [])];
  const harness: Harness = {
    timers,
    stageCalls,
    restarts: 0,
    logs,
    handle: installDaemonAutoUpdate({
      enabled: overrides.enabled ?? true,
      channel: overrides.channel !== undefined ? overrides.channel : 'stable',
      installKind: overrides.installKind ?? 'binary',
      env: overrides.env ?? {},
      log: {
        info: (_scope, msg) => logs.push(`info:${msg}`),
        warn: (_scope, msg) => logs.push(`warn:${msg}`),
        error: (_scope, msg) => logs.push(`error:${msg}`),
        debug: (_scope, msg) => logs.push(`debug:${msg}`),
      },
      stageFn: async (deps) => {
        stageCalls.push(deps);
        const next = results.shift() ?? { status: 'up-to-date', version: '2026.7.0' };
        if (next instanceof Error) throw next;
        return next;
      },
      restartFn:
        overrides.restartFn !== undefined
          ? overrides.restartFn
          : () => {
              harness.restarts += 1;
            },
      setTimer: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length as unknown as NodeJS.Timeout;
      },
      clearTimer: () => undefined,
      random: () => 0.5,
    }),
  };
  return harness;
}

async function fire(h: Harness, index: number): Promise<void> {
  h.timers[index]?.fn();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('installDaemonAutoUpdate', () => {
  it('arms only when enabled on a released binary outside the kill-switch', () => {
    expect(makeHarness({ enabled: false }).timers).toHaveLength(0);
    expect(makeHarness({ channel: null }).timers).toHaveLength(0);
    expect(makeHarness({ env: { OH_NO_UPDATE_CHECK: '1' } }).timers).toHaveLength(0);
    expect(makeHarness().timers).toHaveLength(1);
  });

  it('stands down with a log line on non-binary installs', () => {
    const node = makeHarness({ installKind: 'node' });
    expect(node.timers).toHaveLength(0);
    expect(node.logs.some((line) => line.includes('standing down'))).toBe(true);
    expect(makeHarness({ installKind: 'container' }).timers).toHaveLength(0);
  });

  it('an up-to-date check reschedules the daily timer', async () => {
    const h = makeHarness();
    await fire(h, 0);
    expect(h.stageCalls).toHaveLength(1);
    expect(h.restarts).toBe(0);
    expect(h.timers).toHaveLength(2);
  });

  it('a staged upgrade restarts through the supervisor and stops rescheduling', async () => {
    const h = makeHarness({
      stageResults: [{ status: 'staged', from: '2026.7.0', to: '2026.7.19', tag: 'v2026.7.19', asset: 'x' }],
    });
    await fire(h, 0);
    expect(h.restarts).toBe(1);
    expect(h.timers).toHaveLength(1);
  });

  it('without a unit the stage is remembered so the same release is not re-downloaded', async () => {
    const h = makeHarness({
      restartFn: null,
      stageResults: [{ status: 'staged', from: '2026.7.0', to: '2026.7.19', tag: 'v2026.7.19', asset: 'x' }],
    });
    await fire(h, 0);
    expect(h.logs.some((line) => line.includes('next restart'))).toBe(true);
    expect(h.timers).toHaveLength(2);
    await fire(h, 1);
    expect(h.stageCalls[1]?.currentVersion).toBe('2026.7.19');
  });

  it('a failed check logs a warning and keeps the schedule alive', async () => {
    const h = makeHarness({ stageResults: [new Error('feed unreachable')] });
    await fire(h, 0);
    expect(h.logs.some((line) => line.startsWith('warn:'))).toBe(true);
    expect(h.timers).toHaveLength(2);
  });

  it('dispose cancels the pending timer', () => {
    const h = makeHarness();
    h.handle.dispose();
    h.timers[0]?.fn();
    expect(h.stageCalls).toHaveLength(0);
  });
});
