/**
 * Header compiler — converts V5.HeaderRule into a CompilationPlan.
 *
 * Header rules are the most versatile: a single rule can combine DNR
 * modifyHeaders operations (set/append/remove) with scriptable merge
 * operations that can't be expressed as DNR modifyHeaders.
 *
 *   - set / append / remove → `modifyHeaders` DNR rules. One DNR rule per
 *     domain, split into a main_frame (priority 1000) + sub-resources
 *     (priority 950) pair for response modifications so both coverage
 *     classes are explicit.
 *   - merge → an injected content script that monkey-patches fetch/XHR
 *     and calls `setRequestHeader(name, existing + sep + newValue)` for
 *     matched requests. Necessary because DNR has no "merge" operation.
 *
 * Both outputs can coexist for a single V5 rule with mixed operations.
 */

import type { V5 } from '@openheaders/core/types';
import { formatUrlPattern, getHeaderOperationCapability } from '@openheaders/core/utils';
import { validateHeaderName } from '@utils/header-validator';
import { logger } from '@utils/logger';
import { normalizeHeaderName } from '@utils/utils';
import { get as getSetting } from '@/rules/settings/store';
import { isValidHeaderValue, sanitizeHeaderValue } from '../rule-validator';
import type {
  CompilationPlan,
  CompilerContext,
  DnrCondition,
  DnrHeaderModification,
  DnrRule,
  RuleCompiler,
} from './types';
import {
  ALL_RESOURCE_TYPES,
  buildDnrCondition,
  resolveResourceTypes,
  SUB_RESOURCE_TYPES,
  stripResourceTypeFields,
} from './types';

const MAIN_FRAME_ONLY: chrome.declarativeNetRequest.ResourceType[] = [
  'main_frame' as chrome.declarativeNetRequest.ResourceType,
];

export const headerCompiler: RuleCompiler<V5.HeaderRule> = {
  ruleType: 'header',
  compile(rule: V5.HeaderRule, ctx: CompilerContext): CompilationPlan {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

    if (domains.length === 0 && !urlPattern) {
      logger.debug('HeaderCompiler', `Skipping rule "${rule.name}" — no matching conditions`);
      return {};
    }

    // ── DNR header modifications (set/append/remove) ────────────────
    //
    // Merge operations are deliberately NOT handled here — they're run by
    // inject-manager as a scriptable monkey-patch because DNR has no
    // "merge" operation. inject-manager reads the rule directly from the
    // store and installs the merge injection on each main-frame commit.

    const reqMods: DnrHeaderModification[] = [];
    const resMods: DnrHeaderModification[] = [];

    for (const mod of rule.action.requestHeaders ?? []) {
      if (mod.operation === 'merge') continue; // handled by scriptable path above
      const built = buildMod(mod, false, rule.name);
      if (built) reqMods.push(built);
    }
    for (const mod of rule.action.responseHeaders ?? []) {
      if (mod.operation === 'merge') continue; // handled by scriptable path above
      const built = buildMod(mod, true, rule.name);
      if (built) resMods.push(built);
    }

    if (reqMods.length === 0 && resMods.length === 0) {
      return {};
    }

    // ── Live Rules Mode (Layer 1 cache-freshness) ───────────────────
    // For any rule that touches headers (request or response), ensure the
    // request bypasses the HTTP cache so the rule's effect is visible on
    // every fire — not just on the first load. Non-matched requests are
    // untouched; only rules the user explicitly wrote revalidate. Scope:
    //
    //   - Precedence: if the user's rule already targets `Cache-Control`
    //     in ANY way (set/append/remove), skip injection entirely — their
    //     intent wins.
    //   - Ordering: prepend via `unshift` so DNR's last-write-wins on
    //     same-header applies the user's subsequent action naturally.
    //     Defensive ordering beats re-checking on every future edit.
    //   - Trigger: reqMods OR resMods. A response-header rule also needs
    //     Cache-Control on the request; otherwise the cached response
    //     reuse would hide the response modification.
    //   - Toggle: `rulesEngine.liveRulesMode` (default on). Advanced users
    //     can opt out.
    if (getSetting('rulesEngine.liveRulesMode')) {
      const userTouchesCacheControl = reqMods.some((m) => m.header.toLowerCase() === 'cache-control');
      if (!userTouchesCacheControl) {
        reqMods.unshift(
          { header: 'Cache-Control', operation: 'set', value: 'no-cache' },
          { header: 'Pragma', operation: 'set', value: 'no-cache' },
        );
      }
    }

    const dnrRules: DnrRule[] = [];

    // Each emitted DNR rule below has its own capability set (the resource
    // types that variant can act on). resolveResourceTypes folds the user's
    // resource-type filters with that capability and produces the final list,
    // returning null if nothing survives — in which case we just skip that
    // variant. The base condition is stripped of its raw resource-type fields
    // exactly once below so they can never leak through a `...base` spread.

    const userInclude = base.resourceTypes;
    const userExclude = base.excludedResourceTypes;
    const cleanBase = stripResourceTypeFields(base);

    const requestResolved = resolveResourceTypes(ALL_RESOURCE_TYPES, userInclude, userExclude);
    const mainFrameResolved = resolveResourceTypes(MAIN_FRAME_ONLY, userInclude, userExclude);
    const subResourceResolved = resolveResourceTypes(SUB_RESOURCE_TYPES, userInclude, userExclude);

    const pushForCondition = (condition: DnrCondition) => {
      // Request-only modifications — single DNR rule covering all resource types.
      if (reqMods.length > 0 && resMods.length === 0 && requestResolved) {
        dnrRules.push({
          id: ctx.allocateId(),
          priority: 100,
          action: { type: 'modifyHeaders', requestHeaders: reqMods },
          condition: { ...condition, resourceTypes: requestResolved },
        });
      }

      // Response-only modifications — main_frame high priority + sub-resources.
      if (resMods.length > 0 && reqMods.length === 0) {
        if (mainFrameResolved) {
          dnrRules.push({
            id: ctx.allocateId(),
            priority: 1000,
            action: { type: 'modifyHeaders', responseHeaders: resMods },
            condition: { ...condition, resourceTypes: mainFrameResolved },
          });
        }
        if (subResourceResolved) {
          dnrRules.push({
            id: ctx.allocateId(),
            priority: 950,
            action: { type: 'modifyHeaders', responseHeaders: resMods },
            condition: { ...condition, resourceTypes: subResourceResolved },
          });
        }
      }

      // Combined request + response modifications — same split for response coverage.
      if (reqMods.length > 0 && resMods.length > 0) {
        if (mainFrameResolved) {
          dnrRules.push({
            id: ctx.allocateId(),
            priority: 1000,
            action: { type: 'modifyHeaders', requestHeaders: reqMods, responseHeaders: resMods },
            condition: { ...condition, resourceTypes: mainFrameResolved },
          });
        }
        if (subResourceResolved) {
          dnrRules.push({
            id: ctx.allocateId(),
            priority: 950,
            action: { type: 'modifyHeaders', requestHeaders: reqMods, responseHeaders: resMods },
            condition: { ...condition, resourceTypes: subResourceResolved },
          });
        }
      }
    };

    if (urlPattern) {
      const condition: DnrCondition = { ...cleanBase };
      if (useRegex) condition.regexFilter = urlPattern;
      else condition.urlFilter = urlPattern;
      pushForCondition(condition);
    } else {
      for (const domain of domains) {
        pushForCondition({ ...cleanBase, urlFilter: formatUrlPattern(domain) });
      }
    }

    if (dnrRules.length === 0) {
      logger.debug('HeaderCompiler', `Skipping rule "${rule.name}" — resource-type filter excludes everything`);
      return {};
    }

    return { dynamicRules: dnrRules };
  },
};

