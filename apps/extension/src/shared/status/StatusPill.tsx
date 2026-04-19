/**
 * StatusPill — the single status indicator shown across every surface
 * (workspace footer, popup/sidepanel header). One component keeps the
 * popover body + color semantics identical across surfaces, so the user
 * sees the same truth wherever the extension is open.
 *
 * Three densities:
 *   - `row`     (default workspace footer): five always-visible pills,
 *     one per subsystem — `sync` / `rules` / `requests` / `permissions`
 *     / `secrets`. Each pill carries its label + a colored dot; the
 *     color reflects that subsystem's current state (green / yellow /
 *     red / grey-for-no-data). Clicking any pill opens the shared
 *     popover with the per-subsystem message list. Gives users a
 *     bird's-eye view now that every subsystem actively reports.
 *   - `full`    (legacy compact): dot + worst-state summary label.
 *     Kept for surfaces that can't fit the five-pill row but still
 *     want a text label (none today — available for future use).
 *   - `compact` (popup/sidepanel header): dot only, label moves to
 *     the tooltip. Zero width impact when healthy — the popup header
 *     is crowded, so the indicator has to stay out of the way unless
 *     something actually needs attention.
 */

import { Popover, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import type React from 'react';
import { useStatus } from '@/hooks/useStatus';
import { type StatusLevel, type StatusSnapshot, type StatusSubsystem, SUBSYSTEM_LABELS } from './types';

export const SUBSYSTEM_ORDER: StatusSubsystem[] = ['sync', 'rules', 'requests', 'permissions', 'secrets'];

export type StatusPillDensity = 'row' | 'full' | 'compact';

export interface StatusPillProps {
  density?: StatusPillDensity;
  /** Extra class to forward to the outer span — lets the workspace
   *  footer keep its `rules-statusbar-item` hit target styling. */
  className?: string;
  /**
   * Override the popover placement. Density-specific defaults:
   *   - `row`     → `top`    (workspace footer; opens upward)
   *   - `full`    → `top`    (legacy compact; opens upward)
   *   - `compact` → `bottom` (popup header; opens downward)
   *
   * The sidepanel surface is narrower than the popup, so the default
   * `bottom`/`right`-centered popover can clip against the sidepanel's
   * right edge. Callers there pass `right` / `bottomLeft` to flip the
   * opening direction.
   */
  placement?: TooltipPlacement;
}

const DEFAULT_PLACEMENT: Record<StatusPillDensity, TooltipPlacement> = {
  row: 'top',
  full: 'top',
  compact: 'bottom',
};

export const StatusPill: React.FC<StatusPillProps> = ({ density = 'row', className, placement }) => {
  const { token } = theme.useToken();
  const { snapshot, worst } = useStatus();
  const hasEntries = Object.values(snapshot).some(Boolean);
  const color = worst === 'red' ? token.colorError : worst === 'yellow' ? token.colorWarning : token.colorSuccess;
  const summary = buildSummary(snapshot, worst);
  const ariaLabel = `System status: ${summary}`;

  const body = <StatusPopoverBody snapshot={snapshot} token={token} />;
  const titleNode = (
    <Space size={6}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
        }}
      />
      <Typography.Text strong style={{ fontSize: 12 }}>
        System status
      </Typography.Text>
    </Space>
  );

  const effectivePlacement = placement ?? DEFAULT_PLACEMENT[density];

  if (density === 'row') {
    return (
      <Popover placement={effectivePlacement} trigger={['click']} content={body} title={titleNode}>
        <span
          className={className ?? 'rules-statusbar-item'}
          role="status"
          aria-label={ariaLabel}
          style={{ cursor: hasEntries ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {SUBSYSTEM_ORDER.map((sub) => (
            <SubsystemPill key={sub} subsystem={sub} snapshot={snapshot} token={token} />
          ))}
        </span>
      </Popover>
    );
  }

  if (density === 'compact') {
    return (
      <Popover placement={effectivePlacement} trigger={['click', 'hover']} content={body} title={titleNode}>
        <span
          className={className}
          role="status"
          aria-label={ariaLabel}
          style={{
            cursor: hasEntries ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
            }}
          />
        </span>
      </Popover>
    );
  }

  return (
    <Popover placement={effectivePlacement} trigger={['click', 'hover']} content={body} title={titleNode}>
      <span
        className={className ?? 'rules-statusbar-item'}
        role="status"
        style={{ cursor: hasEntries ? 'pointer' : 'default' }}
        aria-label={ariaLabel}
      >
        <span className="rules-dot" style={{ background: color }} />
        {summary}
      </span>
    </Popover>
  );
};

function buildSummary(snapshot: StatusSnapshot, worst: StatusLevel): string {
  if (worst === 'green') {
    return 'Healthy';
  }
  for (const sub of SUBSYSTEM_ORDER) {
    const entry = snapshot[sub];
    if (entry?.state === worst) {
      return `${SUBSYSTEM_LABELS[sub]}: ${truncate(entry.message, 50)}`;
    }
  }
  return worst === 'red' ? 'Failure' : 'Issues';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

interface SubsystemPillProps {
  subsystem: StatusSubsystem;
  snapshot: StatusSnapshot;
  token: ReturnType<typeof theme.useToken>['token'];
}

/**
 * One pill in the five-pill row. Color reflects the subsystem's own
 * state (green / yellow / red / grey when no entry has been recorded).
 * The whole row shares one Popover — this component renders only the
 * label + dot, and a per-subsystem tooltip with the latest message.
 */
const SubsystemPill: React.FC<SubsystemPillProps> = ({ subsystem, snapshot, token }) => {
  const entry = snapshot[subsystem];
  const state: StatusLevel | null = entry?.state ?? null;
  const dotColor =
    state === 'red'
      ? token.colorError
      : state === 'yellow'
        ? token.colorWarning
        : state === 'green'
          ? token.colorSuccess
          : token.colorTextTertiary;
  const tipBody = entry?.message ?? 'No events yet';
  return (
    <Tooltip title={tipBody} placement="top">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: token.colorTextSecondary,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor,
          }}
        />
        {SUBSYSTEM_LABELS[subsystem]}
      </span>
    </Tooltip>
  );
};

interface StatusPopoverBodyProps {
  snapshot: StatusSnapshot;
  token: ReturnType<typeof theme.useToken>['token'];
}

const StatusPopoverBody: React.FC<StatusPopoverBodyProps> = ({ snapshot, token }) => {
  return (
    <div style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {SUBSYSTEM_ORDER.map((sub) => {
        const entry = snapshot[sub];
        const state: StatusLevel = entry?.state ?? 'green';
        const color = state === 'red' ? 'error' : state === 'yellow' ? 'warning' : entry ? 'success' : 'default';
        return (
          <div key={sub} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Tag color={color} style={{ fontSize: 10, marginTop: 2, minWidth: 64, textAlign: 'center' }}>
              {SUBSYSTEM_LABELS[sub]}
            </Tag>
            <div style={{ flex: 1 }}>
              <Typography.Text style={{ fontSize: 11, display: 'block', color: token.colorText }}>
                {entry?.message ?? 'No events yet'}
              </Typography.Text>
              {entry?.timestamp && (
                <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </Typography.Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
