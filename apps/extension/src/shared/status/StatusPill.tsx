/**
 * StatusPill — the single compact status indicator shown on every
 * surface (workspace footer, popup/sidepanel header). One component
 * keeps the popover body + color semantics identical across surfaces,
 * so the user sees the same truth wherever the extension is open.
 *
 * Two densities:
 *   - `full`    (default): dot + worst-state summary label, used in the
 *     workspace footer where horizontal space is cheap.
 *   - `compact` (popup/sidepanel header): dot only, label moves to the
 *     tooltip. Zero width impact when healthy — the popup header is
 *     crowded, so the indicator has to stay out of the way unless
 *     something actually needs attention.
 *
 * The popover body is the same in both modes — clicking the dot
 * reveals every subsystem's current state.
 */

import { Popover, Space, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useStatus } from '@/hooks/useStatus';
import { type StatusLevel, type StatusSnapshot, type StatusSubsystem, SUBSYSTEM_LABELS } from './types';

export const SUBSYSTEM_ORDER: StatusSubsystem[] = ['sync', 'rules', 'requests', 'permissions', 'secrets'];

export type StatusPillDensity = 'full' | 'compact';

export interface StatusPillProps {
  density?: StatusPillDensity;
  /** Extra class to forward to the outer span — lets the workspace
   *  footer keep its `rules-statusbar-item` hit target styling. */
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ density = 'full', className }) => {
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

  if (density === 'compact') {
    return (
      <Popover placement="bottom" trigger={['click', 'hover']} content={body} title={titleNode}>
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
    <Popover placement="top" trigger={['click', 'hover']} content={body} title={titleNode}>
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
