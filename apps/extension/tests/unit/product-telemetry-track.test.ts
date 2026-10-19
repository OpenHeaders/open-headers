/**
 * UI-side product-telemetry entry point (the telemetry plan §7).
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
  noteUpgradeCtaShown,
  noteViewportSeen,
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

describe('noteViewportSeen', () => {
  it('floors the viewport onto the coarse grammar before the RPC and fires once per surface per document', () => {
    const call = installBridge();
    noteViewportSeen('workbench', 1366, 768);
    noteViewportSeen('workbench', 1920, 1080);
    noteViewportSeen('sidepanel', 352, 900);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(1, 'productTelemetryTrack', {
      event: { name: 'viewport_seen', surface: 'workbench', width: 1280, height: 600 },
    });
    expect(call).toHaveBeenNthCalledWith(2, 'productTelemetryTrack', {
      event: { name: 'viewport_seen', surface: 'sidepanel', width: 0, height: 800 },
    });
  });
});

describe('noteUpgradeCtaShown', () => {
  it('fires one RPC per surface per document, host latch owns the session dedupe', () => {
    const call = installBridge();
    noteUpgradeCtaShown('license-pane');
    noteUpgradeCtaShown('license-pane');
    noteUpgradeCtaShown('seat-gate');
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(1, 'productTelemetryTrack', {
      event: { name: 'upgrade_cta_shown', surface: 'license-pane' },
    });
    expect(call).toHaveBeenNthCalledWith(2, 'productTelemetryTrack', {
      event: { name: 'upgrade_cta_shown', surface: 'seat-gate' },
    });
  });
});
