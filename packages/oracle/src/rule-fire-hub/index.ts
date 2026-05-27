/**
 * `@openheaders/oracle/rule-fire-hub` — host-neutral per-tab broadcaster
 * of rule fire observations. Engine ingests via `notifyHeuristicFire` /
 * `notifyAuthoritativeFire`; consumers attach a `Sink` to receive the
 * tab's ordered replay + live merged-fire updates.
 */

export { RuleFireHub } from './hub';
export type { Sink } from './types';
