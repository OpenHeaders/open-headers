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
import {
  bucketViewportHeight,
  bucketViewportWidth,
  type TelemetryEvent,
  type TelemetryFeatureId,
  type TelemetryMonetizationSurface,
  type TelemetryViewportSurface,
} from '@openheaders/core/telemetry';
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

const notedViewports = new Set<TelemetryViewportSurface>();

/**
 * Record a surface's size class once per document (S35): the CSS-pixel
 * viewport floors onto the coarse grammar before it leaves this realm,
 * so an exact size never reaches the RPC. The host latch dedupes per
 * surface per session; a resize later in the document is not a new fact.
 */
export function noteViewportSeen(surface: TelemetryViewportSurface, width: number, height: number): void {
  if (notedViewports.has(surface)) return;
  notedViewports.add(surface);
  trackProductTelemetryEvent({
    name: 'viewport_seen',
    surface,
    width: bucketViewportWidth(width),
    height: bucketViewportHeight(height),
  });
}

/** Test-only — clears the per-document feature, CTA-impression and viewport guards. */
export function __resetProductTelemetryTrackForTests(): void {
  notedFeatures.clear();
  notedCtaSurfaces.clear();
  notedViewports.clear();
}
