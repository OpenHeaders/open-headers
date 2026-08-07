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
  /** Away from the rail's side (see the rail's `side` prop). */
  tooltipPlacement: 'left' | 'right';
}

export const TrafficMonitorSessionsSection: React.FC<TrafficMonitorSessionsSectionProps> = ({
  onOpenArchive,
  tooltipPlacement,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <Tooltip title={t('workbench.trafficMonitor.sessionsOpenArchive')} placement={tooltipPlacement}>
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
          {/* Static right-pointing caret — the sibling section headers'
              glyph, unrotated: the row opens a window, never expands. */}
          <span style={{ display: 'inline-block', fontSize: 10, marginRight: 4 }}>&#9654;</span>
          {t('workbench.trafficMonitor.sessionsTitle')}
          <ExportOutlined style={{ fontSize: 10, marginLeft: 6 }} />
        </span>
      </div>
    </Tooltip>
  );
};
