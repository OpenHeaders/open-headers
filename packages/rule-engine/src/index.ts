/**
 * @openheaders/rule-engine — declarativeNetRequest compile pipeline +
 * content-script generation + scripting injection.
 *
 * Host-agnostic: every browser-API call goes through dependencies
 * injected by the host app at boot. The package owns the rule → DNR
 * compile path and the chrome.scripting injection path; the host owns
 * workspace state (which rules exist, which are paused, which are
 * under test) and feeds resolved rules into the engine.
 *
 * Use subpath imports:
 *
 *   import { compileRuleSet } from '@openheaders/rule-engine/compile'
 *   import { applyDynamicRules, type DnrClient } from '@openheaders/rule-engine/apply'
 *   import { applyInjection } from '@openheaders/rule-engine/inject'
 *   import { headerCompiler, type CompilerContext } from '@openheaders/rule-engine/builders'
 *   import type { Injection } from '@openheaders/rule-engine/content-scripts'
 *   import { isValidHeaderValue } from '@openheaders/rule-engine/rule-validator'
 *
 * The root barrel exports `CACHE_BYPASS_ID_BASE` — the only host-facing
 * contract the engine reserves on Chrome's DNR session-rule ID space.
 */
export { CACHE_BYPASS_ID_BASE } from './reserved-ids';
