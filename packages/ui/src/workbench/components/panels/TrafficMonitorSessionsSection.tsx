/**
 * TrafficMonitorSessionsSection — the third collapsible section of the
 * Traffic Monitor source rail: THIS RUN's disk capture sessions
 * (AGENT_TRAFFIC_PLAN.md §3), read from the operator plane's
 * `capture.status` — active sessions first, then the recent ended ones
 * with their honest end reasons. Prior-run files sit on disk
 * unenumerated by design; the empty hint names the this-run scope.
 *
 * Row vocabulary mirrors the rail's capture affordance: the red save
 * mark = actively recording, click stops (a human gesture — the
 * channel has no MCP mirror). Ended rows carry their end reason and a
 * hover-revealed "show file in folder" action, gated on the host's
 * `revealInFolder` capability — the file IS the deliverable.
 *
 * Presentational: the panel owns the session list, the pending set and
 * both actions; this section renders and reports clicks.
 */

import { FileOutlined, FolderOpenOutlined, LoadingOutlined, SaveFilled } from '@ant-design/icons';
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
};

export interface TrafficMonitorSessionsSectionProps {
  sessions: ReadonlyArray<TrafficCaptureSessionProjection>;
  /** Sessions whose stop command is in flight — spinner state. */
  pending: ReadonlySet<string>;
  /** Stop an ACTIVE session (the rail affordance's stop path). */
  onStop: (session: TrafficCaptureSessionProjection) => void;
  /** The host can reveal files in its OS file manager. */
  canReveal: boolean;
  /** Reveal an ended session's file. */
  onReveal: (session: TrafficCaptureSessionProjection) => void;
}

function SessionRow({
  session,
  pending,
  onStop,
  canReveal,
  onReveal,
}: {
  session: TrafficCaptureSessionProjection;
  pending: boolean;
  onStop: () => void;
  canReveal: boolean;
  onReveal: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const active = session.state === 'active';
  const detail = t('workbench.trafficMonitor.sessionDetail', {
    records: session.recordLines,
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
        {!active && canReveal && (
          <Tooltip title={t('workbench.trafficMonitor.sessionReveal')} placement="left">
            <span
              role="button"
              tabIndex={0}
              data-testid="traffic-monitor-session-reveal"
              aria-label={t('workbench.trafficMonitor.sessionRevealAria')}
              className="rules-sidebar-item-hover-action"
              style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                onReveal();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onReveal();
                }
              }}
            >
              <FolderOpenOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
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
  canReveal,
  onReveal,
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
              canReveal={canReveal}
              onReveal={() => onReveal(session)}
            />
          ))}
        </div>
      )}
    </>
  );
};
