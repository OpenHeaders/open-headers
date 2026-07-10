/**
 * Daemon boot spine — public surface of the host-neutral back-end core.
 *
 * Hosts (desktop main, standalone daemon shell) import `bootDaemonSpine`
 * and inject their host-specific edges through {@link DaemonSpineConfig};
 * everything below it (bind supervisor, forwarder, activity/observability
 * installers, live runner) is spine-internal wiring.
 */

export { bootDaemonSpine, type DaemonSpineConfig, type DaemonSpineHandle } from './boot-spine';
export type { DaemonMetrics } from './metrics';
export type { DaemonOidcConfig } from './oidc/oidc-config';
export type { SpineStatusReport, SpineStatusReporter, SpineStatusStore } from './status-seam';
