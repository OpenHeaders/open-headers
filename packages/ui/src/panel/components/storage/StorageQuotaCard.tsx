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
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { MessageKey } from '@openheaders/i18n';
import { useState } from 'react';
import type { SiteDataType } from '../../data/storage/storage-inspector-host';
import type { StorageQuotaState } from '../../data/storage/use-storage-quota';
import { formatSize } from '../traffic/formatters';
import { CookieIcon, DatabaseIcon, TableIcon, WorkerGearIcon } from './StorageNavIcons';

/** Breakdown row labels — keyed where product copy, WebSQL stays the
 *  raw proper noun; unknown wire types fall back to the raw token. */
const STORAGE_TYPE_LABEL_KEYS: Record<string, MessageKey> = {
  indexeddb: 'panel.storage.nav.indexeddb',
  cache_storage: 'panel.storage.nav.cachestorage',
  service_workers: 'panel.storage.quota.type.serviceWorkers',
  file_systems: 'panel.storage.quota.type.fileSystems',
  other: 'panel.storage.quota.type.other',
};

/* Labels, icons AND order mirror the storage rail (label keys reuse the
 * nav keys). Session storage is per-tab by nature (the browser's
 * site-data clear can't reach it), so its leg wipes the INSPECTED tab's
 * frame — the note says so. */
const SITE_DATA_CHOICES: ReadonlyArray<{
  type: SiteDataType;
  labelKey: MessageKey;
  icon: React.ReactNode;
  noteKey?: MessageKey;
}> = [
  { type: 'localStorage', labelKey: 'panel.storage.nav.local', icon: <TableIcon /> },
  {
    type: 'sessionStorage',
    labelKey: 'panel.storage.nav.session',
    icon: <TableIcon />,
    noteKey: 'panel.storage.quota.sessionNote',
  },
  { type: 'cookies', labelKey: 'panel.storage.nav.cookies', icon: <CookieIcon /> },
  { type: 'indexedDB', labelKey: 'panel.storage.nav.indexeddb', icon: <DatabaseIcon /> },
  { type: 'cacheStorage', labelKey: 'panel.storage.nav.cachestorage', icon: <DatabaseIcon /> },
  { type: 'serviceWorkers', labelKey: 'panel.storage.quota.type.serviceWorkers', icon: <WorkerGearIcon /> },
];

/** MB the way the browser reads it — decimal, not 1024-based. */
const BYTES_PER_MB = 1_000_000;

function storageTypeLabel(t: Translate, storageType: string): string {
  if (storageType === 'websql') return 'WebSQL';
  const key = STORAGE_TYPE_LABEL_KEYS[storageType];
  return key !== undefined ? t(key) : storageType.replace(/_/g, ' ');
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
  const t = useT();
  const snapshot = quota.quota;
  if (snapshot === null) {
    return quota.loading ? (
      <div className="dt-empty">{t('panel.storage.empty.loading')}</div>
    ) : (
      <div className="dt-empty-hero">
        <strong>{t('panel.storage.quota.cantReadTitle')}</strong>
        <span className="dt-empty-hero-sub">{t('panel.storage.quota.cantReadSub')}</span>
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
        <span className="dt-storage-quota-usage">
          {t('panel.storage.quota.used', { size: formatSize(snapshot.usage) })}
        </span>
        <span className="dt-storage-quota-limit">
          {t('panel.storage.quota.ofTotal', { size: formatSize(snapshot.quota), percent: percentLabel })}
        </span>
      </div>
      <div className="dt-storage-quota-bar" role="progressbar" aria-valuenow={Math.round(usedPercent)}>
        <div className="dt-storage-quota-bar-fill" style={{ width: `${fillPercent}%` }} />
      </div>
      {rows.length > 0 ? (
        <div className="dt-storage-quota-rows">
          {rows.map((row) => (
            <div className="dt-storage-quota-row" key={row.storageType}>
              <span className="dt-storage-quota-row-label">{storageTypeLabel(t, row.storageType)}</span>
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
        <div className="dt-storage-quota-hint">{t('panel.storage.quota.noBreakdown')}</div>
      ) : hasCapability('cdpInspection') ? (
        <div className="dt-storage-quota-hint">{t('panel.storage.quota.debugHint')}</div>
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
          <span className="dt-storage-quota-clear-types-caption" title={t('panel.storage.quota.targetsTitle')}>
            {t('panel.storage.quota.targetsCaption')}
          </span>
          {SITE_DATA_CHOICES.map(({ type, labelKey, icon, noteKey }) => (
            <label
              className={`dt-storage-quota-clear-type${
                highlightTargets && !excluded.has(type) ? ' dt-storage-quota-clear-type--targeted' : ''
              }`}
              key={type}
              title={noteKey !== undefined ? t(noteKey) : undefined}
            >
              <input type="checkbox" checked={!excluded.has(type)} onChange={() => onToggleType(type)} />
              <span className="dt-storage-nav-icon">{icon}</span>
              {t(labelKey)}
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
  const t = useT();
  if (!hasCapability('originDataClearing') || quota.quota === null) return null;
  const selected = SITE_DATA_CHOICES.filter(({ type }) => !excluded.has(type)).map(({ type }) => type);
  return (
    <span className="dt-storage-clear-group">
      {quota.clearFailed ? (
        <span className="dt-storage-quota-clear-failed">{t('panel.storage.clearFailed')}</span>
      ) : quota.clearSucceeded ? (
        <span className="dt-storage-quota-clear-done" role="status">
          {t('panel.storage.cleared')}
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
  const t = useT();
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
      <label className="dt-storage-quota-simulate-label" title={t('panel.storage.quota.simulateTitle')}>
        {t('panel.storage.quota.simulateLabel')}
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
            {t('panel.storage.quota.simulateSave')}
          </button>
          <button type="button" className="dt-storage-quota-simulate-reset" onClick={cancel}>
            {t('panel.storage.quota.simulateCancel')}
          </button>
        </>
      )}
      {overrideActive && (
        <button
          type="button"
          className="dt-storage-quota-simulate-reset"
          title={t('panel.storage.quota.simulateResetTitle')}
          onClick={() => {
            cancel();
            onOverride(null);
          }}
        >
          {t('panel.storage.quota.simulateReset')}
        </button>
      )}
      {invalid ? (
        <span className="dt-storage-quota-clear-failed">{t('panel.storage.quota.simulateRange', { max: maxMb })}</span>
      ) : overrideFailed ? (
        <span className="dt-storage-quota-clear-failed">{t('panel.storage.quota.simulateFailed')}</span>
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
  const t = useT();
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`dt-storage-clear${armed ? ' dt-storage-clear--armed' : ''}`}
      disabled={disabled}
      title={armed ? t('panel.storage.quota.clearArmedTitle') : t('panel.storage.quota.clearTitle')}
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
      {armed ? t('panel.storage.confirmClear') : t('panel.storage.quota.clearEverything')}
    </button>
  );
}
