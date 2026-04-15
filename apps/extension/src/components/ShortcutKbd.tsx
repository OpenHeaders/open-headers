/**
 * ShortcutKbd — compact keyboard-hint badge shown at the start of a
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
 */

import type React from 'react';

interface ShortcutKbdProps {
  label: string;
}

/**
 * Single kbd-style badge, intentionally styled light-on-dark because
 * antd's Tooltip surface is dark `rgba(0, 0, 0, 0.85)` on every theme
 * (design choice — tooltips are meant to stand out). Hardcoded white
 * tones so the badge reads legibly against that surface without
 * leaking the host app's light/dark mode into the kbd.
 */
export const ShortcutKbd: React.FC<ShortcutKbdProps> = ({ label }) => {
  if (!label) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        marginRight: 6,
        borderRadius: 3,
        border: '1px solid rgba(255, 255, 255, 0.45)',
        background: 'rgba(255, 255, 255, 0.14)',
        color: '#ffffff',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 11,
        lineHeight: '16px',
        letterSpacing: 0,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
};

interface ShortcutHintTitleProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Tooltip title wrapper — lays out `[kbd] children`. Use as the
 * `title` prop of an antd Tooltip when the hovered control has a
 * matching keyboard shortcut.
 */
export const ShortcutHintTitle: React.FC<ShortcutHintTitleProps> = ({ label, children }) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <ShortcutKbd label={label} />
      <span>{children}</span>
    </span>
  );
};
