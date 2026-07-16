/**
 * deriveOrgSyncAnnotation — the "via <backend>" provenance on workspace-
 * picker Org groups. Pins the state ladder: unbound → nothing; bound to
 * a missing / disabled / down / re-pair / green backend → the matching
 * tone + kind (render sites word each kind through the catalog), so a
 * disable or outage is visible on every surface, not only the Settings
 * row. `orgSyncAnnotationText` pins the English wording per kind.
 */

import type { BackendConnection } from '@openheaders/core/types';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { deriveOrgSyncAnnotation, orgSyncAnnotationText, orphanedOrgAnnotation } from '@openheaders/ui/shared/backend';
import { describe, expect, it } from 'vitest';

const ORG_ID = 'org-backend';
const BACKEND_ID = 'backend-a';
const BINDINGS = new Map([[ORG_ID, BACKEND_ID]]);

// Provider-less English default — the same resolution LocaleContext uses.
const t = getTranslator(DEFAULT_LOCALE);

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
    const annotation = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [], {});
    expect(annotation).toEqual({ tone: 'warning', kind: 'removed' });
    expect(annotation && orgSyncAnnotationText(t, annotation)).toBe('no longer syncing');
  });

  it('a pinned backend with no record (the web serving daemon) has nothing to say — it syncs via the wire', () => {
    const isPinned = (id: string) => id === BACKEND_ID;
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [], {}, isPinned)).toBeNull();
  });

  it('a disabled record warns that the Org stopped syncing', () => {
    const annotation = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord({ enabled: false })], {});
    expect(annotation).toEqual({ tone: 'warning', kind: 'off', backendLabel: 'Desktop application' });
    expect(annotation && orgSyncAnnotationText(t, annotation)).toBe('via Desktop application — off, not syncing');
  });

  it('a green slot reads as quiet provenance', () => {
    const snapshot = { [BACKEND_ID]: { state: 'green' as const, message: 'Synced with back-end' } };
    const annotation = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], snapshot);
    expect(annotation).toEqual({ tone: 'quiet', kind: 'synced', backendLabel: 'Desktop application' });
    expect(annotation && orgSyncAnnotationText(t, annotation)).toBe('via Desktop application');
  });

  it('a red slot distinguishes re-pair from a plain outage', () => {
    const authSnapshot = {
      [BACKEND_ID]: {
        state: 'red' as const,
        message: 'Back-end requires authentication',
        context: { reason: 'auth-required' },
      },
    };
    const repair = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], authSnapshot);
    expect(repair).toEqual({ tone: 'warning', kind: 'repair', backendLabel: 'Desktop application' });
    expect(repair && orgSyncAnnotationText(t, repair)).toBe('via Desktop application — re-pair needed');

    const downSnapshot = { [BACKEND_ID]: { state: 'red' as const, message: 'Back-end unreachable' } };
    const down = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], downSnapshot);
    expect(down).toEqual({ tone: 'warning', kind: 'disconnected', backendLabel: 'Desktop application' });
    expect(down && orgSyncAnnotationText(t, down)).toBe('via Desktop application — disconnected');
  });

  it('no slot yet and a yellow slot both read as connecting', () => {
    expect(deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], {})).toEqual({
      tone: 'quiet',
      kind: 'connecting',
      backendLabel: 'Desktop application',
    });
    const snapshot = { [BACKEND_ID]: { state: 'yellow' as const, message: 'Handshaking with back-end…' } };
    const annotation = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord()], snapshot);
    expect(annotation).toEqual({ tone: 'quiet', kind: 'connecting', backendLabel: 'Desktop application' });
    expect(annotation && orgSyncAnnotationText(t, annotation)).toBe('via Desktop application — connecting…');
  });

  it('an unlabelled record falls back to its URL', () => {
    const annotation = deriveOrgSyncAnnotation(ORG_ID, BINDINGS, [makeRecord({ label: '', enabled: false })], {});
    expect(annotation).toEqual({ tone: 'warning', kind: 'off', backendLabel: 'ws://127.0.0.1:8137' });
    expect(annotation && orgSyncAnnotationText(t, annotation)).toBe('via ws://127.0.0.1:8137 — off, not syncing');
  });

  it('an orphaned Org group reads back-end removed', () => {
    const annotation = orphanedOrgAnnotation();
    expect(annotation).toEqual({ tone: 'warning', kind: 'orphaned' });
    expect(orgSyncAnnotationText(t, annotation)).toBe('back-end removed — local copies');
  });
});
