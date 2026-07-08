/**
 * The Storage tool window's Usage section — the scope's storage usage
 * against its origin quota, with the per-type breakdown when the host's
 * CDP tier answered (attached tabs), a quota-simulation control riding
 * the same tier, and the clear-site-data gesture (bulk destruction ⇒
 * the two-step arm/confirm idiom, blur disarms) parameterized by
 * per-type checkboxes (default all-on).
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

const STORAGE_TYPE_LABELS: Record<string, string> = {
  indexeddb: 'IndexedDB',
  cache_storage: 'Cache Storage',
  service_workers: 'Service workers',
  file_systems: 'File systems',
  websql: 'WebSQL',
  other: 'Other',
};

const SITE_DATA_CHOICES: ReadonlyArray<{ type: SiteDataType; label: string }> = [
  { type: 'cookies', label: 'Cookies' },
  { type: 'localStorage', label: 'DOM storage' },
  { type: 'indexedDB', label: 'IndexedDB' },
  { type: 'cacheStorage', label: 'Cache Storage' },
  { type: 'serviceWorkers', label: 'Service workers' },
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
}

export function StorageQuotaCard({ quota }: StorageQuotaCardProps) {
  const [excluded, setExcluded] = useState<ReadonlySet<SiteDataType>>(new Set());
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

  const toggleType = (type: SiteDataType) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  const selected = SITE_DATA_CHOICES.filter(({ type }) => !excluded.has(type)).map(({ type }) => type);

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
          onOverride={quota.setQuotaOverride}
        />
      )}
      {hasCapability('originDataClearing') && (
        <>
          <div className="dt-storage-quota-clear-types">
            {SITE_DATA_CHOICES.map(({ type, label }) => (
              <label className="dt-storage-quota-clear-type" key={type}>
                <input type="checkbox" checked={!excluded.has(type)} onChange={() => toggleType(type)} />
                {label}
              </label>
            ))}
          </div>
          <div className="dt-storage-quota-actions">
            <ClearSiteDataButton
              disabled={selected.length === 0}
              onClear={() =>
                quota.clearSiteData(selected.length === SITE_DATA_CHOICES.length ? undefined : selected)
              }
            />
            {quota.clearFailed && <span className="dt-storage-quota-clear-failed">clear failed</span>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Simulate-custom-quota control — attached tabs only (the caller gates
 * on the breakdown's presence). The value is MB like the browser's own
 * control; Enter commits, an empty commit or Reset clears the override.
 */
function QuotaSimulationRow({
  overrideActive,
  overrideFailed,
  onOverride,
}: {
  overrideActive: boolean;
  overrideFailed: boolean;
  onOverride: (quotaBytes: number | null) => void;
}) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed === '') {
      setInvalid(false);
      onOverride(null);
      return;
    }
    const mb = Number(trimmed);
    if (!Number.isFinite(mb) || mb < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onOverride(Math.round(mb * BYTES_PER_MB));
  };

  return (
    <div className="dt-storage-quota-simulate">
      <label className="dt-storage-quota-simulate-label">
        Simulate custom quota
        <input
          type="text"
          inputMode="decimal"
          placeholder="MB"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
      </label>
      {overrideActive && (
        <button
          type="button"
          className="dt-storage-quota-simulate-reset"
          onClick={() => {
            setValue('');
            setInvalid(false);
            onOverride(null);
          }}
        >
          Reset
        </button>
      )}
      {invalid ? (
        <span className="dt-storage-quota-clear-failed">enter a non-negative number</span>
      ) : overrideFailed ? (
        <span className="dt-storage-quota-clear-failed">simulation failed</span>
      ) : null}
    </div>
  );
}

/** Two-step inline confirm — first click arms, second commits. */
function ClearSiteDataButton({ onClear, disabled }: { onClear: () => void; disabled: boolean }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`dt-storage-clear${armed ? ' dt-storage-clear--armed' : ''}`}
      disabled={disabled}
      title={
        armed ? 'Deletes the checked data types for this origin' : 'Clear the checked site data for this origin'
      }
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onClear();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Confirm clear?' : 'Clear site data'}
    </button>
  );
}
