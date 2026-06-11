/**
 * `@openheaders/oracle/rule-fire-hub` — host-neutral per-tab broadcaster
 * of rule fire observations. Engine ingests via `notifyHeuristicFire` /
 * `notifyAuthoritativeFire` (exact-key) or
 * `notifyAuthoritativeFireTranslated` (cross-id-space tabs); consumers
 * attach a `Sink` to receive the tab's ordered replay + live merged-fire
 * updates.
 */

export { RuleFireHub } from './hub';
export { TRANSLATION_WINDOW_MS } from './translation';
export type { Sink } from './types';
