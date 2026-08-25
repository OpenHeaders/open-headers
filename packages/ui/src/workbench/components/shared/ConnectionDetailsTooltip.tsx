/**
 * ConnectionDetailsTooltip — the session pills' hover affordance,
 * shared by the WS/MQTT session panes: wraps a state pill and shows
 * the session's lifecycle transitions with their wall-clock instants
 * (newest first — the timeline's order). Purely presentational: the
 * panes assemble the rows from their session timing, reusing the
 * timeline/pill vocabulary, so the hover is a compact echo of the
 * timeline — facts, never synthesis. No rows = no tooltip (absence
 * stays absence).
 */

import { getDateTimeFormat } from '@openheaders/i18n';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { Tooltip } from 'antd';
import type React from 'react';
import { useMemo } from 'react';

export interface ConnectionDetailsRow {
  /** The transition's display label — the timeline/pill vocabulary. */
  label: string;
  /** The transition's wall-clock instant (epoch ms). */
  atMs: number;
}

interface ConnectionDetailsTooltipProps {
  /** Lifecycle transitions, newest first; empty = children render
   *  plain (no empty tooltip shells). */
  rows: readonly ConnectionDetailsRow[];
  children: React.ReactElement;
}

const ConnectionDetailsTooltip: React.FC<ConnectionDetailsTooltipProps> = ({ rows, children }) => {
  const { locale, t } = useLocale();

  const format = useMemo(
    () =>
      getDateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  );

  if (rows.length === 0) return children;

  return (
    <Tooltip
      title={
        <div data-testid="connection-details-tooltip" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{t('workbench.editors.session.connectionDetails')}</span>
          {rows.map((row) => (
            <span key={`${row.label}:${String(row.atMs)}`} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span>{row.label}</span>
              <span style={{ marginLeft: 'auto', opacity: 0.85, whiteSpace: 'nowrap' }}>{format.format(row.atMs)}</span>
            </span>
          ))}
        </div>
      }
    >
      {children}
    </Tooltip>
  );
};

export default ConnectionDetailsTooltip;
