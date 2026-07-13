/**
 * Re-export shim — the cross-workspace import dedup walker lives in
 * `@openheaders/oracle/workspace/import-dedup` since the export-side
 * host-neutral lift. Extension call sites import through this shim
 * during the rolling refactor; future commits codemod them to the
 * canonical path and delete this file.
 */
export * from '@openheaders/oracle/workspace/import-dedup';
