/**
 * Donor record — `chrome.storage.local` read / write / subscribe.
 *
 * One record per surface. The record persists across browser restart
 * (Chrome DevTools semantics — see design § 6, § 17 R1). The footer
 * pill's "Reset to defaults" action is the user-facing escape hatch.
 *
 * Schema-version mismatch is treated as a missing record so the loader
 * falls through to factoryDefault (BC-V2). The golden-fixture test
 * walks every committed `v<N>.json` to lock this in (design § 8.3).
 */

import type { DonorRecord, SurfaceType } from '@openheaders/core/types';
import { extensionStorage, type StorageKey, storageKey } from '../storage';

function donorKey(surface: SurfaceType): StorageKey<DonorRecord<unknown>> {
  return storageKey<DonorRecord<unknown>>(`oh.donorRecord.${surface}`);
}

/**
 * Read + version-check the donor record. Returns `null` on empty,
 * malformed, or schema-mismatched payloads. Never throws.
 */
export async function readDonorRecord<T>(
  surface: SurfaceType,
  expectedSchemaVersion: number,
): Promise<DonorRecord<T> | null> {
  try {
    const raw = await extensionStorage.get(donorKey(surface));
    if (!isValidRecord(raw, expectedSchemaVersion)) return null;
    return raw as DonorRecord<T>;
  } catch {
    return null;
  }
}

export async function writeDonorRecord<T>(surface: SurfaceType, record: DonorRecord<T>): Promise<void> {
  try {
    await extensionStorage.set(donorKey(surface), record as DonorRecord<unknown>);
  } catch {
    // Storage quota / disabled — the tab still owns its sessionStorage
    // snapshot; we just lose donor publish for this edit.
  }
}

export async function clearDonorRecord(surface: SurfaceType): Promise<void> {
  try {
    await extensionStorage.remove(donorKey(surface));
  } catch {
    // ignore — the next reload reads it as empty either way.
  }
}

/**
 * Subscribe to donor-record changes. Fires with the new record
 * (already version-validated) or `null` on removal / mismatch.
 */
export function subscribeDonorRecord<T>(
  surface: SurfaceType,
  expectedSchemaVersion: number,
  fn: (record: DonorRecord<T> | null) => void,
): () => void {
  return extensionStorage.subscribe(donorKey(surface), (next) => {
    if (next === undefined) {
      fn(null);
      return;
    }
    fn(isValidRecord(next, expectedSchemaVersion) ? (next as DonorRecord<T>) : null);
  });
}

function isValidRecord(raw: unknown, expectedSchemaVersion: number): raw is DonorRecord<unknown> {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Partial<DonorRecord<unknown>>;
  if (typeof r.donorTabUid !== 'string') return false;
  if (typeof r.schemaVersion !== 'number') return false;
  if (typeof r.publishedAt !== 'number') return false;
  if (r.snapshot === undefined || r.snapshot === null) return false;
  if (r.schemaVersion !== expectedSchemaVersion) return false;
  return true;
}
