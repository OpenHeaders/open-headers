/**
 * ShortcutKbd — compact keyboard-hint badges shown at the start of a
 * tooltip title so users can discover the shortcut without opening
 * the cheatsheet. Both popup and workspace render it the same way.
 *
 * Usage inside an Ant Design Tooltip:
 *
 *   <Tooltip title={<ShortcutHintTitle label={shortcut} text="Save" />}>
 *     ...
 *   </Tooltip>
 *
 * `label` is the already-formatted platform-specific chord string
 * (e.g. `⌘S` on Mac, `Ctrl+S` elsewhere). The helpers in
 * `popup/shortcuts/popup-shortcuts.ts` and
 * `rules/hooks/useWorkspaceShortcuts.ts` both return that format.
 * The chord renders as one key cap PER KEY with a `+` between caps —
 * `⌥⌘F` becomes [⌥] + [⌘] + [F] — so multi-modifier chords stay
 * readable at tooltip size.
 */

import { theme } from 'antd';
import type React from 'react';

const MAC_MODIFIERS = new Set(['⌘', '⇧', '⌥', '⌃']);

/** Split a chord label into its keys. PC labels are `+`-joined
 *  (`Ctrl+Shift+F`); Mac labels concatenate modifier symbols before
 *  the key (`⇧⌘F`, `⌘↵`). */
function splitChord(label: string): string[] {
  if (label.includes('+')) return label.split('+').filter(Boolean);
  const keys: string[] = [];
  let i = 0;
  while (i < label.length && MAC_MODIFIERS.has(label.charAt(i))) {
    keys.push(label.charAt(i));
    i++;
  }
  const tail = label.slice(i);
  if (tail) keys.push(tail);
  return keys;
}

/** Cap + separator colors for the surface the chord sits on. */
interface CapPalette {
  background: string;
  color: string;
  border: string;
  boxShadow: string;
  separator: string;
}

/**
 * Palette for antd's dark tooltip surface: an opaque light cap with a
 * dark glyph on top — the same treatment real keyboards use, which
 * reads clearly regardless of the host theme. Earlier attempts used a
 * semi-transparent white fill with white glyph text, but the low
 * contrast between the faint fill and the white glyph made the label
 * unreadable.
 */
const TOOLTIP_PALETTE: CapPalette = {
  background: '#f5f5f5',
  color: '#1f1f1f',
  border: '1px solid rgba(255, 255, 255, 0.35)',
  boxShadow: '0 1px 0 rgba(0, 0, 0, 0.25), inset 0 -1px 0 rgba(0, 0, 0, 0.08)',
  separator: 'rgba(255, 255, 255, 0.65)',
};

/** Single key cap. */
const KeyCap: React.FC<{ glyph: string; size: number; palette: CapPalette }> = ({ glyph, size, palette }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: size,
      height: size,
      padding: '0 5px',
      borderRadius: size >= 20 ? 4 : 3,
      border: palette.border,
      background: palette.background,
      color: palette.color,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: size >= 20 ? 12 : 11,
      fontWeight: 600,
      lineHeight: `${size - 2}px`,
      letterSpacing: 0,
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
      boxShadow: palette.boxShadow,
    }}
  >
    {glyph}
  </span>
);

interface ShortcutKbdProps {
  label: string;
  /** Cap height in px; tooltips use the compact default. */
  size?: number;
  /** Where the chord renders: antd's dark tooltip surface (default) or
   *  a regular page surface, which draws from the active theme. */
  surface?: 'tooltip' | 'page';
}

/** The full chord: one cap per key, `+` separators between caps. */
export const ShortcutKbd: React.FC<ShortcutKbdProps> = ({ label, size = 18, surface = 'tooltip' }) => {
  const { token } = theme.useToken();
  if (!label) return null;
  const palette: CapPalette =
    surface === 'page'
      ? {
          background: token.colorBgContainer,
          color: token.colorTextSecondary,
          border: `1px solid ${token.colorBorder}`,
          boxShadow: `0 1px 0 ${token.colorBorderSecondary}`,
          separator: token.colorTextTertiary,
        }
      : TOOLTIP_PALETTE;
  const keys = splitChord(label);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {keys.map((key, i) => (
        <span key={`${key}-${String(i)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {i > 0 && (
            <span aria-hidden="true" style={{ fontSize: 10, color: palette.separator }}>
              +
            </span>
          )}
          <KeyCap glyph={key} size={size} palette={palette} />
        </span>
      ))}
    </span>
  );
};

interface ShortcutHintTitleProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Tooltip title wrapper — lays out `[kbd] + [kbd] children`. Use as
 * the `title` prop of an antd Tooltip when the hovered control has a
 * matching keyboard shortcut.
 */
export const ShortcutHintTitle: React.FC<ShortcutHintTitleProps> = ({ label, children }) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <ShortcutKbd label={label} />
      <span>{children}</span>
    </span>
  );
};
