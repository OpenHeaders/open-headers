/**
 * Boot telemetry contract: each phase records exactly one observability
 * entry, dedupes on re-fire, and stamps a non-decreasing elapsed-ms.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('boot-telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('records sw-eval at module load and dedupes re-fires', async () => {
    const obs = await import('@/background/modules/observability-log');
    obs.__resetForTests();
    const { setOracleHostHooks } = await import('@openheaders/oracle/sync');
    setOracleHostHooks({ recordLog: obs.recordLog });
    const { markBootPhase } = await import('@/background/sync/boot-telemetry');

    const swEvalEntries = obs.getObservabilityLog().filter((e) => e.op === 'boot.sw-eval');
    expect(swEvalEntries).toHaveLength(1);
    expect(swEvalEntries[0]?.context.phase).toBe('sw-eval');
    expect(typeof swEvalEntries[0]?.context.phaseElapsedMs).toBe('number');

    markBootPhase('sw-eval');
    expect(obs.getObservabilityLog().filter((e) => e.op === 'boot.sw-eval')).toHaveLength(1);
  });

  it('records each phase exactly once with monotonic elapsedMs', async () => {
    const obs = await import('@/background/modules/observability-log');
    obs.__resetForTests();
    const { setOracleHostHooks } = await import('@openheaders/oracle/sync');
    setOracleHostHooks({ recordLog: obs.recordLog });
    const { markBootPhase } = await import('@/background/sync/boot-telemetry');

    markBootPhase('settings-ready');
    markBootPhase('hydration-done');
    markBootPhase('sync-init-done');
    markBootPhase('bridge-done');
    markBootPhase('interactive');

    const phases = obs
      .getObservabilityLog()
      .filter((e) => e.subsystem === 'sync' && e.op.startsWith('boot.'))
      .map((e) => ({ phase: e.context.phase, ms: e.context.phaseElapsedMs ?? -1 }));

    expect(phases.map((p) => p.phase)).toEqual([
      'sw-eval',
      'settings-ready',
      'hydration-done',
      'sync-init-done',
      'bridge-done',
      'interactive',
    ]);

    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].ms).toBeGreaterThanOrEqual(phases[i - 1].ms);
    }
  });
});
