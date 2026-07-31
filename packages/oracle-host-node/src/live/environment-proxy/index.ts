export { createEnvProxyResolver } from './env-proxy-resolver';
export { createManualProxyResolver, type ManualProxyConfig } from './manual-resolver';
export { isBypassedByNoProxy } from './no-proxy';
export { parsePacProxyList } from './pac-result';
export { parseProxyValue } from './proxy-value';
export { environmentProxyResolver, registerEnvironmentProxyResolver, resetEnvironmentProxyResolver } from './registry';
export {
  isSessionProxyDialFailure,
  PROXY_DIAL_FAILURE_CODES,
  resolveSessionProxyAttempts,
  type SessionDialCapability,
  type SessionProxyAttempt,
  type SessionProxyRoute,
  type SessionRouteRequest,
  type SessionRouteResult,
} from './session-route';
export type {
  EnvironmentProxyEntry,
  EnvironmentProxyResolver,
  EnvironmentProxySelection,
  EnvironmentProxySource,
} from './types';
