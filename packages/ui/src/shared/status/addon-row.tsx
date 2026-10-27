/**
 * AddonRow — the one row shell of the Add-ons popover: an identity
 * glyph, the fixed-width state tag the System popover's rows share,
 * then the message with its optional inline remedy. The glyph names
 * the companion without words — this machine's OS mark for the
 * desktop app, a browser's logo for its extension, the server mark
 * for a daemon — the same marks the place picker and the workspace
 * switcher draw (`shared/host-glyph`), statically bundled.
 */

import { Tag, theme } from 'antd';
import React from 'react';
import { STATUS_ROW_INSET, STATUS_TAG_WIDTH } from './StatusPill';

/** The popover body's width — wider than the System popover so a row
 *  keeps its glyph, tag, message and remedy on one line. */
export const ADDONS_BODY_WIDTH = 380;

export const ADDON_GLYPH_SIZE = 14;

/**
 * Fixed hues for the planes that have no brand mark of their own, so
 * every row reads in colour like the browser and OS logos beside it.
 * Identity colours, not state — the tag carries the state. Mid-tone
 * so they hold on both themes.
 */
export const ADDON_GLYPH_COLOR = {
  browser: '#1677ff',
  desktop: '#13c2c2',
  mcp: '#722ed1',
  server: '#2f54eb',
} as const;

export type AddonGlyph = React.ComponentType<{ style?: React.CSSProperties }>;

/** An icon component drawn at the row's glyph size. `color` tints a
 *  glyph that follows `currentColor`; a brand logo keeps its own fill. */
export const AddonMark: React.FC<{ icon: AddonGlyph; color?: string }> = ({ icon: Icon, color }) => (
  <Icon style={{ fontSize: ADDON_GLYPH_SIZE, color }} />
);

/**
 * The row carries the System popover's grey hover wash — state-driven
 * rather than a class, since the shared surface renders under several
 * host stylesheets; the token keeps it theme-correct. The negative
 * horizontal margin lets the wash bleed to the popover edge while the
 * columns keep their alignment, stepped in by the System popover's row
 * inset under the group heading.
 */
export const AddonRow: React.FC<{
  /** The row's identity glyph — an {@link AddonMark}, or any mark
   *  drawn at {@link ADDON_GLYPH_SIZE} (the server's Org icon). */
  glyph: React.ReactNode;
  tagColor: string;
  label: string;
  testId: string;
  children: React.ReactNode;
}> = ({ glyph, tagColor, label, testId, children }) => {
  const { token } = theme.useToken();
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      data-testid={testId}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: `1px 6px 1px ${6 + STATUS_ROW_INSET}px`,
        margin: '0 -6px',
        borderRadius: token.borderRadiusSM,
        background: hovered ? token.colorFillTertiary : 'transparent',
      }}
    >
      {/* The glyph column is as tall as the tag so the two centre together. */}
      <span
        style={{
          flex: 'none',
          width: ADDON_GLYPH_SIZE + 2,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 0,
        }}
      >
        {glyph}
      </span>
      <Tag
        color={tagColor}
        style={{ fontSize: 10, width: STATUS_TAG_WIDTH, textAlign: 'center', margin: 0, flex: 'none' }}
      >
        {label}
      </Tag>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 4,
          paddingTop: 1,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </span>
    </div>
  );
};
