/**
 * derivePublishTargets — the joined-Org enumeration behind the Publish
 * picker (the publish-target picker design). Pins:
 *   - one target per binding, name-sorted, the home Org never listed;
 *   - health folds out of the annotation ladder: green / connecting
 *     stay selectable, off / disconnected / re-pair / removed-record
 *     list unhealthy with the annotation wording;
 *   - a null snapshot yields no targets.
 */

import { getIdentitySnapshot, getOrgBackendBindings } from '@openheaders/core/identity';
import type { BackendSyncStatusSnapshot, Org } from '@openheaders/core/types';
import { derivePublishTargets } from '@openheaders/ui/shared/backend';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSyntheticIdentityForTests, makeTestBackend } from './sync/_identity-test-setup';

const BACKEND_A = '01900000-0000-7000-8000-0000000000aa';
const BACKEND_B = '01900000-0000-7000-8000-0000000000bb';

const ORG_A: Org = { id: 'org-staging', name: 'Staging', hostKind: 'desktop', isPrivate: false };
const ORG_B: Org = { id: 'org-team', name: 'Team', hostKind: 'daemon', isPrivate: false };

const RECORD_A = makeTestBackend({ id: BACKEND_A, label: 'Desktop app' });
const RECORD_B = makeTestBackend({ id: BACKEND_B, label: 'Work VM' });

let teardown: () => void;

beforeEach(async () => {
  teardown = await installSyntheticIdentityForTests(
    [],
    [
      { org: ORG_A, backendId: BACKEND_A },
      { org: ORG_B, backendId: BACKEND_B },
    ],
  );
});

afterEach(() => {
  teardown();
});

function derive(backends = [RECORD_A, RECORD_B], slots: BackendSyncStatusSnapshot = {}) {
  return derivePublishTargets(getIdentitySnapshot(), getOrgBackendBindings(), backends, slots);
}

describe('derivePublishTargets', () => {
  it('lists every joined Org name-sorted, never the home Org', () => {
    const targets = derive();
    expect(targets.map((t) => t.orgId)).toEqual([ORG_A.id, ORG_B.id]);
    expect(targets.map((t) => t.orgName)).toEqual(['Staging', 'Team']);
    const homeOrgId = getIdentitySnapshot()?.user.homeOrgId;
    expect(targets.some((t) => t.orgId === homeOrgId)).toBe(false);
  });

  it('a green slot is a healthy target with quiet provenance', () => {
    const targets = derive([RECORD_A, RECORD_B], {
      [BACKEND_A]: { state: 'green', message: 'Synced' },
    });
    const staging = targets.find((t) => t.orgId === ORG_A.id);
    expect(staging).toMatchObject({
      healthy: true,
      annotation: { tone: 'quiet', kind: 'synced', backendLabel: 'Desktop app' },
    });
  });

  it('a connecting backend (no slot yet) stays selectable', () => {
    const staging = derive().find((t) => t.orgId === ORG_A.id);
    expect(staging?.healthy).toBe(true);
    expect(staging?.annotation).toEqual({ tone: 'quiet', kind: 'connecting', backendLabel: 'Desktop app' });
  });

  it('off / re-pair / disconnected targets list unhealthy with the annotation kind', () => {
    const targets = derive([makeTestBackend({ id: BACKEND_A, label: 'Desktop app', enabled: false }), RECORD_B], {
      [BACKEND_B]: { state: 'red', message: 'auth', context: { reason: 'auth-required' } },
    });
    expect(targets.find((t) => t.orgId === ORG_A.id)).toMatchObject({
      healthy: false,
      annotation: { tone: 'warning', kind: 'off', backendLabel: 'Desktop app' },
    });
    expect(targets.find((t) => t.orgId === ORG_B.id)).toMatchObject({
      healthy: false,
      annotation: { tone: 'warning', kind: 'repair', backendLabel: 'Work VM' },
    });
  });

  it('a binding whose record vanished reads unhealthy no-longer-syncing', () => {
    const staging = derive([RECORD_B]).find((t) => t.orgId === ORG_A.id);
    expect(staging).toMatchObject({ healthy: false, annotation: { tone: 'warning', kind: 'removed' } });
  });

  it('a null snapshot yields no targets', () => {
    expect(derivePublishTargets(null, getOrgBackendBindings(), [RECORD_A], {})).toEqual([]);
  });
});
