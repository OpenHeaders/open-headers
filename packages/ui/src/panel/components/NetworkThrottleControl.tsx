/**
 * Network-throttle toolbar dropdown (CDP Control Plane, Phase F2). A
 * Chrome-style sectioned menu — No throttling · Presets · Custom — beside the
 * "Disable cache" toggle.
 *
 * Throttling has NO standard-mode fallback (`Network.emulateNetworkConditions`
 * is the only mechanism), so the control is DISABLED whenever the inspected tab
 * is not CDP-controlled; the hover tooltip and the (i) popover both point the
 * user at Debug mode. This is the never-silent surface for the conditions plane:
 * the user can only set a profile that will actually take effect.
 */

import type { NetworkThrottleConditions } from '@openheaders/core/types';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Dropdown, InputNumber, type MenuProps, Modal, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import {
  NO_THROTTLE_LABEL,
  THROTTLE_PRESETS,
  type ThrottleProfileKey,
  conditionsForPreset,
  profileLabel,
} from '../data/network-throttle-presets';
import { buildThrottleInfo } from './debug-controls-info';

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

function checkLabel(active: boolean, text: string): React.ReactNode {
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <span style={{ width: 10, display: 'inline-block' }}>{active ? '✓' : ''}</span>
      {text}
    </span>
  );
}

export const NetworkThrottleControl: React.FC<NetworkThrottleControlProps> = ({
  profileKey,
  conditions,
  setConditions,
  cdpOwned,
  onEnableDebug,
}) => {
  const [customOpen, setCustomOpen] = useState(false);
  const [downloadKbit, setDownloadKbit] = useState(1000);
  const [uploadKbit, setUploadKbit] = useState(1000);
  const [latencyMs, setLatencyMs] = useState(0);

  const openCustom = (): void => {
    // Prefill from the active profile when it is already a custom value.
    if (conditions && profileKey === 'custom') {
      setDownloadKbit(Math.round(conditions.downloadThroughputBps / BYTES_PER_KBIT));
      setUploadKbit(Math.round(conditions.uploadThroughputBps / BYTES_PER_KBIT));
      setLatencyMs(conditions.latencyMs);
    }
    setCustomOpen(true);
  };

  const applyCustom = (): void => {
    setConditions({
      offline: false,
      latencyMs,
      downloadThroughputBps: downloadKbit * BYTES_PER_KBIT,
      uploadThroughputBps: uploadKbit * BYTES_PER_KBIT,
    });
    setCustomOpen(false);
  };

  const items: MenuProps['items'] = [
    { key: 'none', label: checkLabel(profileKey === 'none', NO_THROTTLE_LABEL) },
    { type: 'divider' },
    {
      key: 'presets',
      type: 'group',
      label: 'Presets',
      children: THROTTLE_PRESETS.map((preset) => ({
        key: preset.key,
        label: checkLabel(profileKey === preset.key, preset.label),
      })),
    },
    { type: 'divider' },
    {
      key: 'custom',
      type: 'group',
      label: 'Custom',
      children: [{ key: 'custom-add', label: checkLabel(profileKey === 'custom', profileKey === 'custom' ? 'Custom…' : 'Add…') }],
    },
  ];

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'none') setConditions(null);
    else if (key === 'custom-add') openCustom();
    else setConditions(conditionsForPreset(key as 'slow-3g' | 'fast-3g' | 'offline'));
  };

  const trigger = (
    <button type="button" className="dt-toolbar-dropdown dt-throttle-trigger" disabled={!cdpOwned}>
      <span>{profileLabel(profileKey)}</span>
      <span className="dt-toolbar-dropdown-caret">▾</span>
    </button>
  );

  return (
    <span className="dt-debug-control">
      {cdpOwned ? (
        <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} placement="bottomLeft">
          {trigger}
        </Dropdown>
      ) : (
        <Tooltip
          title="Network throttling is available only in Debug mode. Enable Debug mode to throttle this tab."
          placement="bottom"
        >
          {/* span wrapper so the tooltip shows over the disabled trigger */}
          <span className="dt-throttle-disabled-wrap">{trigger}</span>
        </Tooltip>
      )}
      <InfoTrigger content={buildThrottleInfo({ cdpOwned, onEnableDebug })} ariaLabel="About network throttling" />

      <Modal
        title="Custom throttling profile"
        open={customOpen}
        onOk={applyCustom}
        onCancel={() => setCustomOpen(false)}
        okText="Apply"
        width={360}
      >
        <div className="dt-throttle-custom-form">
          <label className="dt-throttle-custom-row">
            <span>Download</span>
            <InputNumber
              min={0}
              value={downloadKbit}
              onChange={(v) => setDownloadKbit(v ?? 0)}
              addonAfter="kbit/s"
              style={{ width: 160 }}
            />
          </label>
          <label className="dt-throttle-custom-row">
            <span>Upload</span>
            <InputNumber
              min={0}
              value={uploadKbit}
              onChange={(v) => setUploadKbit(v ?? 0)}
              addonAfter="kbit/s"
              style={{ width: 160 }}
            />
          </label>
          <label className="dt-throttle-custom-row">
            <span>Latency</span>
            <InputNumber
              min={0}
              value={latencyMs}
              onChange={(v) => setLatencyMs(v ?? 0)}
              addonAfter="ms"
              style={{ width: 160 }}
            />
          </label>
        </div>
      </Modal>
    </span>
  );
};
