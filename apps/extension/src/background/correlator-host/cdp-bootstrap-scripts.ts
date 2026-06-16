/**
 * Compile the residual in-page wrappers of in-scope rules into CDP document-
 * bootstrap scripts (Phase E1b) — the delivery-precedence twin of
 * {@link compileFetchPatterns}'s network realization.
 *
 * `compileFetchPatterns` turns the Fetch-realizable rules into `Fetch.enable`
 * patterns (the modification plane); this turns the COMPLEMENT — the wrappers
 * that stay in-page under D4a, gated by {@link isBootstrapEligible} — into
 * `Page.addScriptToEvaluateOnNewDocument` sources so they install BEFORE any
 * page script instead of racing the page on `webNavigation.onCommitted`.
 *
 * Pure and host-neutral in spirit, but typed against the oracle
 * {@link CdpBootstrapScript} — so it lives in the host, not
 * `@openheaders/rule-engine` (which cannot reference oracle types). The host is
 * the meeting point of core, rule-engine, and oracle: it reuses the SAME
 * `build*Injection` wrappers `inject-manager` applies, then renders each to a
 * source string the bootstrap channel can carry.
 *
 * The output is consumed by `reconcileTabControl` (E1a), which diffs it by the
 * stable `key`; a rule edit changes a wrapper's `source`, so its key re-adds
 * (remove-then-add) while the others are untouched.
 */

import type { Rule } from '@openheaders/core/types';
import { compileRuleForInjection, isBootstrapEligible } from '@openheaders/core/utils';
import type { CdpBootstrapScript } from '@openheaders/oracle/correlator-cdp';
import {
  buildDelayInjection,
  buildHeaderMergeInjection,
  buildRequestBodyInjection,
  buildResponseInjection,
  buildSetupInjection,
  buildSseInjection,
  buildWsInjection,
  extractHeaderMerges,
  type Injection,
} from '@openheaders/rule-engine/content-scripts';

/** Stable key for the always-first setup capture. */
const SETUP_KEY = 'oh-setup';

/**
 * Render an {@link Injection} as a bootstrap `source` string that runs the
 * SAME wrapper the `onCommitted` path would, but via
 * `Page.addScriptToEvaluateOnNewDocument`.
 */
export function injectionToSource(injection: Injection): string {
  if (injection.kind === 'func') {
    // Mirror `chrome.scripting.executeScript({func, args, world:'MAIN'})`: the
    // func is serialized via `Function.prototype.toString` and invoked with its
    // single config arg. The bootstrap source runs in the page's MAIN world
    // before any page script — the same world `executeScript` targets — so the
    // wrapper's `window.fetch` patch lands identically.
    return `(${injection.func.toString()})(${JSON.stringify(injection.args[0])});`;
  }
  // An inline-script injection is already a self-contained IIFE. Running it as a
  // bootstrap source executes it directly in the MAIN world (no `<script>` tag,
  // so it is CSP-safe — strictly better than the `onCommitted` inline path).
  return injection.code;
}

/**
 * The wrapper {@link Injection} for one bootstrap-eligible rule, or `null` when
 * it carries no installable wrapper. A wrapper with no compiled URL pattern
 * matches nothing in-page (the `onCommitted` path's `shouldInstallForPage`
 * skips it for the same reason), so it produces no bootstrap script.
 */
function bootstrapInjectionFor(rule: Rule): Injection | null {
  if (rule.type === 'header') {
    const merges = extractHeaderMerges(rule);
    if (merges === null) return null;
    const regexSources = compileRuleForInjection(rule);
    if (regexSources.length === 0) return null;
    return buildHeaderMergeInjection(rule.uid, regexSources, merges.requestMerges, merges.responseMerges);
  }
  if (compileRuleForInjection(rule).length === 0) return null;
  switch (rule.type) {
    case 'delay':
      return buildDelayInjection(rule);
    case 'request-body':
      return buildRequestBodyInjection(rule);
    case 'response':
      return buildResponseInjection(rule);
    case 'ws':
      return buildWsInjection(rule);
    case 'sse':
      return buildSseInjection(rule);
    default:
      return null;
  }
}

/**
 * The CDP bootstrap scripts for the residual ({@link isBootstrapEligible})
 * wrappers among `rules`. Each rule's wrapper renders to a `{key, source}`
 * keyed `<type>:<uid>` (stable across re-derive); `oh-setup` is prepended so it
 * captures the page's pristine fetch/XHR/socket references BEFORE any wrapper
 * patches them (bootstrap scripts run in add-order on every new document).
 * Returns `[]` when no rule contributes a wrapper — no setup with nothing to
 * set up — so a tab with only network-realized rules carries no bootstrap.
 */
export function compileBootstrapScripts(rules: readonly Rule[]): CdpBootstrapScript[] {
  const scripts: CdpBootstrapScript[] = [];
  for (const rule of rules) {
    if (!isBootstrapEligible(rule)) continue;
    const injection = bootstrapInjectionFor(rule);
    if (injection === null) continue;
    scripts.push({ key: `${rule.type}:${rule.uid}`, source: injectionToSource(injection) });
  }
  if (scripts.length === 0) return [];
  return [{ key: SETUP_KEY, source: injectionToSource(buildSetupInjection()) }, ...scripts];
}
