/**
 * Org-choice clamp (the server access plan A5, as gated S12). Pins:
 * on the JOINED web host the choice catalogue holds server Orgs only
 * and a stored preference naming the home Org is ignored (not
 * deleted — the resolution falls through to the server); the
 * extension keeps the full catalogue and honours the stored
 * preference; a web host with only its local Org (the A8 offline
 * mount) is untouched.
 */

import { getIdentitySnapshot, orgCatalogue } from '@openheaders/core/identity';
import type { Org } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { orgChoiceCatalogue, resolveNewWorkspaceOrgId } from '@openheaders/ui/shared/workspace-org/org-choice';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSyntheticIdentityForTests } from './sync/_identity-test-setup';

const SERVER_ORG: Org = { id: 'org-server', name: 'Server', hostKind: 'daemon', isPrivate: false };

let teardown: () => void;

beforeEach(async () => {
  teardown = await installSyntheticIdentityForTests([], [SERVER_ORG]);
});

afterEach(() => {
  teardown();
  setCurrentHost('extension');
});

function homeOrgId(): string {
  const snapshot = getIdentitySnapshot();
  if (!snapshot) throw new Error('identity snapshot not installed');
  return snapshot.user.homeOrgId;
}

describe('orgChoiceCatalogue', () => {
  it('offers server Orgs only on the joined web host', () => {
    setCurrentHost('web');
    const choices = orgChoiceCatalogue(orgCatalogue(getIdentitySnapshot()));
    expect(choices.map((d) => d.id)).toEqual([SERVER_ORG.id]);
  });

  it('keeps the full catalogue on the extension host', () => {
    const choices = orgChoiceCatalogue(orgCatalogue(getIdentitySnapshot()));
    expect(choices.map((d) => d.id)).toEqual([homeOrgId(), SERVER_ORG.id]);
  });

  it('keeps the local Org on a web host that joined nothing', async () => {
    teardown();
    teardown = await installSyntheticIdentityForTests();
    setCurrentHost('web');
    const choices = orgChoiceCatalogue(orgCatalogue(getIdentitySnapshot()));
    expect(choices.map((d) => d.id)).toEqual([homeOrgId()]);
  });
});

describe('resolveNewWorkspaceOrgId', () => {
  it('ignores a stored home-Org preference on the joined web host', () => {
    setCurrentHost('web');
    expect(resolveNewWorkspaceOrgId(getIdentitySnapshot(), homeOrgId())).toBe(SERVER_ORG.id);
  });

  it('honours the stored home-Org preference on the extension host', () => {
    expect(resolveNewWorkspaceOrgId(getIdentitySnapshot(), homeOrgId())).toBe(homeOrgId());
  });

  it('resolves to the widest-reach Org with no stored preference on either host', () => {
    expect(resolveNewWorkspaceOrgId(getIdentitySnapshot(), null)).toBe(SERVER_ORG.id);
    setCurrentHost('web');
    expect(resolveNewWorkspaceOrgId(getIdentitySnapshot(), null)).toBe(SERVER_ORG.id);
  });

  it('keeps the home Org on a web host that joined nothing', async () => {
    teardown();
    teardown = await installSyntheticIdentityForTests();
    setCurrentHost('web');
    expect(resolveNewWorkspaceOrgId(getIdentitySnapshot(), homeOrgId())).toBe(homeOrgId());
  });
});