function buildMod(mod: V5.HeaderModification, isResponse: boolean, ruleName: string): DnrHeaderModification | null {
  const validation = validateHeaderName(mod.headerName, isResponse);
  if (!validation.valid) {
    logger.debug('HeaderCompiler', `Skipping header "${mod.headerName}" in "${ruleName}" — ${validation.message}`);
    return null;
  }

  const headerName = validation.sanitized || normalizeHeaderName(mod.headerName);

  // Defensive capability check. `isRuleComplete` already gates rules with
  // invalid combinations (append on a non-allowlisted header, etc.) and the
  // dnr-manager skips them entirely — this second check exists so that a
  // direct programmatic rule-store write (bypassing the editor) can't put
  // Chrome into a rejected-batch state.
  const direction = isResponse ? 'response' : 'request';
  const capability = getHeaderOperationCapability(direction, mod.operation, headerName);
  if (!capability.allowed) {
    logger.debug(
      'HeaderCompiler',
      `Skipping "${mod.operation}" on "${headerName}" in "${ruleName}" — ${capability.reason}`,
    );
    return null;
  }

  if (mod.operation === 'remove') {
    return { header: headerName, operation: 'remove' };
  }

  const rawValue = mod.value ?? '';
  if (!rawValue.trim()) {
    logger.debug('HeaderCompiler', `Skipping header "${mod.headerName}" in "${ruleName}" — empty value`);
    return null;
  }

  let headerValue = rawValue;
  if (!isValidHeaderValue(headerValue, headerName)) {
    headerValue = sanitizeHeaderValue(headerValue);
    if (!isValidHeaderValue(headerValue, headerName)) {
      logger.debug('HeaderCompiler', `Skipping header "${mod.headerName}" in "${ruleName}" — invalid value`);
      return null;
    }
  }

  const dnrOp = mod.operation === 'add' ? 'append' : 'set';
  return { header: headerName, operation: dnrOp, value: headerValue };
}
