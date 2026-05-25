/**
 * `@openheaders/oracle/request-lifecycle-store` — engine-side store for
 * request lifecycles. See `docs/REQUEST_LIFECYCLE_DESIGN.md` §8.
 */

export { DEFAULT_MAX_LIFECYCLES_PER_TAB } from './config';
export { reduce } from './reducer';
export type { ReducerRejection, ReducerResult } from './reducer';
export { RequestLifecycleStore } from './store';
export type { RequestLifecycleStoreOptions } from './store';
export { TabLifecycles } from './tab-lifecycles';
export type { SetResult } from './tab-lifecycles';
