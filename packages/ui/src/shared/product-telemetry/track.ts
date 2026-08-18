/**
 * UI-side product-telemetry entry point (the telemetry plan §7) — the
 * one way a surface records a vocabulary event. Fire-and-forget over
 * the host bridge: surfaces never construct a client, never wait on
 * the RPC, and never observe a failure. Hosts other than extension and
 * desktop have no channel (daemon-served web is hard-off), so the call
 * is a no-op there.
 *
 * Once-per-session semantics for `feature_used` / `error_beacon` live
 * in the host controller's session latch; `noteFeatureUsed` only adds
 * a per-document guard so repeat gestures don't re-fire the RPC.
 */

import { getHostBridge } from '@openheaders/core/bridge';
import type { TelemetryEvent, TelemetryFeatureId, TelemetryMonetizationSurface } from '@openheaders/core/telemetry';
import { getCurrentHost } from '../host-vocabulary';

export function trackProductTelemetryEvent(event: TelemetryEvent): void {
  const host = getCurrentHost();
  if (host !== 'extension' && host !== 'desktop') return;
  const bridge = getHostBridge();
  if (!bridge) return;
  void bridge.call('productTelemetryTrack', { event }).catch(() => undefined);
}

const notedFeatures = new Set<TelemetryFeatureId>();

/** Record the first meaningful use of a surface; repeats in this document are dropped before the RPC. */
export function noteFeatureUsed(feature: TelemetryFeatureId): void {
  if (notedFeatures.has(feature)) return;
  notedFeatures.add(feature);
  trackProductTelemetryEvent({ name: 'feature_used', feature });
}

const notedCtaSurfaces = new Set<TelemetryMonetizationSurface>();

/** Record an upgrade-CTA impression (monetization funnel, S22); repeats in this document are dropped before the RPC. */
export function noteUpgradeCtaShown(surface: TelemetryMonetizationSurface): void {
  if (notedCtaSurfaces.has(surface)) return;
  notedCtaSurfaces.add(surface);
  trackProductTelemetryEvent({ name: 'upgrade_cta_shown', surface });
}

/** Test-only — clears the per-document feature and CTA-impression guards. */
export function __resetProductTelemetryTrackForTests(): void {
  notedFeatures.clear();
  notedCtaSurfaces.clear();
}
