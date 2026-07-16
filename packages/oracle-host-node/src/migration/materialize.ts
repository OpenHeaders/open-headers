/**
 * Node face of the host-neutral parity materialization
 * (`@openheaders/oracle/migration`) — a pure re-export: the write path
 * was already host-neutral (core parsers + oracle sync service), so the
 * node host adds nothing.
 */

export {
  type LandingWorkspaceRef,
  type MaterializePostmanPullOptions,
  MIGRATION_SURFACE_ID,
  materializePostmanPull,
  POSTMAN_VENDOR_ID,
} from '@openheaders/oracle/migration';
