/**
 * Re-export shim — the outbound mutation forwarder lives in
 * `@openheaders/oracle/sync/client` since the desktop-as-client lift.
 * Extension call sites import through this shim during the rolling
 * refactor; future commits codemod them to the canonical path and
 * delete this file.
 */
export * from '@openheaders/oracle/sync/client/mutation-forwarder';
