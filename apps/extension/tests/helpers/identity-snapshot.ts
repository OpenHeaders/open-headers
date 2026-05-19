/**
 * Test fixture — install a synthetic identity snapshot for sync-engine
 * unit tests.
 *
 * The transport-boundary org filter
 * ({@link `@openheaders/core/identity`.authorizedOrgIds}) consults
 * {@link getIdentitySnapshot} to decide which envelope `orgId` values
 * are authorized. Without an installed snapshot the authorized set is
 * empty — deny-all — which would zero out state-vector / delta-stream
 * / snapshot readers in tests.
 *
 * Tests that construct envelopes through the host's `mintBatch` path
 * with a hand-rolled {@link MutatorContext} (no `orgId` field) emit
 * envelopes stamped with the {@link PRE_BOOTSTRAP_ORG_ID} sentinel.
 * Pinning the test snapshot's `homeOrgId` to the same sentinel lets
 * those envelopes pass the filter without rewiring each test's ctx
 * factory or the org-resolver.
 */

import { clearIdentitySnapshot, installIdentitySnapshot } from '@openheaders/core/identity';
import { PRE_BOOTSTRAP_ORG_ID } from '@openheaders/core/sync';
import type { SyntheticIdentityRecord, WorkspaceRoleAssignment } from '@openheaders/core/types';

const FIXED_NOW = '2025-01-01T00:00:00.000Z';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000010';
const TEST_PRINCIPAL_ID = '01900000-0000-7000-8000-000000000011';
const TEST_MEMBERSHIP_ID = '01900000-0000-7000-8000-000000000012';
const TEST_USER_IDENTITY_ID = '01900000-0000-7000-8000-000000000013';
const TEST_SESSION_ID = '01900000-0000-7000-8000-000000000014';
const TEST_LOCAL_ADMIN_ID = '01900000-0000-7000-8000-000000000015';

export function installTestIdentitySnapshot(homeOrgId: string = PRE_BOOTSTRAP_ORG_ID): void {
  const record: SyntheticIdentityRecord = {
    user: { id: TEST_USER_ID, displayName: 'Test', homeOrgId, isSynthetic: true },
    org: { id: homeOrgId, name: 'Test Org', isSynthetic: true },
    userIdentity: {
      id: TEST_USER_IDENTITY_ID,
      userId: TEST_USER_ID,
      kind: 'local',
      value: null,
      isPrimary: true,
      verifiedAt: FIXED_NOW,
    },
    session: {
      id: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      source: 'local',
      createdAt: FIXED_NOW,
      revokedAt: null,
    },
    membership: {
      id: TEST_MEMBERSHIP_ID,
      userId: TEST_USER_ID,
      orgId: homeOrgId,
      primaryRole: 'owner',
      functionalRoles: [],
    },
    principal: { id: TEST_PRINCIPAL_ID, userId: TEST_USER_ID, orgId: homeOrgId },
    localAdmin: { id: TEST_LOCAL_ADMIN_ID, userId: TEST_USER_ID, isLocal: true },
  };
  const wras: ReadonlyArray<WorkspaceRoleAssignment> = [];
  installIdentitySnapshot({ record, wras });
}

export function clearTestIdentitySnapshot(): void {
  clearIdentitySnapshot();
}
