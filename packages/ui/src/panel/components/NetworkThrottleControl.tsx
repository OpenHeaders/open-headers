/**
 * Network-throttle toolbar dropdown (CDP Control Plane, Phase F2). A compact
 * sectioned menu — No throttling · Presets · Custom — built on the shared
 * `ToolbarMenuPopover` so it matches every other toolbar dropdown's size and
 * look. The Custom profile opens a hover submenu (download / upload / latency)
 * rather than a modal, mirroring the requests table's Sort "Custom (nested)"
 * builder.
 *
 * Throttling has NO standard-mode fallback (`Network.emulateNetworkConditions`
 * is the only mechanism), so the trigger is DISABLED whenever the inspected tab
 * is not CDP-controlled; the hover tooltip and the (i) popover both point the
 * user at Debug mode. This is the never-silent surface for the conditions plane:
 * the user can only set a profile that will actually take effect.
 */

import { CheckOutlined, RightOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import type { NetworkThrottleConditions } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Popover, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  THROTTLE_PRESETS,
  type ThrottlePreset,
  type ThrottleProfileKey,
  profileLabel,
} from '../data/network-throttle-presets';
import { buildThrottleInfo } from './debug-controls-info';
import { ToolbarMenuPopover } from './ToolbarMenuPopover';

export interface NetworkThrottleControlProps {
  profileKey: ThrottleProfileKey;
  conditions: NetworkThrottleConditions | null;
  setConditions: (conditions: NetworkThrottleConditions | null) => void;
  /** The inspected tab is CDP-controlled — throttling is operable. */
  cdpOwned: boolean;
  /** Renders an "Enable Debug mode" action in the (i) popover when set. */
  onEnableDebug?: () => void;
}

/** bytes/second ↔ kbit/second — the unit the custom form presents. */
const BYTES_PER_KBIT = 125;

/** One-line speed/latency hint under each preset, mirroring the (i) popover. */
const PRESET_SUBTITLE_KEYS: Record<ThrottlePreset['key'], MessageKey> = {
  fiber: 'panel.throttle.subtitle.fiber',
  cable: 'panel.throttle.subtitle.cable',
  dsl: 'panel.throttle.subtitle.dsl',
  'fast-5g': 'panel.throttle.subtitle.fast5g',
  'slow-5g': 'panel.throttle.subtitle.slow5g',
  'fast-4g': 'panel.throttle.subtitle.fast4g',
  'slow-4g': 'panel.throttle.subtitle.slow4g',
  '3g': 'panel.throttle.subtitle.3g',
  'fast-2g': 'panel.throttle.subtitle.fast2g',
  'slow-2g': 'panel.throttle.subtitle.slow2g',
  offline: 'panel.throttle.subtitle.offline',
};

// The directly-shown mobile defaults, the standalone Offline row, and the two
// "More presets" submenu groups — derived once from the static preset table.
const COMMON_PRESETS = THROTTLE_PRESETS.filter((p) => p.group === 'common' && p.key !== 'offline');
const OFFLINE_PRESET = THROTTLE_PRESETS.find((p) => p.key === 'offline');
const WIRED_PRESETS = THROTTLE_PRESETS.filter((p) => p.group === 'wired');
const MOBILE_PRESETS = THROTTLE_PRESETS.filter((p) => p.group === 'mobile');

