/**
 * Product-specific extras rendered inside the StatusPill popover.
 *
 * Keeps product copy OUT of the generic `StatusPill` component — the
 * pill exposes a `renderSubsystemExtras` hook, and this module is the
 * single place that contributes cross-surface callouts.
 *
 * Add new subsystem callouts here as they arise; the `StatusPill`'s
 * own API doesn't need to change.
 */

import type { BackendConnection, BackendSyncStatus } from '@openheaders/core/types';
import { Button, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useBackends } from '../backend';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { requestSecretsRelaunch } from '../hooks/useSecretsStorageState';
import { STATUS_TAG_WIDTH } from './StatusPill';
import type { StatusEntry, StatusSubsystem } from './types';
import { useBootRegression } from './use-boot-regression';

/**
 * Render function matching `StatusPillProps.renderSubsystemExtras`.
 * Pass this to `<StatusPill renderSubsystemExtras={productStatusExtras} />`
 * to get the product-level callouts on every surface.
 *
 * Each callout mirrors the popover's built-in subsystem row layout
 * (tag on the left with min-width 64px, label text on the right) so
 * the extras line up visually with the standard rows — no bespoke
 * styling that would make them look like foreign elements.
 */
export function productStatusExtras(subsystem: StatusSubsystem, _entry: StatusEntry | undefined): React.ReactNode {
  if (subsystem === 'sync') {
    return (
      <>
        <BackendSyncBreakdown />
        <BootRegressionCallout />
      </>
    );
  }
  return null;
}

/**
 * Render function matching `StatusPillProps.renderSubsystemInlineAction`
 * — remedies that live INSIDE a subsystem's own row, right-aligned
 * after its message and sized to its 11px text.
 *
 * Secrets: a "Relaunch app" link while the host reports the at-rest
 * cipher unavailable (the desktop main stamps `context.cipher`; hosts
 * without a cipher seam never do). Relaunching is the one honest
 * remedy — a canceled keychain prompt is cached for the process
 * lifetime, so no in-process retry can succeed.
 */
export function productStatusInlineActions(
  subsystem: StatusSubsystem,
  entry: StatusEntry | undefined,
): React.ReactNode {
  if (subsystem === 'secrets' && entry?.state === 'red' && entry.context?.cipher === 'unavailable') {
    return (
      <Button
        type="link"
        danger
        size="small"
        onClick={requestSecretsRelaunch}
        data-testid="secrets-status-relaunch"
        style={{ fontSize: 11, height: 'auto', padding: 0, lineHeight: 1.2 }}
      >
        Relaunch app
      </Button>
    );
  }
  return null;
}

/**
 * Per-backend breakdown under the `sync` row — the worst-of pill names
 * one backend's state; with several connections the others' states are
 * invisible without this. One row per registry record reading its own
 * slot from the per-backend feed (`useBackendSyncStatus`), the same
 * wire truth as the settings connections list: `Off` for a disabled
 * record, `Connecting…` before its wire has spoken, then the slot's
 * live message. Hidden entirely while no backend is registered (tier
 * zero alone — the single `sync` row already says everything).
 */
const BackendSyncBreakdown: React.FC = () => {
  const backends = useBackends();
  const { snapshot } = useBackendSyncStatus();
  if (backends.length === 0) return null;
  return (
    <>
      {backends.map((record) => (
        <BackendSyncRow key={record.id} record={record} entry={snapshot[record.id]} />
      ))}
    </>
  );
};

const BackendSyncRow: React.FC<{ record: BackendConnection; entry: BackendSyncStatus | undefined }> = ({
  record,
  entry,
}) => {
  const label = record.label.trim() || record.url;
  const { tagColor, message } = backendRowVisual(record, entry);
  return (
    <Tooltip title={`${record.url} — ${message}`} placement="top">
      <div>
        <ExtrasRow tagColor={tagColor} label={label} message={message} />
      </div>
    </Tooltip>
  );
};

function backendRowVisual(
  record: BackendConnection,
  entry: BackendSyncStatus | undefined,
): { tagColor: string; message: string } {
  if (!record.enabled) return { tagColor: 'default', message: 'Off' };
  if (!entry) return { tagColor: 'warning', message: 'Connecting…' };
  const tagColor = entry.state === 'red' ? 'error' : entry.state === 'yellow' ? 'warning' : 'success';
  return { tagColor, message: entry.message };
}

/**
 * T3 boot-regression surface — renders only when the gate has tripped
 * and the baseline is pinned. The verdict is computed in the renderer
 * (`use-boot-regression.ts`) by feeding the recent `boot.interactive`
 * samples into the pure decision module
 * (`@openheaders/core/sync` → `boot-regression`). Suppressed entirely while the
 * baseline is 0 so we don't surface a meaningless "no regression" pill
 * before measurement.
 */
const BootRegressionCallout: React.FC = () => {
  const { verdict, baselinePending } = useBootRegression();
  if (baselinePending) return null;
  if (!verdict.regressed) return null;
  const tooltip =
    `Three consecutive cold wakes exceeded baseline by ≥20%. ` +
    `Recent boot.interactive samples (ms): ${verdict.offending.join(', ')}.`;
  return (
    <Tooltip title={tooltip} placement="top">
      <div>
        <ExtrasRow
          tagColor="orange"
          label="Cold start"
          message="Performance regression detected — see diagnostic export"
        />
      </div>
    </Tooltip>
  );
};

interface ExtrasRowProps {
  tagColor: string;
  label: string;
  message: string;
}

const ExtrasRow: React.FC<ExtrasRowProps> = ({ tagColor, label, message }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Tag color={tagColor} style={{ fontSize: 10, width: STATUS_TAG_WIDTH, textAlign: 'center', margin: 0 }}>
      {label}
    </Tag>
    <Typography.Text style={{ fontSize: 11, flex: 1 }}>{message}</Typography.Text>
  </div>
);
