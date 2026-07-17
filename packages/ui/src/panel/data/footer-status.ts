/**
 * Focused-tool footer summaries — what the status bar's left side shows
 * for each tool window when `devpanelLayout.footerScope` is `focused`.
 * Pure builders only; the publish/subscribe seam the tool windows and
 * the status bar meet at lives in `stores/footer-status-store.ts`.
 */

import type { ConsoleLevel } from '@openheaders/core/console-stream';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { StorageSection } from './storage/use-storage-inspector';

// ── Storage ──────────────────────────────────────────────────────────

export interface StorageFooterStatus {
  /** The active section's count line (`12 of 64 items`, `3 databases`,
   *  `4.2 MB of 10 MB used`). */
  summary: string;
  /** Cross-section match note while a filter is typed
   *  (`3 sections match`), empty otherwise. */
  matches: string;
  /** Failure note rendered in the error tone (`write failed`), empty
   *  when healthy. */
  alert: string;
}

export interface StorageFooterInput {
  section: StorageSection;
  /** The active section's row count after the typed filter — `null` for
   *  sections whose grid filters below the top-level rows (IndexedDB
   *  stores, cache entries), where `x of y` over the top-level noun
   *  would misread. */
  filteredCount: number | null;
  totalCount: number;
  /** A non-empty filter is typed — count lines read `x of y` and the
   *  cross-section match note appears. */
  filterActive: boolean;
  /** Sections with at least one matching row (nav-rail badge counts). */
  matchingSections: number;
  writeFailed: boolean;
  /** IndexedDB / Cache Storage per-name delete failed. */
  deleteFailed: boolean;
  readFailed: boolean;
  /** Usage section figures; `null` until the quota read lands. */
  quotaUsage: number | null;
  quotaTotal: number | null;
}

/** Footer bytes in the browser's decimal units, kB→MB→GB rolling. */
function formatStorageBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const kilobytes = bytes / 1000;
  if (kilobytes < 1000) return `${kilobytes.toFixed(1)} kB`;
  const megabytes = kilobytes / 1000;
  if (megabytes < 1000) return `${megabytes.toFixed(1)} MB`;
  return `${(megabytes / 1000).toFixed(1)} GB`;
}

/** The active section's count line — the same keyed count vocabulary
 *  the panel's scope note reads. IndexedDB / Cache Storage count their
 *  top-level nouns only (no `x of y` — their grids filter below the
 *  top-level rows). */
function sectionCountLine(
  t: Translate,
  section: Exclude<StorageSection, 'quota'>,
  filteredCount: number | null,
  totalCount: number,
  filterActive: boolean,
): string {
  const shown = filterActive && filteredCount !== null ? filteredCount : null;
  switch (section) {
    case 'local':
    case 'session':
      return shown !== null
        ? t('panel.storage.count.itemsOf', { shown, count: totalCount })
        : t('panel.storage.count.items', { count: totalCount });
    case 'cookies':
      return shown !== null
        ? t('panel.storage.count.cookiesOf', { shown, count: totalCount })
        : t('panel.storage.count.cookies', { count: totalCount });
    case 'indexeddb':
      return t('panel.storage.count.databases', { count: totalCount });
    case 'cachestorage':
      return t('panel.storage.count.caches', { count: totalCount });
  }
}

export function buildStorageFooterStatus(t: Translate, input: StorageFooterInput): StorageFooterStatus {
  const matches =
    input.filterActive && input.section !== 'quota'
      ? t('panel.storage.count.sectionsMatch', { count: input.matchingSections })
      : '';
  const alert = input.readFailed
    ? t('panel.storage.note.readFailed')
    : input.writeFailed
      ? t('panel.storage.note.writeFailed')
      : input.deleteFailed
        ? t('panel.storage.note.deleteFailed')
        : '';
  if (input.section === 'quota') {
    const summary =
      input.quotaUsage !== null && input.quotaTotal !== null
        ? t('panel.storage.count.quotaUsed', {
            used: formatStorageBytes(input.quotaUsage),
            total: formatStorageBytes(input.quotaTotal),
          })
        : '';
    return { summary, matches, alert };
  }
  const summary = sectionCountLine(t, input.section, input.filteredCount, input.totalCount, input.filterActive);
  return { summary, matches, alert };
}

// ── Console ──────────────────────────────────────────────────────────

export interface ConsoleFooterStatus {
  /** Messages the view currently shows (level mask + filters applied,
   *  grouped repeats expanded back to message counts). */
  visibleCount: number;
  /** All messages in the current log window, before any filtering. */
  totalCount: number;
  errorCount: number;
  warningCount: number;
}

/** Error/warning tallies over the console's unfiltered log window. */
export function countConsoleLevels(levels: ReadonlyArray<ConsoleLevel>): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const level of levels) {
    if (level === 'error') errors++;
    else if (level === 'warning') warnings++;
  }
  return { errors, warnings };
}

// ── Search ───────────────────────────────────────────────────────────

export interface SearchFooterStatus {
  status: 'idle' | 'running' | 'done';
  /** Scan progress (requests done / total) while running. */
  done: number;
  total: number;
  matches: number;
  files: number;
  elapsedMs: number;
}

function formatSearchElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** The footer's one-line search summary — empty while idle (the bar
 *  falls back to the Network line). Timing figures stay in the raw
 *  ms / s parity scale inside the keyed sentences. */
export function searchFooterLine(t: Translate, status: SearchFooterStatus): string {
  if (status.status === 'running') {
    return t('panel.search.status.searching', { done: status.done, total: status.total });
  }
  if (status.status === 'done') {
    const elapsed = formatSearchElapsed(status.elapsedMs);
    if (status.matches === 0) return t('panel.search.status.noResults', { elapsed });
    return t('panel.search.status.found', { matches: status.matches, files: status.files, elapsed });
  }
  return '';
}