export const NetworkThrottleControl: React.FC<NetworkThrottleControlProps> = ({
  profileKey,
  conditions,
  setConditions,
  cdpOwned,
  onEnableDebug,
}) => {
  const t = useT();
  const [downloadKbit, setDownloadKbit] = useState(1000);
  const [uploadKbit, setUploadKbit] = useState(1000);
  const [latencyMs, setLatencyMs] = useState(0);

  // Keep the custom inputs seeded from the active custom profile so the submenu
  // reflects what's actually applied (no-op when it isn't a custom value).
  useEffect(() => {
    if (profileKey === 'custom' && conditions) {
      setDownloadKbit(Math.round(conditions.downloadThroughputBps / BYTES_PER_KBIT));
      setUploadKbit(Math.round(conditions.uploadThroughputBps / BYTES_PER_KBIT));
      setLatencyMs(conditions.latencyMs);
    }
  }, [profileKey, conditions]);

  const applyCustom = (): void => {
    setConditions({
      offline: false,
      latencyMs,
      downloadThroughputBps: downloadKbit * BYTES_PER_KBIT,
      uploadThroughputBps: uploadKbit * BYTES_PER_KBIT,
    });
  };

  const trigger = cdpOwned ? (
    <ToolbarMenuPopover label={profileLabel(t, profileKey)} activeCount={0} active={false} placement="bottomLeft">
      <ThrottleRow title={t('panel.throttle.none')} active={profileKey === 'none'} onClick={() => setConditions(null)} />
      <div className="dt-morefilters-divider" />
      {COMMON_PRESETS.map((preset) => (
        <ThrottleRow
          key={preset.key}
          title={preset.label}
          subtitle={t(PRESET_SUBTITLE_KEYS[preset.key])}
          active={profileKey === preset.key}
          onClick={() => setConditions(preset.conditions)}
        />
      ))}
      <MorePresetsRow t={t} activeKey={profileKey} onPick={setConditions} />
      {OFFLINE_PRESET && (
        <ThrottleRow
          title={OFFLINE_PRESET.label}
          subtitle={t(PRESET_SUBTITLE_KEYS.offline)}
          active={profileKey === 'offline'}
          onClick={() => setConditions(OFFLINE_PRESET.conditions)}
        />
      )}
      <div className="dt-morefilters-divider" />
      <CustomThrottleRow
        t={t}
        active={profileKey === 'custom'}
        download={downloadKbit}
        upload={uploadKbit}
        latency={latencyMs}
        onDownload={setDownloadKbit}
        onUpload={setUploadKbit}
        onLatency={setLatencyMs}
        onApply={applyCustom}
      />
    </ToolbarMenuPopover>
  ) : (
    <Tooltip title={t('panel.throttle.disabledTooltip')} placement="bottom">
      {/* span wrapper so the tooltip shows over the disabled trigger */}
      <span className="dt-throttle-disabled-wrap">
        <button type="button" className="dt-toolbar-dropdown dt-throttle-trigger" disabled>
          <span>{profileLabel(t, profileKey)}</span>
          <span className="dt-toolbar-dropdown-caret">▾</span>
        </button>
      </span>
    </Tooltip>
  );

  return (
    <span className="dt-debug-control">
      {trigger}
      <InfoTrigger
        content={buildThrottleInfo(t, { cdpOwned, onEnableDebug })}
        className="dt-header-info-trigger dt-debug-info-trigger"
        ariaLabel={t('panel.throttle.aboutAria')}
      />
    </span>
  );
};

/** A single pick-one row in the throttle menu — title (+ optional subtitle)
 *  with a right-aligned checkmark when it's the active profile. */
function ThrottleRow({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string;
  subtitle?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dt-sortmode-item" onClick={onClick}>
      <div className="dt-sortmode-item-body">
        <div className="dt-sortmode-item-title">{title}</div>
        {subtitle && <div className="dt-sortmode-item-subtitle">{subtitle}</div>}
      </div>
      {active && (
        <span className="dt-sortmode-item-check" aria-hidden="true">
          <CheckOutlined />
        </span>
      )}
    </button>
  );
}

/** The "More presets" group row — hovering it opens a submenu with the wider
 *  catalogue (wired + extra mobile tiers), the same shape as the Sort groups. */
