/**
 * Renderer-side boot-regression verdict (Phase A T3 surfacing).
 *
 * Pulls the most-recent `boot.interactive` samples out of the
 * observability log, feeds them through the pure decision module
 * (`@openheaders/core/sync` → `boot-regression`), and exposes the
 * verdict so a status pill / footer callout can surface a regression
 * without coupling the gate to a presentation layer.
 *
 * The hook subscribes to `observabilityLogUpdated` so the verdict
 * refreshes on every cold wake (each wake produces a fresh `boot.
 * interactive` entry). Until the T1 baseline is measured (see
 * `boot-baseline.ts`), the verdict short-circuits to `regressed: false`
 * — `evaluateBootRegression` already guards on `baselineMs <= 0`.
 */

import {
  BOOT_BASELINE_MS,
  BOOT_REGRESSION_SAMPLE_WINDOW,
  type BootRegressionVerdict,
  evaluateBootRegression,
} from '@openheaders/core/sync';
import { useEffect, useState } from 'react';
import { call, subscribe } from '@utils/bridge';

const EMPTY_VERDICT: BootRegressionVerdict = { regressed: false, offending: [], ratios: [] };

interface UseBootRegressionResult {
  verdict: BootRegressionVerdict;
  /** True when the baseline isn't pinned yet — UI should suppress callouts. */
  baselinePending: boolean;
}

export function useBootRegression(): UseBootRegressionResult {
  const [verdict, setVerdict] = useState<BootRegressionVerdict>(EMPTY_VERDICT);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const resp = await call('getObservabilityLog');
        if (cancelled || !resp) return;
        const entries = resp.entries ?? [];
        const samples: number[] = [];
        // Walk newest → oldest to keep the most-recent samples; reverse
        // back into oldest-first for evaluateBootRegression's contract.
        for (let i = entries.length - 1; i >= 0; i--) {
          const e = entries[i];
          if (e.subsystem !== 'sync' || e.op !== 'boot.interactive') continue;
          const v = e.context.phaseElapsedMs;
          if (typeof v !== 'number') continue;
          samples.push(v);
          if (samples.length >= BOOT_REGRESSION_SAMPLE_WINDOW) break;
        }
        samples.reverse();
        setVerdict(
          evaluateBootRegression({ recentSamples: samples, baselineMs: BOOT_BASELINE_MS }),
        );
      } catch {
        // Bridge unavailable (renderer mid-bootstrap) — leave verdict
        // at the empty default; we'll re-fetch on the next broadcast.
      }
    };

    void refresh();
    const unsubscribe = subscribe('observabilityLogUpdated', () => void refresh());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { verdict, baselinePending: BOOT_BASELINE_MS <= 0 };
}
