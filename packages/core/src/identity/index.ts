/**
 * `@openheaders/core/identity` — host-neutral helpers for the synthetic
 * identity bootstrap path (the unified-oracle model §5).
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
export { DEFAULT_BACKEND_PORT, parseBackendAddress } from './backend-address';
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
  type ApproveAuthorizationResult,
  type AuthorizationFacts,
  type BeginCodeInput,
  type BeginCodeRefusalReason,
  type BeginCodeResult,
  type BeginDeviceInput,
  type BeginDeviceRefusalReason,
  type BeginDeviceResult,
  createDaemonAuthorizationService,
  type DaemonAuthorizationService,
  type DaemonAuthorizationServiceOptions,
  DEVICE_POLL_INTERVAL_SECONDS,
  type DecisionRefusalReason,
  type DenyAuthorizationResult,
  defaultGenerateUserCode,
  type LookupByUserCodeResult,
  type MintedAuthorization,
  normalizeUserCode,
  type PendingAuthorization,
  type PendingAuthorizationStatus,
  type PollDeviceInput,
  type PollDeviceResult,
  type RedeemCodeInput,
  type RedeemCodeRefusalReason,
  type RedeemCodeResult,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
} from './daemon-authorization';
export {
  DAEMON_AUTHORIZATION_CLIENT_KINDS,
  DAEMON_AUTHORIZATION_CLIENTS,
  DAEMON_CLI_CLIENT_ID,
  DAEMON_DESKTOP_CLIENT_ID,
  DAEMON_DESKTOP_REDIRECT_PATH,
  DAEMON_EXTENSION_CLIENT_ID,
  DAEMON_EXTENSION_REDIRECT_PATH,
  type DaemonAuthorizationClient,
  type DaemonAuthorizationClientKind,
  type DaemonAuthorizationGrant,
  findDaemonAuthorizationClient,
  GECKO_IDENTITY_REDIRECT_HOSTS,
  isRegisteredRedirect,
} from './daemon-authorization-clients';
export {
  type ConfirmPairResult,
  createDaemonPairingService,
  type DaemonPairingService,
  type DaemonPairingServiceOptions,
  defaultGenerateCode,
  type PendingPair,
  type PendingPairStatus,
  type StartPairInput,
  type StartPairResult,
} from './daemon-pairing';
export {
  type DaemonPeerDisplayIdentity,
  resolveDaemonPeerDisplayIdentity,
  resolveDaemonPeerIdentitySnapshot,
} from './daemon-peer-snapshot';
export {
  type AbsorbPersonalSeatResult,
  absorbPersonalSeat,
  type CreateDaemonUserInput,
  type CreateDaemonUserRefusalReason,
  type CreateDaemonUserResult,
  createDaemonUser,
  type DaemonUserGitAttribution,
  type DeactivateDaemonUserResult,
  daemonUserPrincipalKind,
  deactivateDaemonUser,
  findDaemonUserByEmail,
  isDaemonDirectoryEmpty,
  listDaemonUsers,
  type PersonalSeatRefusalReason,
  type ResolveDaemonPeerUserResult,
  replacePersonalSeatArtifact,
  resolveDaemonPeerUser,
  resolveDaemonUserGitAttribution,
  type SetDaemonUserDaemonAdminResult,
  type SetDaemonUserEmailResult,
  type SetDaemonUserGitEmailResult,
  type SetDaemonUserPasswordResult,
  type SetDaemonUserWorkspaceCreateResult,
  setDaemonUserDaemonAdmin,
  setDaemonUserEmail,
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
  createFailedLookupBudget,
  type FailedLookupBudget,
  type FailedLookupBudgetOptions,
} from './lookup-budget';
export {
  defaultNewWorkspaceOrgId,
  describeOrg,
  type OrgDescriptor,
  type OrgHostHintKind,
  type OrgScopeKind,
  orgCatalogue,
  orgHostHintKind,
  orgIdentityLabel,
  type ProvidingBackendKind,
  providingBackendKind,
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
  DAEMON_ADMIN_FUNCTIONAL_ROLE,
  hasCapability,
  type IdentitySnapshot,
  WORKSPACE_CREATE_FUNCTIONAL_ROLE,
} from './resolver';
export {
  createServerSignInClient,
  fetchJsonDocument,
  type ServerSignInClientOptions,
  wsUrlToHttpOrigin,
} from './server-sign-in-client';
export {
  resolveInternalWorkspaceIds,
  setWorkspaceVisibilityProvider,
  type WorkspaceVisibilityProvider,
} from './visibility-provider';
export {
  type DesiredIdpGrant,
  type GrantWorkspaceRoleInput,
  type GrantWorkspaceRoleResult,
  grantWorkspaceRole,
  listWorkspaceRolesForPrincipal,
  listWorkspaceRolesForWorkspace,
  type ReconcileIdpWorkspaceRolesResult,
  type RevokeWorkspaceRoleResult,
  reconcileIdpWorkspaceRoles,
  revokeWorkspaceRole,
} from './workspace-role-grants';
