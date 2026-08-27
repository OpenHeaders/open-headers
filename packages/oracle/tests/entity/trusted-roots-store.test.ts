/**
 * The executors' read seam over the trusted-roots cache: PEM strings
 * per workspace, and the send shape (absent when there is nothing to
 * apply) the transports take.
 */

import type { TrustedRoots } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';
import {
  getTrustedRootPemsForSend,
  getTrustedRootPemsForWorkspace,
  getTrustedRootsForWorkspace,
} from '../../src/entity/trusted-roots-store';

const caches = new Map<string, TrustedRoots>();

vi.mock('@openheaders/oracle/sync/service/accessors', () => ({
  getCacheForWorkspace: (_registration: unknown, workspaceId: string) => {
    const roots = caches.get(workspaceId);
    return roots === undefined ? null : { getTrustedRoots: () => roots };
  },
  getActiveCacheForRegistration: () => null,
}));

const ROOT_A = '-----BEGIN CERTIFICATE-----\nA\n-----END CERTIFICATE-----\n';
const ROOT_B = '-----BEGIN CERTIFICATE-----\nB\n-----END CERTIFICATE-----\n';

function root(uid: string, certPem: string): TrustedRoots['roots'][number] {
  return { uid, name: `root ${uid}`, certPem, addedAt: '2026-08-27T00:00:00.000Z' };
}

describe('trusted-roots-store', () => {
  it('reads the mounted cache per workspace, empty when none is mounted', () => {
    caches.set('ws-1', { schemaVersion: 5, roots: [root('a', ROOT_A), root('b', ROOT_B)] });
    expect(getTrustedRootsForWorkspace('ws-1').roots).toHaveLength(2);
    expect(getTrustedRootsForWorkspace('ws-none').roots).toEqual([]);
  });

  it('hands the executors PEM strings in row order', () => {
    caches.set('ws-1', { schemaVersion: 5, roots: [root('a', ROOT_A), root('b', ROOT_B)] });
    expect(getTrustedRootPemsForWorkspace('ws-1')).toEqual([ROOT_A, ROOT_B]);
  });

  it('the send shape is absent for no workspace, an unmounted one, or an empty list', () => {
    caches.set('ws-1', { schemaVersion: 5, roots: [root('a', ROOT_A)] });
    caches.set('ws-empty', { schemaVersion: 5, roots: [] });
    expect(getTrustedRootPemsForSend('ws-1')).toEqual([ROOT_A]);
    expect(getTrustedRootPemsForSend(null)).toBeUndefined();
    expect(getTrustedRootPemsForSend('ws-none')).toBeUndefined();
    expect(getTrustedRootPemsForSend('ws-empty')).toBeUndefined();
  });

  it('a draft on the send replaces the workspace list: added rows apply, an empty draft withholds', () => {
    caches.set('ws-1', { schemaVersion: 5, roots: [root('a', ROOT_A)] });
    expect(getTrustedRootPemsForSend('ws-1', [ROOT_A, ROOT_B])).toEqual([ROOT_A, ROOT_B]);
    expect(getTrustedRootPemsForSend('ws-1', [ROOT_B])).toEqual([ROOT_B]);
    expect(getTrustedRootPemsForSend('ws-1', [])).toBeUndefined();
    expect(getTrustedRootPemsForSend(null, [ROOT_B])).toEqual([ROOT_B]);
    expect(getTrustedRootPemsForSend('ws-1', undefined)).toEqual([ROOT_A]);
  });
});
