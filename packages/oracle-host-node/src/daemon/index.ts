/**
 * Daemon boot spine — public surface of the host-neutral back-end core.
 *
 * Hosts (desktop main, standalone daemon shell) import `bootDaemonSpine`
 * and inject their host-specific edges through {@link DaemonSpineConfig};
 * everything below it (bind supervisor, forwarder, activity/observability
 * installers, live runner) is spine-internal wiring.
 */

export type { DaemonAuditForwardingConfig } from './audit-forwarder';
export { bootDaemonSpine, type DaemonSpineConfig, type DaemonSpineHandle } from './boot-spine';
export { registerPeerRpcPlane } from './compose-peer-rpc';
export { type ExecuteRequestRpcResult, handleExecuteRequestRpc } from './execute-request-rpc';
export type { DaemonMetrics } from './metrics';
export type { DaemonOidcConfig, OidcClaimMappingRule, OidcClaimMappings } from './oidc/oidc-config';
export {
  createScriptBroker,
  type RunScriptOptions,
  type SandboxTransport,
  type ScriptBroker,
  type ScriptBrokerDeps,
  type ScriptHostRequestHandler,
} from './script-broker';
export {
  type HostScriptCapabilities,
  type HostScriptCapability,
  type HostScriptRunOptions,
  setHostScriptCapabilities,
} from './script-capability';
export { handleScriptHostRequest } from './script-host-rpc';
export type { SpineStatusReport, SpineStatusReporter, SpineStatusStore } from './status-seam';
