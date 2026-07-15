/**
 * NotificationsPanel — the Notifications tool window.
 *
 * Two stacked sections behind a draggable sash (the same Allotment
 * idiom as the dock regions): Suggestions on top — standing advice
 * about the user's setup, primary action as a bordered button, the
 * rest as links — and the session Timeline below, newest first:
 * severity glyph, title, wall-clock time, optional description and
 * action links per entry, with a Clear-all affordance on the Timeline
 * header. Mounting (and every entry that arrives while mounted) marks
 * the timeline seen, which clears the bell dot.
 */

import {
  BellOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  MoreOutlined,
} from '@ant-design/icons';
import { Allotment } from 'allotment';
import { Button, Dropdown, Empty, type MenuProps, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import {
  clearAllNotifications,
  clearAllSuggestions,
  dismissByKey,
  dismissNotification,
  markAllNotificationsSeen,
  muteNotificationKey,
  type NotificationAction,
  type NotificationEntry,
  type NotificationSeverity,
  pushNotification,
  type SuggestionEntry,
  unmuteNotificationKey,
  useNotifications,
  useSuggestions,
} from './store';

/** Title-bar `(i)` popover copy — shared so every surface's tool-window
 *  registry describes the panel identically. */
export function getNotificationsPanelInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('shared.notifications.title'),
    summary: t('shared.notifications.info.summary'),
  };
}

interface NotificationsPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  onClose: () => void;
}

// Sash bounds for the Suggestions pane — never collapses away, never
// squeezes the Timeline out of view.
const SUGGESTIONS_MIN_HEIGHT = 64;
const SUGGESTIONS_MAX_HEIGHT = 320;
const SUGGESTIONS_PREFERRED_HEIGHT = 140;
const TIMELINE_MIN_HEIGHT = 120;

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

const ActionLink: React.FC<{ action: NotificationAction }> = ({ action }) => {
  const { token } = theme.useToken();
  const button = (
    <button
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
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecoration = 'underline';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = 'none';
      }}
    >
      {action.icon}
      {action.label}
    </button>
  );
  return action.tooltip ? <Tooltip title={action.tooltip}>{button}</Tooltip> : button;
};

/**
 * Mute a card's dedupe key and drop a confirmation into the Timeline
 * with a Re-enable action (mirrors the IDE convention), so "Don't show
 * again" is discoverable to undo. The notice dismisses itself when
 * re-enabled.
 */
function muteWithNotice(t: Translate, dedupeKey: string, title: string): void {
  muteNotificationKey(dedupeKey);
  const noticeKey = `unmute:${dedupeKey}`;
  pushNotification({
    severity: 'info',
    title: t('shared.notifications.muted.title'),
    description: t('shared.notifications.muted.description', { title }),
    dedupeKey: noticeKey,
    actions: [
      {
        label: t('shared.notifications.muted.reEnable'),
        tooltip: t('shared.notifications.muted.reEnableTooltip'),
        run: () => {
          unmuteNotificationKey(dedupeKey);
          dismissByKey(noticeKey);
        },
      },
    ],
  });
}

/**
 * Hover "⋮" menu on keyed cards — mutes the entry's dedupe key for
 * good. `onOpenChange` keeps the trigger visible while the menu is up
 * even after the pointer leaves the card.
 */
