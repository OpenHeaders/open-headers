/**
 * `@openheaders/oracle/rule-fire-hub` — host-neutral per-tab broadcaster
 * of rule fire observations. Engine ingests via `notifyHeuristicFire` /
 * `notifyAuthoritativeFire`; consumers attach a `Sink` to receive the
 * tab's ordered replay + live merged-fire updates.
 */

export { tabIdOf } from './filter';
export { RuleFireHub } from './hub';
export type { RuleFireHubOptions } from './hub';
export { MAX_FIRES_PER_TAB, RuleFireStore } from './store';
export { snapshotToUpdates } from './replay';
export type { AttachmentHandle, Sink } from './types';
export {
  RULE_FIRE_PORT_PREFIX,
  parseRuleFirePortName,
  ruleFirePortName,
} from '@openheaders/core/rule-fire-stream';
export type { RuleFireWireMessage } from '@openheaders/core/rule-fire-stream';
