/**
 * UI-side product-telemetry entry point (`TELEMETRY_PLAN.md` §7).
 * Pins the call-site contracts:
 *   - events travel as one fire-and-forget `productTelemetryTrack` RPC;
 *   - non-counting hosts (daemon-served web) and a missing bridge are
 *     silent no-ops;
 *   - a rejecting bridge never surfaces to the caller;
 *   - `noteFeatureUsed` fires one RPC per feature per document.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import {
  __resetProductTelemetryTrackForTests,
  noteFeatureUsed,
  trackProductTelemetryEvent,
} from '@openheaders/ui/shared/product-telemetry';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function installBridge(call = vi.fn(async () => ({ success: true }))) {
  setHostBridge({ call } as unknown as HostBridge);
  return call;
}

beforeEach(() => {
  __resetProductTelemetryTrackForTests();
  setCurrentHost('extension');
});

describe('trackProductTelemetryEvent', () => {
  it('forwards the event over the productTelemetryTrack RPC', () => {
    const call = installBridge();
    trackProductTelemetryEvent({ name: 'rule_created', ruleType: 'header' });
    expect(call).toHaveBeenCalledWith('productTelemetryTrack', {
      event: { name: 'rule_created', ruleType: 'header' },
    });
  });

  it('is a no-op on a daemon-served web workbench', () => {
    const call = installBridge();
    setCurrentHost('web');
    trackProductTelemetryEvent({ name: 'workflow_run', ok: true });
    expect(call).not.toHaveBeenCalled();
  });

  it('swallows a rejecting bridge', async () => {
    installBridge(vi.fn(async () => Promise.reject(new Error('gone'))));
    expect(() => trackProductTelemetryEvent({ name: 'import_run', source: 'curl', ok: false })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('noteFeatureUsed', () => {
  it('fires one RPC per feature per document, host latch owns the session dedupe', () => {
    const call = installBridge();
    noteFeatureUsed('vault');
    noteFeatureUsed('vault');
    noteFeatureUsed('variables');
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(1, 'productTelemetryTrack', {
      event: { name: 'feature_used', feature: 'vault' },
    });
    expect(call).toHaveBeenNthCalledWith(2, 'productTelemetryTrack', {
      event: { name: 'feature_used', feature: 'variables' },
    });
  });
});
