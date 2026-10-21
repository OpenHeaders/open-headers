/**
 * The crash that survives a reload. The root fallback records the
 * failure in the window's session storage the moment it shows, so the
 * person can take the primary way out — Reload — without losing the
 * chance to report: the notifications timeline of the reloaded
 * document finds the record and offers Report Issue and the chat from
 * a working window. Session storage is the window's own and dies with
 * it, so a record never surfaces days later or in another window.
 */

export const PENDING_CRASH_STORAGE_KEY = 'oh.pendingCrash';

export interface PendingCrash {
  /** `name: message` — the dialog's title. */
  headline: string;
  /** The funnel's report details, frames already anonymized — the dialog's description. */
  details: string;
  at: number;
}

export function rememberPendingCrash(crash: PendingCrash): void {
  try {
    window.sessionStorage.setItem(PENDING_CRASH_STORAGE_KEY, JSON.stringify(crash));
  } catch {
    // Storage unavailable — the page's own buttons remain the way to report.
  }
}

function isPendingCrash(value: unknown): value is PendingCrash {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.headline === 'string' && typeof record.details === 'string' && typeof record.at === 'number';
}

/** The pending record, taken once: it leaves storage on the read. */
export function takePendingCrash(): PendingCrash | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_CRASH_STORAGE_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    return isPendingCrash(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
