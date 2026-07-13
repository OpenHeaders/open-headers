/**
 * Re-export shim — the workspace-export gatherer lives in
 * `@openheaders/oracle/workspace/export-gatherer` since the export-side
 * host-neutral lift. Extension call sites import through this shim
 * during the rolling refactor; future commits codemod them to the
 * canonical path and delete this file.
 */
export * from '@openheaders/oracle/workspace/export-gatherer';
