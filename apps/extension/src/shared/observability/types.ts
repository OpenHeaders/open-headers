/**
 * Re-export shim. The canonical definitions live in
 * `@openheaders/core/types/observability`. This file is preserved so
 * in-tree consumers don't churn paths; new code should import from
 * `@openheaders/core/types` directly.
 */

export type { LogEntry, LogEntryContext, LogLevel, LogSubsystem } from '@openheaders/core/types';
