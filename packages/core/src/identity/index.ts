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
  type AuditEntryInput,
  type AuditSink,
  emitAuditEntry,
  type ResolvedAuditEntry,
  resetAuditSink,
  setAuditSink,
} from './audit';
export {
  type BootstrapSyntheticIdentityInput,
  type BootstrapSyntheticIdentityResult,
  bootstrapSyntheticIdentity,
} from './bootstrap';
export {
  listDaemonAuthTokens,
  type MintDaemonAuthTokenInput,
  type MintDaemonAuthTokenResult,
  mintDaemonAuthToken,
  peekDaemonAuthToken,
  revokeDaemonAuthToken,
  type ValidateDaemonAuthTokenFailure,
  type ValidateDaemonAuthTokenResult,
  type ValidateDaemonAuthTokenSuccess,
  validateDaemonAuthToken,
} from './daemon-auth-tokens';
export {
  type ConfirmPairResult,
  createDaemonPairingService,
  type DaemonPairingService,
  type DaemonPairingServiceOptions,
  type PendingPair,
  type PendingPairStatus,
  type StartPairInput,
  type StartPairResult,
} from './daemon-pairing';
export { resolveDaemonPeerIdentitySnapshot } from './daemon-peer-snapshot';
export {
  type AbsorbPersonalSeatResult,
  absorbPersonalSeat,
  type CreateDaemonUserInput,
  type CreateDaemonUserResult,
  createDaemonUser,
  type DaemonUserGitAttribution,
  type DeactivateDaemonUserResult,
  deactivateDaemonUser,
  findDaemonUserByEmail,
  listDaemonUsers,
  type PersonalSeatRefusalReason,
  type ResolveDaemonPeerUserResult,
  replacePersonalSeatArtifact,
  resolveDaemonPeerUser,
  resolveDaemonUserGitAttribution,
  type SetDaemonUserGitEmailResult,
  type SetDaemonUserPasswordResult,
  type SetDaemonUserWorkspaceCreateResult,
  setDaemonUserGitEmail,
  setDaemonUserPassword,
  setDaemonUserWorkspaceCreate,
} from './daemon-users';
export { deriveSyntheticUuidV7, SYNTHETIC_SEEDS } from './derive-uuid';
export { ensureDaemonConfig } from './ensure-daemon-config';
export {
  type EnsureSyntheticIdentityInput,
  ensureSyntheticIdentity,
} from './ensure-synthetic-identity';
export {
  ensureWorkspaceRoleAssignments,
  withWorkspaceRoleAssignmentsLock,
} from './ensure-workspace-role-assignments';
export { mintHostInstallId } from './host-install-id';
export {
  defaultNewWorkspaceOrgId,
  describeOrg,
  type OrgDescriptor,
  type OrgHostHintKind,
  type OrgScopeKind,
  orgCatalogue,
  orgHostHintKind,
  orgIdentityLabel,
} from './org-catalogue';
export { resolveOrgActiveWorkspace } from './org-workspace';
export {
  type ClaimJoinedOrgResult,
  claimJoinedOrg,
  clearIdentitySnapshot,
  getIdentitySnapshot,
  getOrgBackendBindings,
  type InstallIdentitySnapshotInput,
  installIdentitySnapshot,
  isPinnedBackendId,
  MAX_ORG_NAME_LENGTH,
  pruneJoinedOrgsForBackend,
  type RecordJoinedOrgResult,
  type RenameHomeOrgResult,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
  renameHomeOrg,
  type SetHomeOrgLogoResult,
  setHomeOrgLogo,
  setPinnedBackendIds,
} from './registry';
export {
  authorizedOrgIds,
  type Capability,
  type CapabilityContext,
  type CapabilityDecision,
  type CapabilityDenyReason,
  consumedOrgIds,
  hasCapability,
  type IdentitySnapshot,
  WORKSPACE_CREATE_FUNCTIONAL_ROLE,
} from './resolver';
export {
  type DesiredIdpGrant,
  type GrantWorkspaceRoleInput,
  type GrantWorkspaceRoleResult,
  grantWorkspaceRole,
  listWorkspaceRolesForPrincipal,
  type ReconcileIdpWorkspaceRolesResult,
  type RevokeWorkspaceRoleResult,
  reconcileIdpWorkspaceRoles,
  revokeWorkspaceRole,
} from './workspace-role-grants';
