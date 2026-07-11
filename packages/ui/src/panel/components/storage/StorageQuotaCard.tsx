/**
 * The Storage tool window's Usage section — the scope's storage usage
 * against its origin quota, with the per-type breakdown when the host's
 * CDP tier answered (attached tabs), a quota-simulation control riding
 * the same tier, and the per-type checkboxes parameterizing the
 * clear-site-data gesture. The gesture itself (bulk destruction ⇒ the
 * two-step arm/confirm idiom, blur disarms) lives in the scope bar as
 * `ClearSiteDataControl` — the same top-row posture as every other
 * section's Clear all — so the checkbox selection is owned by the panel
 * and shared between the two.
 *
 * `navigator.storage` is a secure-context API, so an http: scope
 * legitimately has no reach — that renders as an explanatory empty
 * state, not an error.
 *
 * Capability-gated: the Debug-mode hint only renders where the host can
 * do CDP at all (`cdpInspection`), and the clear gesture only where the
 * host can actually wipe an origin (`originDataClearing`) — a button
 * that can only fail is worse than no button.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { useState } from 'react';
import type { SiteDataType } from '../../data/storage/storage-inspector-host';
import type { StorageQuotaState } from '../../data/storage/use-storage-quota';
import { formatSize } from '../traffic/formatters';
import { CookieIcon, DatabaseIcon, TableIcon, WorkerGearIcon } from './StorageNavIcons';

const STORAGE_TYPE_LABELS: Record<string, string> = {
  indexeddb: 'IndexedDB',
  cache_storage: 'Cache Storage',
  service_workers: 'Service workers',
  file_systems: 'File systems',
  websql: 'WebSQL',
  other: 'Other',
};

/* Labels, icons AND order mirror the storage rail. Session storage is
 * per-tab by nature (the browser's site-data clear can't reach it), so
 * its leg wipes the INSPECTED tab's frame — the note says so. */
const SITE_DATA_CHOICES: ReadonlyArray<{
  type: SiteDataType;
  label: string;
  icon: React.ReactNode;
  note?: string;
}> = [
  { type: 'localStorage', label: 'Local storage', icon: <TableIcon /> },
  {
    type: 'sessionStorage',
    label: 'Session storage',
    icon: <TableIcon />,
    note: 'Session storage is per-tab — this clears the inspected tab’s frame',
  },
  { type: 'cookies', label: 'Cookies', icon: <CookieIcon /> },
  { type: 'indexedDB', label: 'IndexedDB', icon: <DatabaseIcon /> },
  { type: 'cacheStorage', label: 'Cache Storage', icon: <DatabaseIcon /> },
  { type: 'serviceWorkers', label: 'Service workers', icon: <WorkerGearIcon /> },
];

/** MB the way the browser reads it — decimal, not 1024-based. */
const BYTES_PER_MB = 1_000_000;

function storageTypeLabel(storageType: string): string {
  return STORAGE_TYPE_LABELS[storageType] ?? storageType.replace(/_/g, ' ');
}

function percent(part: number, whole: number): number {
  if (!(whole > 0)) return 0;
  return Math.min(100, (part / whole) * 100);
}

interface StorageQuotaCardProps {
  quota: StorageQuotaState;
  /** Site-data types UNchecked for the scope bar's Clear everything —
   *  owned by the panel, shared with the control. */
  excluded: ReadonlySet<SiteDataType>;
  onToggleType: (type: SiteDataType) => void;
  /** Clear everything is hovered — the checked (covered) type rows
   *  light up so the wipe's reach reads before the click. */
  highlightTargets?: boolean;
}

/** Simulation ceiling in MB — the origin's real quota; while an
 *  override is active the reported quota IS the simulated one, so the
 *  bound falls back to a generous 1 TB to allow raising it again. */
function simulationMaxMb(snapshot: { quota: number; overrideActive?: boolean }): number {
  if (snapshot.overrideActive === true) return 1_000_000;
  return Math.max(1, Math.floor(snapshot.quota / BYTES_PER_MB));
}

