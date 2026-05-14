/**
 * Compatibility re-export — `PerfResourceEntry` is now a core domain
 * type (`@openheaders/core/types`) because it is a host-bridge wire
 * payload. This shim keeps the `@/types/perf` path working until the
 * E.3 codemod sweep repoints consumers at core directly.
 */

export type { PerfResourceEntry } from '@openheaders/core/types';
