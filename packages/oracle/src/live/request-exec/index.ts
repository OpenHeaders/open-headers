/**
 * Host-neutral request executor for Live Workflow chain steps.
 *
 * The engine resolves + executes a step's request; the host provides
 * only a {@link RequestTransport} (its local network capability) and,
 * optionally, an OAuth-refresh hook and a per-step request decorator.
 * The browser SW and the desktop main process run this exact code.
 */

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
  type ChainScript,
  collectAncestorScripts,
  collectScriptChain,
  type PostChainRunResult,
  type PreChainRunResult,
  type RequestScriptChain,
  runPostResponseChain,
  runPreRequestChain,
} from './script-chain';
export {
  applyScriptMutation,
  firstFailedAssertion,
  resolvedToScriptSnapshot,
  type StepScriptInput,
  type StepScriptRunner,
} from './script-hooks';
export {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportMultipartPart,
  type TransportRequest,
  type TransportResponse,
} from './transport';