export function StorageQuotaCard({ quota, excluded, onToggleType, highlightTargets = false }: StorageQuotaCardProps) {
  const snapshot = quota.quota;
  if (snapshot === null) {
    return quota.loading ? (
      <div className="dt-empty">Loading…</div>
    ) : (
      <div className="dt-empty-hero">
        <strong>Usage can’t be read</strong>
        <span className="dt-empty-hero-sub">
          The API only exists in secure contexts (https) — or this frame can’t be read right now.
        </span>
      </div>
    );
  }

  const usedPercent = percent(snapshot.usage, snapshot.quota);
  // A tiny-but-nonzero usage still deserves a visible sliver and a
  // truthful label — never a bare 0.
  const fillPercent = Math.max(usedPercent, snapshot.usage > 0 ? 0.5 : 0);
  const percentLabel = snapshot.usage > 0 && usedPercent < 0.1 ? '<0.1' : usedPercent.toFixed(1);
  const rows = (snapshot.breakdown ?? []).filter((row) => row.usage > 0);

  return (
    <div className="dt-storage-quota">
      <div className="dt-storage-quota-total">
        <span className="dt-storage-quota-usage">{formatSize(snapshot.usage)} used</span>
        <span className="dt-storage-quota-limit">
          of {formatSize(snapshot.quota)} ({percentLabel}%)
        </span>
      </div>
      <div className="dt-storage-quota-bar" role="progressbar" aria-valuenow={Math.round(usedPercent)}>
        <div className="dt-storage-quota-bar-fill" style={{ width: `${fillPercent}%` }} />
      </div>
      {rows.length > 0 ? (
        <div className="dt-storage-quota-rows">
          {rows.map((row) => (
            <div className="dt-storage-quota-row" key={row.storageType}>
              <span className="dt-storage-quota-row-label">{storageTypeLabel(row.storageType)}</span>
              <span className="dt-storage-quota-row-size">{formatSize(row.usage)}</span>
              <span className="dt-storage-quota-row-bar">
                <span
                  className="dt-storage-quota-bar-fill"
                  style={{ width: `${Math.max(percent(row.usage, snapshot.usage), 1)}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      ) : snapshot.breakdown ? (
        <div className="dt-storage-quota-hint">No per-type usage reported for this origin.</div>
      ) : hasCapability('cdpInspection') ? (
        <div className="dt-storage-quota-hint">Enable Debug mode to see the per-type breakdown.</div>
      ) : null}
      {snapshot.breakdown && (
        <QuotaSimulationRow
          overrideActive={snapshot.overrideActive === true}
          overrideFailed={quota.overrideFailed}
          maxMb={simulationMaxMb(snapshot)}
          onOverride={quota.setQuotaOverride}
        />
      )}
      {hasCapability('originDataClearing') && (
        <div className="dt-storage-quota-clear-types">
          <span
            className="dt-storage-quota-clear-types-caption"
            title="Clear everything (top right) deletes exactly the checked data types for this origin"
          >
            Clear everything targets
          </span>
          {SITE_DATA_CHOICES.map(({ type, label, icon, note }) => (
            <label
              className={`dt-storage-quota-clear-type${
                highlightTargets && !excluded.has(type) ? ' dt-storage-quota-clear-type--targeted' : ''
              }`}
              key={type}
              title={note}
            >
              <input type="checkbox" checked={!excluded.has(type)} onChange={() => onToggleType(type)} />
              <span className="dt-storage-nav-icon">{icon}</span>
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The scope bar's Clear everything — the Usage section's clear-site-data
 * gesture in the same top-row posture as the other sections' clear
 * buttons, parameterized by the card's per-type checkboxes.
 */
export function ClearSiteDataControl({
  quota,
  excluded,
  onHoverChange,
}: {
  quota: StorageQuotaState;
  excluded: ReadonlySet<SiteDataType>;
  /** Hover/focus on the button — the panel lights up what the wipe
   *  covers (nav rail sections + the card's checked types). */
  onHoverChange?: (hovering: boolean) => void;
}) {
  if (!hasCapability('originDataClearing') || quota.quota === null) return null;
  const selected = SITE_DATA_CHOICES.filter(({ type }) => !excluded.has(type)).map(({ type }) => type);
  return (
    <span className="dt-storage-clear-group">
      {quota.clearFailed ? (
        <span className="dt-storage-quota-clear-failed">clear failed</span>
      ) : quota.clearSucceeded ? (
        <span className="dt-storage-quota-clear-done" role="status">
          ✓ cleared
        </span>
      ) : null}
      <ClearSiteDataButton
        disabled={selected.length === 0}
        onHoverChange={onHoverChange}
        onClear={() => quota.clearSiteData(selected.length === SITE_DATA_CHOICES.length ? undefined : selected)}
      />
    </span>
  );
}

/**
 * Simulate-custom-quota control — attached tabs only (the caller gates
 * on the breakdown's presence). The value is MB like the browser's own
 * control, bounded to [0, maxMb]; Save (or Enter) commits, Cancel (or
 * Escape) abandons the pending edit, Reset clears an active override.
 */
function QuotaSimulationRow({
  overrideActive,
  overrideFailed,
  maxMb,
  onOverride,
}: {
  overrideActive: boolean;
  overrideFailed: boolean;
  maxMb: number;
  onOverride: (quotaBytes: number | null) => void;
}) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const cancel = () => {
    setValue('');
    setInvalid(false);
  };

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed === '') return;
    const mb = Number(trimmed);
    if (!Number.isFinite(mb) || mb < 0 || mb > maxMb) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setValue('');
    onOverride(Math.round(mb * BYTES_PER_MB));
  };

  return (
    <div className="dt-storage-quota-simulate">
      <label
        className="dt-storage-quota-simulate-label"
        title="Make the browser report and enforce a smaller quota for this origin — for testing how the page behaves when storage runs out"
      >
        Simulate custom quota
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
        />
      </label>
      <span className="dt-storage-quota-simulate-unit">MB</span>
      {value.trim() !== '' && (
        <>
          <button type="button" className="dt-storage-quota-simulate-reset" onClick={commit}>
            Save
          </button>
          <button type="button" className="dt-storage-quota-simulate-reset" onClick={cancel}>
            Cancel
          </button>
        </>
      )}
      {overrideActive && (
        <button
          type="button"
          className="dt-storage-quota-simulate-reset"
          title="Remove the simulated quota"
          onClick={() => {
            cancel();
            onOverride(null);
          }}
        >
          Reset
        </button>
      )}
      {invalid ? (
        <span className="dt-storage-quota-clear-failed">enter 0–{maxMb} MB</span>
      ) : overrideFailed ? (
        <span className="dt-storage-quota-clear-failed">simulation failed</span>
      ) : null}
    </div>
  );
}

/** Two-step inline confirm — first click arms, second commits. */
function ClearSiteDataButton({
  onClear,
  disabled,
  onHoverChange,
}: {
  onClear: () => void;
  disabled: boolean;
  onHoverChange?: (hovering: boolean) => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`dt-storage-clear${armed ? ' dt-storage-clear--armed' : ''}`}
      disabled={disabled}
      title={
        armed ? 'Deletes the checked data types for this origin' : 'Clear the checked data types for this origin'
      }
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onClear();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => {
        setArmed(false);
        onHoverChange?.(false);
      }}
    >
      {armed ? 'Confirm clear?' : 'Clear everything'}
    </button>
  );
}
