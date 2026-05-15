/**
 * Re-export shim — workspace-store lives in `@openheaders/oracle/workspace`
 * since the Desktop host #2 Stage 2 lift. Extension call sites import
 * through this shim during the rolling refactor; future commits codemod
 * them to the canonical path and delete this file.
 */
export * from '@openheaders/oracle/workspace/extension-workspace-store';
