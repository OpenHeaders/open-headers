/**
 * PaneToolbar — a pane's horizontal band (the Commit window's top row,
 * the changes pane's details band, the log's filter row) over the
 * shared toolbar-overflow fit: the leading entries that fit stay in
 * the band and the tail folds behind a › chevron at the right edge
 * whose HOVER lays the folded entries out in a strip beneath it — the
 * band never shrinks or clips an entry (S38 law). Entries are items (a
 * 24px button, or anything wider — a chip is read where it stands),
 * separators (a 1px rule) or one spacer (the flex gap that pushes the
 * rest to the far edge); a spacer folds like a separator and never
 * appears in the strip. A band may open with a LEAD — a control that
 * is no entry (the log's text field): it never folds and keeps ONE
 * width at every band size (the reference's reading) — only the
 * entries after it give way.
 */

import { RightOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type ToolbarOverflowItem, useEntryExtents, useToolbarOverflow } from '@openheaders/ui/shared/toolbar-overflow';
import ToolbarIconButton from './ToolbarIconButton';

export type PaneToolbarEntry =
  | { kind: 'item'; key: string; node: React.ReactNode }
  | { kind: 'separator'; key: string }
  | { kind: 'spacer'; key: string };

export interface PaneToolbarLead {
  node: React.ReactNode;
  /** The width it holds, whatever the band's. */
  width: number;
}

export interface PaneToolbarProps {
  entries: readonly PaneToolbarEntry[];
  /** The band's testid; the chevron is `<testid>-more-button`, its strip `<testid>-overflow`. */
  testid: string;
  lead?: PaneToolbarLead;
  /** The space between entries — an icon band's 2px unless the band says otherwise. */
  gap?: number;
}

const BUTTON_EXTENT = 24;
/** The 1px rule plus its 4px margins. */
const SEPARATOR_EXTENT = 9;
const ICON_GAP = 2;
const BAND_PADDING = 16;
const BAND_HEIGHT = 33;

const entryWrap: React.CSSProperties = { display: 'inline-flex', flex: '0 0 auto' };

/** The fit's extents from the entries' `kind:key` shape and the widths read so far. */
function extentsOf(shape: string, widths: ReadonlyMap<string, number>): ToolbarOverflowItem[] {
  if (shape.length === 0) return [];
  return shape.split(',').map((entry) => {
    const cut = entry.indexOf(':');
    const kind = entry.slice(0, cut);
    if (kind === 'item') return { kind: 'item', extent: widths.get(entry.slice(cut + 1)) ?? BUTTON_EXTENT };
    return { kind: 'separator', extent: kind === 'separator' ? SEPARATOR_EXTENT : 0 };
  });
}

const PaneToolbar: React.FC<PaneToolbarProps> = ({ entries, testid, lead, gap = ICON_GAP }) => {
  const t = useT();
  const { token } = theme.useToken();
  const ref = useRef<HTMLDivElement | null>(null);
  // An item is as wide as it was last read in the band (a button's 24px
  // until then), a separator its rule and margins, the spacer nothing.
  const widths = useEntryExtents(ref);
  const shape = entries.map((entry) => `${entry.kind}:${entry.key}`).join(',');
  const items = useMemo(() => extentsOf(shape, widths), [shape, widths]);
  const { fit } = useToolbarOverflow<HTMLDivElement>({
    items,
    axis: 'horizontal',
    gap,
    moreExtent: BUTTON_EXTENT,
    padding: BAND_PADDING + (lead === undefined ? 0 : lead.width + gap),
    ref,
  });

  const render = (entry: PaneToolbarEntry, inStrip: boolean): React.ReactNode => {
    if (entry.kind === 'spacer') return inStrip ? null : <span key={entry.key} aria-hidden style={{ flex: 1 }} />;
    if (entry.kind === 'separator') {
      return (
        <span
          key={entry.key}
          aria-hidden
          style={{ flex: '0 0 auto', width: 1, height: 16, margin: '0 4px', background: token.colorBorderSecondary }}
        />
      );
    }
    return (
      <span key={entry.key} data-overflow-key={inStrip ? undefined : entry.key} style={entryWrap}>
        {entry.node}
      </span>
    );
  };

  const visible = entries.slice(0, fit.visible);
  const folded = entries.slice(fit.overflowStart).filter((entry) => entry.kind !== 'spacer');
  const strip = folded.map((entry) => entry.key).join('|');

  return (
    <div
      ref={ref}
      data-testid={testid}
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap,
        height: BAND_HEIGHT,
        padding: '0 8px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {lead !== undefined && (
        <span style={{ display: 'inline-flex', flex: '0 0 auto', width: lead.width }}>{lead.node}</span>
      )}
      {visible.map((entry) => render(entry, false))}
      {folded.length > 0 && (
        <Dropdown
          key={strip}
          // Hover lays the strip out (the reference gesture); a click toggle
          // would close what the arriving pointer had just opened.
          trigger={['hover']}
          mouseEnterDelay={0.05}
          placement="bottomRight"
          popupRender={() => (
            <div
              role="toolbar"
              data-testid={`${testid}-overflow`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap,
                padding: 4,
                background: token.colorBgElevated,
                borderRadius: token.borderRadiusLG,
                boxShadow: token.boxShadowSecondary,
              }}
            >
              {folded.map((entry) => render(entry, true))}
            </div>
          )}
        >
          <span data-testid={`${testid}-more`} style={{ display: 'inline-flex', flex: '0 0 auto', marginLeft: 'auto' }}>
            <ToolbarIconButton
              icon={<RightOutlined />}
              title={t('workbench.gitLog.rail.moreActions')}
              tooltip={false}
              testid={`${testid}-more-button`}
            />
          </span>
        </Dropdown>
      )}
    </div>
  );
};

export default PaneToolbar;
