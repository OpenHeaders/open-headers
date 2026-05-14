/**
 * Product-specific extras rendered inside the StatusPill popover.
 *
 * Keeps product copy OUT of the generic `StatusPill` component — the
 * pill exposes a `renderSubsystemExtras` hook, and this module is the
 * single place extension surfaces import to get a consistent set of
 * callouts across the popup, sidepanel, and workspace footer.
 *
 * Current callouts:
 *   - `sync` — note that the desktop app isn't shipped yet. The
 *     `sync` subsystem ALWAYS reports green "Desktop sync disabled"
 *     (the extension turns off `autoConnect` when there's no desktop
 *     to connect to) — the extra here makes the product timeline
 *     explicit instead of leaving users guessing whether the extension
 *     is broken.
 *
 * Add new subsystem callouts here as they arise; the `StatusPill`'s
 * own API doesn't need to change.
 */

import { Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
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
        <ExtrasRow tagColor="blue" label="Desktop App" message="coming soon" />
        <BootRegressionCallout />
      </>
    );
  }
  return null;
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
