/**
 * Content-script generators for rules that can't use declarativeNetRequest.
 *
 * Two injection strategies coexist:
 *
 *   1. Real-function injection (static delay/request-body/response/
 *      header-merge, ws, sse) — `{func, args}` passed straight to
 *      `chrome.scripting.executeScript({world:'MAIN'})`. The func runs in the
 *      page MAIN world with extension privilege WITHOUT an inline <script> tag,
 *      so it is not subject to the page's CSP. Self-contained: serialized via
 *      `Function.prototype.toString` and re-parsed in the page, so its inline
 *      `matches`/`matchesGraphQL`/`fire` helpers are duplicated by necessity,
 *      not accident — they cannot reference module scope.
 *
 *   2. Inline-script injection (dynamic request-body/response) — a string of
 *      JavaScript wrapped in a page-side <script> tag (or a CDP bootstrap
 *      source). Needed because these embed user-authored JS. CSP-bound on the
 *      onCommitted path; CSP-safe as a bootstrap source.
 *
 * URL matching inside every injected func is driven by regex sources compiled
 * by `@openheaders/core/utils::compileRuleForInjection` — Chrome urlFilter
 * semantics live in ONE place (core's rule-matcher), never a hand-rolled glob.
 *
 * On match, each generator reports a fire through the ONE dispatcher `oh-setup`
 * installs at `window.__ohOrig.fire` ({@link ./setup}): a CDP-attached tab
 * exposes a private `Runtime.addBinding` global (captured by oh-setup), so the
 * fire reaches the debugger invisibly to the page; otherwise it falls back to
 * `window.postMessage({__ohFire:true,...})`, which the always-on ISOLATED
 * fire-bridge content script relays to the background tab-telemetry service.
 *
 * This barrel is the `@openheaders/rule-engine/content-scripts` public surface;
 * the per-family modules + shared `types`/`inline-helpers` are internal.
 */

export type { FuncInjection, Injection, InlineScriptInjection } from '../builders/types';
export { buildDelayInjection } from './delay';
export { buildHeaderMergeInjection, extractHeaderMerges } from './header-merge';
export { buildRequestBodyInjection } from './request-body';
export { buildResponseInjection } from './response';
export { buildResetInjection, buildSetupInjection, OH_BINDING } from './setup';
export { buildSseInjection } from './sse';
export { compileTerminalBlockSources } from './terminal-shadow';
export { buildWsInjection } from './ws';
