/**
 * PaneToolbar — a pane's horizontal icon band (the Commit window's top
 * row, the changes pane's details band) over the shared
 * toolbar-overflow fit: the leading entries that fit stay in the band
 * and the tail folds behind a › chevron at the right edge whose HOVER
 * lays the folded buttons out in a strip beneath it — the band never
 * shrinks or clips a button (S38 law). Entries are buttons (24px),
 * separators (a 1px rule) or one spacer (the flex gap that pushes the
 * rest to the far edge); a spacer folds like a separator and never
 * appears in the strip.
 */

import { RightOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type ToolbarOverflowItem, useToolbarOverflow } from '@openheaders/ui/shared/toolbar-overflow';
import ToolbarIconButton from './ToolbarIconButton';

export type PaneToolbarEntry =
  | { kind: 'item'; key: string; node: React.ReactNode }
  | { kind: 'separator'; key: string }
  | { kind: 'spacer'; key: string };

export interface PaneToolbarProps {
  entries: readonly PaneToolbarEntry[];
  /** The band's testid; the chevron is `<testid>-more-button`, its strip `<testid>-overflow`. */
  testid: string;
}

const BUTTON_EXTENT = 24;
/** The 1px rule plus its 4px margins. */
const SEPARATOR_EXTENT = 9;
const GAP = 2;
const BAND_PADDING = 16;
const BAND_HEIGHT = 33;

/** The fit's extents from the entries' kinds — a spacer takes no room of its own. */
function extentsOf(shape: string): ToolbarOverflowItem[] {
  if (shape.length === 0) return [];
  return shape.split(',').map((kind) => {
    if (kind === 'item') return { kind: 'item', extent: BUTTON_EXTENT };
    return { kind: 'separator', extent: kind === 'separator' ? SEPARATOR_EXTENT : 0 };
  });
}

const PaneToolbar: React.FC<PaneToolbarProps> = ({ entries, testid }) => {
  const t = useT();
  const { token } = theme.useToken();
  const shape = entries.map((entry) => entry.kind).join(',');
  const extents = useMemo(() => extentsOf(shape), [shape]);
  const { ref, fit } = useToolbarOverflow<HTMLDivElement>({
    items: extents,
    axis: 'horizontal',
    gap: GAP,
    moreExtent: BUTTON_EXTENT,
    padding: BAND_PADDING,
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
      <span key={entry.key} style={{ display: 'contents' }}>
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
        gap: GAP,
        height: BAND_HEIGHT,
        padding: '0 8px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
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
                gap: GAP,
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
