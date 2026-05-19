/**
 * `@openheaders/core/identity` — host-neutral helpers for the synthetic
 * identity bootstrap path (UNIFIED_ORACLE_MODEL.md §5).
 *
 * Three layers stack here:
 *
 *   1. `derive-uuid` — pure cryptographic primitive: deterministic UUIDv7
 *      from a seed string. Underlies every synthetic row's id.
 *   2. `host-install-id` + `ensure-daemon-config` — persistence of the
 *      single stable seed each host needs (`hostInstallId`). Goes through
 *      the host-neutral `HostStorage` proxy so per-host plumbing
 *      (chrome.storage on the extension SW vs JSON file on desktop main)
 *      is already abstracted.
 *   3. `bootstrap` — pure helper that computes the synthetic identity
 *      row tuple from a `hostInstallId`. The host wires its persistence
 *      (U1.6 / U1.7 — next slices).
 */

export {
  bootstrapSyntheticIdentity,
  type BootstrapSyntheticIdentityInput,
  type BootstrapSyntheticIdentityResult,
} from './bootstrap';
export { deriveSyntheticUuidV7, SYNTHETIC_SEEDS } from './derive-uuid';
export { ensureDaemonConfig } from './ensure-daemon-config';
export {
  ensureSyntheticIdentity,
  type EnsureSyntheticIdentityInput,
} from './ensure-synthetic-identity';
export { ensureWorkspaceRoleAssignments } from './ensure-workspace-role-assignments';
export { mintHostInstallId } from './host-install-id';
export {
  authorizedOrgIds,
  hasCapability,
  type Capability,
  type CapabilityContext,
  type CapabilityDecision,
  type CapabilityDenyReason,
  type IdentitySnapshot,
} from './resolver';
export {
  clearIdentitySnapshot,
  getIdentitySnapshot,
  installIdentitySnapshot,
  refreshIdentitySnapshotFromHostStorage,
  type InstallIdentitySnapshotInput,
} from './registry';
export {
  emitAuditEntry,
  resetAuditSink,
  setAuditSink,
  type AuditEntryInput,
  type AuditSink,
  type ResolvedAuditEntry,
} from './audit';