const CardMuteMenu: React.FC<{
  dedupeKey: string;
  title: string;
  visible: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ dedupeKey, title, visible, onOpenChange }) => {
  const { token } = theme.useToken();
  const t = useT();
  const items: MenuProps['items'] = [
    {
      key: 'mute',
      label: t('shared.notifications.dontShowAgain'),
      onClick: () => muteWithNotice(t, dedupeKey, title),
    },
  ];
  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight" onOpenChange={onOpenChange}>
      <Button
        size="small"
        type="text"
        aria-label={t('shared.notifications.moreActions')}
        icon={<MoreOutlined style={{ fontSize: 12 }} />}
        style={{
          width: 20,
          height: 20,
          minWidth: 20,
          color: token.colorTextTertiary,
          flex: 'none',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />
    </Dropdown>
  );
};

const NotificationCard: React.FC<{ entry: NotificationEntry }> = ({ entry }) => {
  const { token } = theme.useToken();
  const t = useT();
  const clockFormat = useSettingValue('appearance.clockFormat');
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: hover || menuOpen ? token.colorFillTertiary : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: '20px', flex: 'none' }}>
        {entry.icon ?? SEVERITY_ICON[entry.severity]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: token.colorText }}>
            {entry.title}
          </span>
          {entry.dedupeKey !== undefined && !entry.sticky && (
            <CardMuteMenu
              dedupeKey={entry.dedupeKey}
              title={entry.title}
              visible={hover || menuOpen}
              onOpenChange={setMenuOpen}
            />
          )}
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
              <ActionLink key={action.label} action={action} />
            ))}
          </div>
        )}
      </div>
      {!entry.sticky && (
        <Tooltip title={t('shared.notifications.dismiss')}>
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            onClick={() => dismissNotification(entry.id)}
            style={{ width: 20, height: 20, minWidth: 20, color: token.colorTextTertiary, flex: 'none' }}
          />
        </Tooltip>
      )}
    </div>
  );
};

const SuggestionCard: React.FC<{ entry: SuggestionEntry }> = ({ entry }) => {
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [primary, ...rest] = entry.actions ?? [];
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 8,
        background: hover || menuOpen ? token.colorFillQuaternary : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: '20px', flex: 'none' }}>
        {entry.icon ?? SEVERITY_ICON[entry.severity]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: token.colorText }}>
            {entry.title}
          </span>
          {entry.dedupeKey !== undefined && (
            <CardMuteMenu
              dedupeKey={entry.dedupeKey}
              title={entry.title}
              visible={hover || menuOpen}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
        {entry.description && (
          <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.45 }}>
            {entry.description}
          </div>
        )}
        {primary && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button size="small" onClick={primary.run} style={{ fontSize: 12 }}>
              {primary.icon}
              {primary.label}
            </Button>
            {rest.map((action) => (
              <ActionLink key={action.label} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ info, onClose }) => {
  const { token } = theme.useToken();
  const t = useT();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const entries = useNotifications();
  const suggestions = useSuggestions();

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
      <PanelHeader wiring={wiring} title={<strong>{t('shared.notifications.title')}</strong>} info={info} />
      <div className="rules-notifications-split" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <Allotment vertical>
          <Allotment.Pane
            minSize={SUGGESTIONS_MIN_HEIGHT}
            maxSize={SUGGESTIONS_MAX_HEIGHT}
            preferredSize={SUGGESTIONS_PREFERRED_HEIGHT}
          >
            <div style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none', padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: token.colorTextSecondary }}>
                  {t('shared.notifications.suggestionsHeading')}
                </span>
                <Button
                  size="small"
                  type="link"
                  onClick={clearAllSuggestions}
                  disabled={suggestions.length === 0}
                  style={{ fontSize: 12, padding: 0, height: 'auto' }}
                >
                  {t('shared.notifications.clearAll')}
                </Button>
              </div>
              {suggestions.length === 0 ? (
                <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                  {t('shared.notifications.suggestionsEmpty')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {suggestions.map((entry) => (
                    <SuggestionCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={TIMELINE_MIN_HEIGHT}>
            <div style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none', padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: token.colorTextSecondary }}>
                  {t('shared.notifications.timelineHeading')}
                </span>
                <Button
                  size="small"
                  type="link"
                  onClick={clearAllNotifications}
                  disabled={entries.every((e) => e.sticky)}
                  style={{ fontSize: 12, padding: 0, height: 'auto' }}
                >
                  {t('shared.notifications.clearAll')}
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
                        {t('shared.notifications.timelineEmpty')}
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
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default NotificationsPanel;