function MorePresetsRow({
  t,
  activeKey,
  onPick,
}: {
  t: Translate;
  activeKey: ThrottleProfileKey;
  onPick: (conditions: NetworkThrottleConditions) => void;
}) {
  const active = [...WIRED_PRESETS, ...MOBILE_PRESETS].some((p) => p.key === activeKey);
  const rows = (presets: readonly ThrottlePreset[]) =>
    presets.map((p) => (
      <ThrottleRow
        key={p.key}
        title={p.label}
        subtitle={t(PRESET_SUBTITLE_KEYS[p.key])}
        active={activeKey === p.key}
        onClick={() => onPick(p.conditions)}
      />
    ));
  const submenu = (
    <div className="dt-sortmode-submenu dt-scrollbar" role="menu">
      <div className="dt-sortmode-heading">{t('panel.throttle.wired')}</div>
      {rows(WIRED_PRESETS)}
      <div className="dt-morefilters-divider" />
      <div className="dt-sortmode-heading">{t('panel.throttle.mobile')}</div>
      {rows(MOBILE_PRESETS)}
    </div>
  );
  return (
    <Popover
      content={submenu}
      trigger="hover"
      placement="rightTop"
      arrow={false}
      overlayClassName="dt-morefilters-popover dt-sortmode-submenu-popover"
      mouseEnterDelay={0.05}
      mouseLeaveDelay={0.1}
    >
      <div className="dt-sortmode-item dt-sortmode-item--group">
        <div className="dt-sortmode-item-body">
          <div className="dt-sortmode-item-title">{t('panel.throttle.morePresets')}</div>
          <div className="dt-sortmode-item-subtitle">{t('panel.throttle.morePresetsSubtitle')}</div>
        </div>
        {active && (
          <span className="dt-sortmode-item-check" aria-hidden="true">
            <CheckOutlined />
          </span>
        )}
        <span className="dt-sortmode-item-chevron" aria-hidden="true">
          <RightOutlined />
        </span>
      </div>
    </Popover>
  );
}

/** The "Custom…" group row — hovering it opens a builder submenu with the
 *  download / upload / latency fields, the same shape as the Sort builder. */
function CustomThrottleRow({
  t,
  active,
  download,
  upload,
  latency,
  onDownload,
  onUpload,
  onLatency,
  onApply,
}: {
  t: Translate;
  active: boolean;
  download: number;
  upload: number;
  latency: number;
  onDownload: (v: number) => void;
  onUpload: (v: number) => void;
  onLatency: (v: number) => void;
  onApply: () => void;
}) {
  const submenu = (
    <div className="dt-sortmode-submenu dt-sortmode-submenu--builder dt-scrollbar" role="menu">
      <div className="dt-sortmode-builder-title">{t('panel.throttle.customTitle')}</div>
      <label className="dt-throttle-custom-row">
        <span className="dt-throttle-custom-label">{t('panel.throttle.download')}</span>
        <input type="number" min={0} value={download} onChange={(e) => onDownload(Number(e.target.value) || 0)} />
        <span className="dt-throttle-custom-unit">kbit/s</span>
      </label>
      <label className="dt-throttle-custom-row">
        <span className="dt-throttle-custom-label">{t('panel.throttle.upload')}</span>
        <input type="number" min={0} value={upload} onChange={(e) => onUpload(Number(e.target.value) || 0)} />
        <span className="dt-throttle-custom-unit">kbit/s</span>
      </label>
      <label className="dt-throttle-custom-row">
        <span className="dt-throttle-custom-label">{t('panel.throttle.latency')}</span>
        <input type="number" min={0} value={latency} onChange={(e) => onLatency(Number(e.target.value) || 0)} />
        <span className="dt-throttle-custom-unit">ms</span>
      </label>
      <div className="dt-sortmode-builder-footer">
        <span className="dt-sortmode-builder-tiebreak">{t('panel.throttle.appliesToTab')}</span>
        <button type="button" className="dt-sortmode-builder-apply" onClick={onApply}>
          {t('panel.debug.apply')}
        </button>
      </div>
    </div>
  );
  const subtitle = active ? `${download}/${upload} kbit/s · ${latency} ms` : t('panel.throttle.customHint');
  return (
    <Popover
      content={submenu}
      trigger="hover"
      placement="rightTop"
      arrow={false}
      overlayClassName="dt-morefilters-popover dt-sortmode-submenu-popover"
      mouseEnterDelay={0.05}
      mouseLeaveDelay={0.1}
    >
      <div className="dt-sortmode-item dt-sortmode-item--group">
        <div className="dt-sortmode-item-body">
          <div className="dt-sortmode-item-title">{t('panel.throttle.customEllipsis')}</div>
          <div className="dt-sortmode-item-subtitle">{subtitle}</div>
        </div>
        {active && (
          <span className="dt-sortmode-item-check" aria-hidden="true">
            <CheckOutlined />
          </span>
        )}
        <span className="dt-sortmode-item-chevron" aria-hidden="true">
          <RightOutlined />
        </span>
      </div>
    </Popover>
  );
}
