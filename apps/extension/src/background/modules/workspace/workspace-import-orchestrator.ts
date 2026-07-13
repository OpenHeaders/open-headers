/**
 * Re-export shim — the workspace-export import orchestrator lives in
 * `@openheaders/oracle/workspace/import-orchestrator` since the
 * host-neutral lift (every oracle-owning host answers the import
 * channels through it). Extension call sites import through this shim
 * during the rolling refactor; future commits codemod them to the
 * canonical path and delete this file.
 */
export * from '@openheaders/oracle/workspace/import-orchestrator';
