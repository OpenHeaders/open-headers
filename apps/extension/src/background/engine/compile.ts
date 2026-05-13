/**
 * Rule-engine compile pipeline — pure function from already-resolved
 * rules to DNR rules + scriptable passthroughs.
 *
 * No side effects, no chrome.* calls, no workspace-state reads. The
 * orchestrator (`dnr-manager.ts`) does all of the workspace-state
 * coordination (variable resolution, pause markers, test-run scopes)
 * and feeds resolved rules in.
 *
 * This file is the future `@openheaders/rule-engine/compile` entry —
 * kept inside `apps/extension/src/background/engine/` during the
 * in-place refactor so the move in Phase E.1's second pass is a plain
 * `git mv` with no codemod.
 */

import type { Rule } from '@openheaders/core/types';
import { isRuleEffective, type PauseMarkers } from '@openheaders/core/utils';
import type { CompilationPlan, CompilerContext, DnrRule, RuleCompiler } from '../dnr-builders';
import {
  blockCompiler,
  delayCompiler,
  headerCompiler,
  injectCompiler,
  queryParamCompiler,
  redirectCompiler,
} from '../dnr-builders';

/**
 * Single source of truth for "how does each rule type become DNR rules?".
 * Adding a rule type means writing a compiler and registering it here —
 * nothing else needs to know.
 */
const compilers: Record<string, RuleCompiler<Rule>> = {
  block: blockCompiler as RuleCompiler<Rule>,
  delay: delayCompiler as RuleCompiler<Rule>,
  header: headerCompiler as RuleCompiler<Rule>,
  inject: injectCompiler as RuleCompiler<Rule>,
  'query-param': queryParamCompiler as RuleCompiler<Rule>,
  redirect: redirectCompiler as RuleCompiler<Rule>,
};

/** Rule types whose scriptable side is handled by inject-manager. */
export const SCRIPTABLE_TYPES: ReadonlySet<Rule['type']> = new Set(['inject', 'delay', 'body', 'mock', 'header']);

export interface TaggedDnrRule {
  rule: DnrRule;
  uid: string;
}

export interface CompileResult {
  dynamic: TaggedDnrRule[];
  session: TaggedDnrRule[];
  scriptables: Rule[];
}

/**
 * Compile every effective rule into DNR rules plus a scriptable passthrough
 * for inject-manager. Returns TAGGED rules (with their source uid) so
 * callers can build id→uid maps for telemetry lookups.
 *
 * Callers must pass already-resolved rules — `{{VAR}}` templates should be
 * substituted upstream so the engine sees concrete strings.
 */
export function compileRuleSet(rules: Rule[], pauseMarkers: PauseMarkers, startId: number): CompileResult {
  const dynamic: TaggedDnrRule[] = [];
  const session: TaggedDnrRule[] = [];
  const scriptables: Rule[] = [];

  let nextId = startId;
  const ctx: CompilerContext = { allocateId: () => nextId++ };

  for (const rule of rules) {
    // `compileRuleSet` only runs when the engine is NOT globally paused
    // (checked upstream in the orchestrator), so we pass `false` for
    // `enginePaused` here.
    if (!isRuleEffective(rule, pauseMarkers, false)) continue;

    // inject-manager wants every rule that has any in-page side effect,
    // regardless of whether it ALSO produces DNR rules. Passed by value.
    if (SCRIPTABLE_TYPES.has(rule.type)) {
      scriptables.push(rule);
    }

    const compiler = compilers[rule.type];
    if (!compiler) continue;
    const plan: CompilationPlan = compiler.compile(rule, ctx);
    for (const dr of plan.dynamicRules ?? []) dynamic.push({ rule: dr, uid: rule.uid });
    for (const sr of plan.sessionRules ?? []) session.push({ rule: sr, uid: rule.uid });
  }

  return { dynamic, session, scriptables };
}
