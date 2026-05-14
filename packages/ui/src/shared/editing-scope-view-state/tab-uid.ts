/**
 * Tab-uid persistence — sessionStorage round-trip.
 *
 * The tab uid identifies *this* tab to itself across reloads. It dies
 * with the tab (sessionStorage scope). The uid is embedded inside the
 * `EditingScopeViewStateEnvelope` envelope so reads and writes stay atomic per
 * surface.
 *
 * Storage failure (private mode quota, disabled storage) degrades to
 * an in-memory uid for the lifetime of this realm — closes BC-V7.
 */

import type { EditingScopeViewStateEnvelope, SurfaceType } from './types';

export function sessionKeyFor(surface: SurfaceType): string {
  return `oh.viewState.${surface}`;
}

function newTabUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // BC-V7 — quota or disabled storage. The hook holds the snapshot
    // in memory; we just lose reload survival.
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // see safeSet.
  }
}

/**
 * Load the per-tab state envelope synchronously. Returns `null` on
 * empty slot, malformed JSON, or schema-version mismatch — callers
 * fall through to the donor record (or factoryDefault).
 */
export function readPerTabState<T>(surface: SurfaceType, expectedSchemaVersion: number): EditingScopeViewStateEnvelope<T> | null {
  const raw = safeGet(sessionKeyFor(surface));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EditingScopeViewStateEnvelope<T>>;
    if (
      typeof parsed?.tabUid !== 'string' ||
      typeof parsed.schemaVersion !== 'number' ||
      parsed.snapshot === undefined ||
      parsed.snapshot === null
    ) {
      return null;
    }
    if (parsed.schemaVersion !== expectedSchemaVersion) return null;
    return parsed as EditingScopeViewStateEnvelope<T>;
  } catch {
    return null;
  }
}

export function writePerTabState<T>(surface: SurfaceType, schemaVersion: number, tabUid: string, snapshot: T): void {
  const envelope: EditingScopeViewStateEnvelope<T> = { tabUid, schemaVersion, snapshot };
  safeSet(sessionKeyFor(surface), JSON.stringify(envelope));
}

export function clearPerTabState(surface: SurfaceType): void {
  safeRemove(sessionKeyFor(surface));
}

/** Mint a new tab uid. Caller is responsible for persisting it. */
export function mintTabUid(): string {
  return newTabUid();
}
