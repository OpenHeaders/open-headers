/**
 * Host-neutral request executor for Live Workflow chain steps.
 *
 * The engine resolves + executes a step's request; the host provides
 * only a {@link RequestTransport} (its local network capability) and,
 * optionally, an OAuth-refresh hook and a per-step request decorator.
 * The browser SW and the desktop main process run this exact code.
 */

export {
  type AncestorCarrier,
  type AncestorCarrierEntity,
  collectAncestorCarriers,
  collectionUidForRequest,
  type ResolvedRequestAuth,
  type ResolvedSessionAuth,
  resolveRequestAuth,
  resolveSessionAuth,
  type SessionAuthLeaf,
} from './ancestor-chain';
export { buildChainFetchAdapter, type ChainFetchAdapterOptions } from './chain-adapter';
export { errorSnapshot, executeOverTransport } from './execute';
export {
  buildResolvedBody,
  defaultContentType,
  type OAuthRefreshFn,
  type ResolvedRequest,
  type ResolvedRequestOutcome,
  type ResolveRequestOptions,
  resolveRequest,
  type TotpUsage,
  UnresolvedRequestError,
} from './resolve-request';
export { buildResolver, type ResolverContext } from './resolver-scope';
export { type RunInteractiveSendOptions, runInteractiveSend } from './run-interactive-send';
export { type RunStepRequestOptions, runStepRequest } from './run-step-request';
export {
  type ChainFold,
  type ChainScript,
  collectAncestorScripts,
  collectScriptChain,
  collectSlotChain,
  composeSlotChain,
  type PostChainRunResult,
  type PreChainRunResult,
  type RequestScriptChain,
  type RunChainOptions,
  runPostResponseChain,
  runPreRequestChain,
  runScriptChain,
  type SlotChainCarrier,
  type SlotChainLeaf,
} from './script-chain';
export {
  applyScriptMutation,
  firstFailedAssertion,
  parseUrlParams,
  replaceUrlParams,
  resolvedToScriptSnapshot,
  type SessionScriptHost,
  type SessionScriptInput,
  type StepScriptInput,
  type StepScriptRunner,
} from './script-hooks';
export {
  createSessionScriptPlaneCore,
  hasSessionScriptChains,
  MAX_SESSION_SCRIPT_MARKS,
  type SessionLevelHandler,
  type SessionScriptChains,
  type SessionScriptMarkOf,
  type SessionScriptPlaneCore,
  type SessionScriptPlaneDeps,
} from './session-script-plane';
export {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportMultipartPart,
  type TransportRequest,
  type TransportResponse,
} from './transport';
