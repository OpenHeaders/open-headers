/**
 * TrafficMonitorSessionsSection — the third collapsible section of the
 * Traffic Monitor source rail: LIVE recording state only
 * (AGENT_TRAFFIC_PLAN.md §11.1, C4) — sessions currently `recording`
 * or `sealing`, read from the operator plane's `capture.status`.
 * Sealed sessions leave the rail; browsing the archive belongs to the
 * C5 sessions tool window. Disk location is an abstraction — there is
 * no reveal-in-folder here by design; all access to session content
 * goes through the app.
 *
 * Row vocabulary mirrors the rail's observe affordance: the red save
 * mark = actively recording, click stops (a human gesture — the
 * channel has no MCP mirror). A sealing row shows its honest end
 * reason until the seal completes and the row retires.
 *
 * Presentational: the panel owns the session list, the pending set and
 * the stop action; this section renders and reports clicks.
 */

import { FileOutlined, HistoryOutlined, LoadingOutlined, SaveFilled } from '@ant-design/icons';
import type { TrafficCaptureEndReason, TrafficCaptureSessionProjection } from '@openheaders/core/traffic';
import type { MessageKey } from '@openheaders/i18n';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatSize } from '../../../panel/components/traffic/formatters';
import { SectionHeader } from '../sidebar/SectionHeader';

const END_REASON_KEYS: Record<TrafficCaptureEndReason, MessageKey> = {
  stopped: 'workbench.trafficMonitor.sessionEndStopped',
  'size-bound': 'workbench.trafficMonitor.sessionEndSizeBound',
  'duration-bound': 'workbench.trafficMonitor.sessionEndDurationBound',
  'source-disarmed': 'workbench.trafficMonitor.sessionEndSourceDisarmed',
  'write-error': 'workbench.trafficMonitor.sessionEndWriteError',
  crashed: 'workbench.trafficMonitor.sessionEndCrashed',
};

export interface TrafficMonitorSessionsSectionProps {
  /** Live sessions only — `recording` and `sealing` rows. */
  sessions: ReadonlyArray<TrafficCaptureSessionProjection>;
  /** Sessions whose stop command is in flight — spinner state. */
  pending: ReadonlySet<string>;
  /** Stop an ACTIVE session (the observe affordance's stop path). */
  onStop: (session: TrafficCaptureSessionProjection) => void;
  /** Open the Traffic Sessions tool window — the header's go-to into
   *  the archive this section deliberately does not list (§11.1). */
  onOpenArchive: () => void;
}

function SessionRow({
  session,
  pending,
  onStop,
}: {
  session: TrafficCaptureSessionProjection;
  pending: boolean;
  onStop: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const active = session.state === 'recording';
  const detail = t('workbench.trafficMonitor.sessionDetail', {
    records: session.requests,
    size: formatSize(session.bytesWritten),
  });
  return (
    <Tooltip title={detail} placement="left">
      <div className="rules-sidebar-item traffic-monitor-session-row" data-testid="traffic-monitor-session-row">
        <FileOutlined style={{ fontSize: 12, color: token.colorTextTertiary, flex: '0 0 auto' }} />
        <span className="rules-sidebar-item-label">{session.name}</span>
        {!active && session.endReason !== undefined && (
          <span
            data-testid="traffic-monitor-session-end"
            style={{ fontSize: 11, color: token.colorTextTertiary, flex: '0 0 auto', whiteSpace: 'nowrap' }}
          >
            {t(END_REASON_KEYS[session.endReason])}
          </span>
        )}
        {active && (
          <Tooltip title={t('workbench.trafficMonitor.sessionStop')} placement="left">
            <span
              role="button"
              tabIndex={0}
              data-testid="traffic-monitor-session-stop"
              aria-label={t('workbench.trafficMonitor.sessionStopAria')}
              aria-busy={pending}
              style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                if (!pending) onStop();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!pending) onStop();
                }
              }}
            >
              {pending ? (
                <LoadingOutlined spin style={{ fontSize: 12, color: token.colorPrimary }} />
              ) : (
                <SaveFilled style={{ fontSize: 12, color: token.colorError }} />
              )}
            </span>
          </Tooltip>
        )}
      </div>
    </Tooltip>
  );
}

export const TrafficMonitorSessionsSection: React.FC<TrafficMonitorSessionsSectionProps> = ({
  sessions,
  pending,
  onStop,
  onOpenArchive,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(true);
  return (
    <>
      <SectionHeader
        title={t('workbench.trafficMonitor.sessionsTitle')}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
        actions={
          <Tooltip title={t('workbench.trafficMonitor.sessionsOpenArchive')} placement="left">
            <span
              role="button"
              tabIndex={0}
              data-testid="traffic-monitor-sessions-goto"
              aria-label={t('workbench.trafficMonitor.sessionsOpenArchiveAria')}
              style={{ display: 'inline-flex', alignItems: 'center', color: token.colorTextSecondary }}
              onClick={onOpenArchive}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenArchive();
                }
              }}
            >
              <HistoryOutlined style={{ fontSize: 12 }} />
            </span>
          </Tooltip>
        }
      />
      {open && (
        <div
          data-testid="traffic-monitor-sessions"
          style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}
        >
          {sessions.length === 0 && (
            <div
              data-testid="traffic-monitor-sessions-empty"
              style={{ padding: '4px 14px 8px', fontSize: 12, color: token.colorTextSecondary }}
            >
              {t('workbench.trafficMonitor.sessionsEmpty')}
            </div>
          )}
          {sessions.map((session) => (
            <SessionRow
              key={session.sessionId}
              session={session}
              pending={pending.has(session.sessionId)}
              onStop={() => onStop(session)}
            />
          ))}
        </div>
      )}
    </>
  );
};
