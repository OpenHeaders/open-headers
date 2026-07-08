/**
 * deriveOrgSyncAnnotation — the "via <backend>" label on workspace-picker
 * Org groups. Pins the state ladder: unbound → nothing; bound to a
 * missing / disabled / down / re-pair / green backend → the matching
 * tone + text, so a disable or outage is visible on every surface, not
 * only the Settings row.
 */

import { deriveOrgSyncAnnotation } from '@openheaders/ui/shared/backend';
import type { BackendConnection } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

const ORG_ID = 'org-backend';
const BACKEND_ID = 'backend-a';
const BINDINGS = new Map([[ORG_ID, BACKEND_ID]]);

function makeRecord(overrides: Partial<BackendConnection> = {}): BackendConnection {
  return {
    id: BACKEND_ID,
    label: 'Desktop application',
    url: 'ws://127.0.0.1:8137',
    authToken: 'token',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-08T00:00:00.000Z',
    lastConnectedAt: null,
    ...overrides,
  };
}

describe('deriveOrgSyncAnnotation', () => {
  it('an unbound Org (home Org) has nothing to say', () => {
    expect(deriveOrgSyncAnnotation('org-home', BINDINGS, [makeRecord()], {})).toBeNull();
  });

  it('a bound Org whose record vanished reads no longer syncing', () => {
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [], {})).toEqual({
      tone: 'warning',
      text: 'no longer syncing',
    });
  });

  it('a disabled record warns that the Org stopped syncing', () => {
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord({ enabled: false })], {})).toEqual({
      tone: 'warning',
      text: 'via Desktop application — off, not syncing',
    });
  });

  it('a green slot reads as quiet provenance', () => {
    const snapshot = { [BACKEND_ID]: { state: 'green' as const, message: 'Synced with back-end' } };
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], snapshot)).toEqual({
      tone: 'quiet',
      text: 'via Desktop application',
    });
  });

  it('a red slot distinguishes re-pair from a plain outage', () => {
    const authSnapshot = {
      [BACKEND_ID]: {
        state: 'red' as const,
        message: 'Back-end requires authentication',
        context: { reason: 'auth-required' },
      },
    };
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], authSnapshot)).toEqual({
      tone: 'warning',
      text: 'via Desktop application — re-pair needed',
    });
    const downSnapshot = { [BACKEND_ID]: { state: 'red' as const, message: 'Back-end unreachable' } };
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], downSnapshot)).toEqual({
      tone: 'warning',
      text: 'via Desktop application — disconnected',
    });
  });

  it('no slot yet and a yellow slot both read as connecting', () => {
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], {})).toEqual({
      tone: 'quiet',
      text: 'via Desktop application — connecting…',
    });
    const snapshot = { [BACKEND_ID]: { state: 'yellow' as const, message: 'Handshaking with back-end…' } };
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], snapshot)).toEqual({
      tone: 'quiet',
      text: 'via Desktop application — connecting…',
    });
  });

  it('an unlabelled record falls back to its URL', () => {
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord({ label: '', enabled: false })], {})).toEqual({
      tone: 'warning',
      text: 'via ws://127.0.0.1:8137 — off, not syncing',
    });
  });
});
