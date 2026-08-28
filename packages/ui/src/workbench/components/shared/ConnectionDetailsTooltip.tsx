/**
 * ConnectionDetailsTooltip — the session pills' hover affordance,
 * shared by the WS/MQTT session panes: wraps a state pill and shows
 * the session's facts as a label / value sheet under a globe title —
 * the lifecycle transitions with their wall-clock instants (newest
 * first — the timeline's order) and the handshake facts the panes
 * add (negotiated extensions, the selected subprotocol). Purely
 * presentational: the panes assemble the rows from their session
 * timing and snapshot, reusing the timeline/pill vocabulary, so the
 * hover is a compact echo of the record — facts, never synthesis. No
 * rows = no tooltip (absence stays absence). Opens to the pill's
 * lower left so it never runs under the pane's trailing controls.
 */

import { GlobalOutlined } from '@ant-design/icons';
import { getDateTimeFormat } from '@openheaders/i18n';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { Tooltip } from 'antd';
import React, { useMemo } from 'react';

export type ConnectionDetailsRow =
  | {
      /** The transition's display label — the timeline/pill vocabulary. */
      label: string;
      /** The transition's wall-clock instant (epoch ms). */
      atMs: number;
    }
  | {
      /** A handshake fact's label. */
      label: string;
      /** The fact verbatim. */
      value: string;
    };

interface ConnectionDetailsTooltipProps {
  /** Lifecycle transitions newest first, then the handshake facts;
   *  empty = children render plain (no empty tooltip shells). */
  rows: readonly ConnectionDetailsRow[];
  children: React.ReactElement;
}

/** English ordinal day suffix — the reference's `Aug 28th 2026` date. */
function ordinalSuffix(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** `Aug 28th 2026, 09:42` in English; the locale's own medium date +
 *  short time elsewhere (an ordinal suffix is an English habit). */
export function formatConnectionInstant(locale: string, atMs: number): string {
  if (locale.toLowerCase().startsWith('en')) {
    const parts = getDateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(atMs);
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
    const day = Number(part('day'));
    return `${part('month')} ${day}${ordinalSuffix(day)} ${part('year')}, ${part('hour')}:${part('minute')}`;
  }
  return getDateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(atMs);
}

const ConnectionDetailsTooltip: React.FC<ConnectionDetailsTooltipProps> = ({ rows, children }) => {
  const { locale, t } = useLocale();

  const cells = useMemo(
    () =>
      rows.map((row) => ({
        label: row.label,
        value: 'atMs' in row ? formatConnectionInstant(locale, row.atMs) : row.value,
      })),
    [rows, locale],
  );

  if (rows.length === 0) return children;

  return (
    <Tooltip
      placement="bottomRight"
      styles={{ root: { maxWidth: 420 } }}
      title={
        <div data-testid="connection-details-tooltip" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12 }}>
            <GlobalOutlined />
            {t('workbench.editors.session.connectionDetails')}
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'max-content minmax(0, 1fr)',
              columnGap: 16,
              rowGap: 4,
              fontSize: 12,
            }}
          >
            {cells.map((cell) => (
              <React.Fragment key={`${cell.label}:${cell.value}`}>
                <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>{cell.label}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{cell.value}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      }
    >
      {children}
    </Tooltip>
  );
};

export default ConnectionDetailsTooltip;
