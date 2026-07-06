/**
 * NotificationsPanel — the Notifications tool window.
 *
 * Renders the session timeline from the notifications store newest
 * first: severity glyph, title, wall-clock time, optional description
 * and action links per entry, with a Clear-all affordance on the
 * Timeline header. Mounting (and every entry that arrives while
 * mounted) marks the timeline seen, which clears the bell dot.
 */

import {
  BellOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
} from '@ant-design/icons';
import { Button, Empty, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import {
  clearAllNotifications,
  dismissNotification,
  markAllNotificationsSeen,
  type NotificationEntry,
  type NotificationSeverity,
  useNotifications,
} from './store';

/** Title-bar `(i)` popover copy — shared so every surface's tool-window
 *  registry describes the panel identically. */
export const NOTIFICATIONS_PANEL_INFO: InfoPopoverContent = {
  title: 'Notifications',
  summary:
    'Session timeline of app events — update availability, background task outcomes, and other notices, collected here instead of interrupting your work.',
};

interface NotificationsPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  onClose: () => void;
}

const SEVERITY_ICON: Record<NotificationSeverity, React.ReactNode> = {
  info: <InfoCircleFilled style={{ color: '#1677ff' }} />,
  success: <CheckCircleFilled style={{ color: '#52c41a' }} />,
  warning: <ExclamationCircleFilled style={{ color: '#faad14' }} />,
  error: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
};

// Hour cycle comes from `appearance.clockFormat` rather than the locale:
// the browser locale reflects the Chrome UI language (often en-US), not
// the OS region format, so locale-driven formatting shows AM/PM to
// users whose system runs a 24-hour clock.
function formatTime(ts: number, clockFormat: '24h' | '12h'): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: clockFormat === '24h' ? 'h23' : 'h12',
  });
}

const NotificationCard: React.FC<{ entry: NotificationEntry }> = ({ entry }) => {
  const { token } = theme.useToken();
  const clockFormat = useSettingValue('appearance.clockFormat');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: token.colorFillQuaternary,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: '20px', flex: 'none' }}>
        {entry.icon ?? SEVERITY_ICON[entry.severity]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: token.colorText }}>
            {entry.title}
          </span>
          <span style={{ fontSize: 11, color: token.colorTextTertiary, flex: 'none' }}>
            {formatTime(entry.timestamp, clockFormat)}
          </span>
        </div>
        {entry.description && (
          <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.45 }}>
            {entry.description}
          </div>
        )}
        {entry.actions && entry.actions.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', gap: 12 }}>
            {entry.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.run}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  color: token.colorPrimary,
                  cursor: 'pointer',
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <Tooltip title="Dismiss">
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined style={{ fontSize: 10 }} />}
          onClick={() => dismissNotification(entry.id)}
          style={{ width: 20, height: 20, minWidth: 20, color: token.colorTextTertiary, flex: 'none' }}
        />
      </Tooltip>
    </div>
  );
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ info, onClose }) => {
  const { token } = theme.useToken();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const entries = useNotifications();

  // Acknowledge on CLOSE, not on open: the bell dot stays lit while the
  // panel is up (including for entries that arrive mid-view) and clears
  // when the user leaves it — closing is the "I've seen these" gesture.
  // A fresh entry after that re-lights the dot.
  useEffect(
    () => () => {
      markAllNotificationsSeen();
    },
    [],
  );

  return (
    <div
      className="rules-right-panel rules-right-panel--notifications"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PanelHeader wiring={wiring} title={<strong>Notifications</strong>} info={info} />
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: token.colorTextSecondary }}>Timeline</span>
          <Button
            size="small"
            type="link"
            onClick={clearAllNotifications}
            disabled={entries.length === 0}
            style={{ fontSize: 12, padding: 0, height: 'auto' }}
          >
            Clear all
          </Button>
        </div>
        {entries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 16px',
            }}
          >
            <Empty
              image={<BellOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />}
              imageStyle={{ height: 40 }}
              description={
                <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                  No notifications — app events and updates will appear here.
                </span>
              }
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((entry) => (
              <NotificationCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
