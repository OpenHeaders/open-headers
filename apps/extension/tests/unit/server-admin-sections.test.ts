/**
 * The Administration nav's rows on each host. The Server domain belongs
 * to a standalone server alone: a desktop app — its own window, or a
 * browser tab on the Workbench it serves — never offers the row, and a
 * served tab that does not yet know what serves it keeps the row rather
 * than hide a server's only door to its switch.
 */

import { clearIdentitySnapshot } from '@openheaders/core/identity';
import type { Org } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import {
  SERVER_ADMIN_SECTION_MAP,
  visibleServerAdminSections,
} from '@openheaders/ui/workbench/components/server-admin/sections';
import { afterEach, describe, expect, it } from 'vitest';
import { installSyntheticIdentityForTests } from './sync/_identity-test-setup';

const SERVER_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Proof Server',
  hostKind: 'daemon',
  isPrivate: false,
};

const DESKTOP_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000cc',
  name: 'Johns-MacBook-Pro',
  hostKind: 'desktop',
  isPrivate: false,
};

const EVERY_DOMAIN = ['users', 'devices', 'git', 'audit', 'server'];
const WITHOUT_SERVER = ['users', 'devices', 'git', 'audit'];

function rowIds(): string[] {
  return visibleServerAdminSections().map((def) => def.id);
}

afterEach(() => {
  clearIdentitySnapshot();
  setCurrentHost('extension');
});

describe('visibleServerAdminSections', () => {
  it('the desktop app offers no Server row — its build is under Settings › About', () => {
    setCurrentHost('desktop');
    expect(rowIds()).toEqual(WITHOUT_SERVER);
  });

  it('a tab served by a standalone server offers every domain', async () => {
    setCurrentHost('web');
    await installSyntheticIdentityForTests([], [SERVER_ORG]);
    expect(rowIds()).toEqual(EVERY_DOMAIN);
  });

  it('a tab served by the desktop app offers no Server row', async () => {
    setCurrentHost('web');
    await installSyntheticIdentityForTests([], [DESKTOP_ORG]);
    expect(rowIds()).toEqual(WITHOUT_SERVER);
  });

  it('a served tab that has not learned what serves it keeps the Server row', () => {
    setCurrentHost('web');
    expect(rowIds()).toEqual(EVERY_DOMAIN);
  });

  it('the registry still names every domain, so a Server tab opened earlier keeps its label', () => {
    setCurrentHost('desktop');
    expect(SERVER_ADMIN_SECTION_MAP.get('server')?.labelKey).toBe('workbench.serverAdmin.panel.server');
  });
});
