/**
 * TrafficMonitorSessionsSection — the SESSIONS row of the Traffic
 * Monitor source rail: a header-styled opener (the sidebar's
 * `SectionOpenerRow` idiom) whose whole row opens the Traffic Sessions
 * tool window (AGENT_TRAFFIC_PLAN.md §11.1, C5). The rail lists no
 * session rows — live recording state already shows on the source rows
 * themselves (the red observe glyph is the retention indicator), and
 * browsing the archive belongs to the sessions window.
 */

import { ExportOutlined } from '@ant-design/icons';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface TrafficMonitorSessionsSectionProps {
  /** Open the Traffic Sessions tool window — the row's only verb. */
  onOpenArchive: () => void;
}

export const TrafficMonitorSessionsSection: React.FC<TrafficMonitorSessionsSectionProps> = ({ onOpenArchive }) => {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <Tooltip title={t('workbench.trafficMonitor.sessionsOpenArchive')} placement="left">
      <div
        className="rules-sidebar-section"
        data-testid="traffic-monitor-sessions-goto"
        style={{ color: token.colorTextSecondary }}
        role="button"
        tabIndex={-1}
        aria-label={t('workbench.trafficMonitor.sessionsOpenArchiveAria')}
        onClick={onOpenArchive}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpenArchive();
        }}
      >
        <span className="rules-sidebar-section-title">
          <ExportOutlined style={{ fontSize: 10, marginRight: 4 }} />
          {t('workbench.trafficMonitor.sessionsTitle')}
        </span>
      </div>
    </Tooltip>
  );
};
