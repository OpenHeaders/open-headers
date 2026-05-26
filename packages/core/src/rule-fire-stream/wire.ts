/**
 * Wire envelope + port-name format for the rule fire stream.
 *
 * Sibling of `@openheaders/core/request-lifecycle/wire.ts` and
 * `@openheaders/core/page-stream/wire.ts`. Engine (`@openheaders/oracle`)
 * and consumer (`@openheaders/ui`) agree on this envelope without either
 * importing the other.
 *
 * `'ready'` is the handshake-then-replay marker. `'fire-update'` carries
 * every `RuleFireUpdate` variant.
 */

import type { RuleFireUpdate } from './types';

export type RuleFireWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'fire-update'; update: RuleFireUpdate };

/** Channel-name prefix for the per-tab rule-fire pipe. */
export const RULE_FIRE_PORT_PREFIX = 'oh-fires:';

/** Parse `oh-fires:<tabId>`. Returns `null` for any other shape. */
export function parseRuleFirePortName(name: string): number | null {
  if (!name.startsWith(RULE_FIRE_PORT_PREFIX)) return null;
  const parsed = Number.parseInt(name.slice(RULE_FIRE_PORT_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function ruleFirePortName(tabId: number): string {
  return `${RULE_FIRE_PORT_PREFIX}${tabId}`;
}
