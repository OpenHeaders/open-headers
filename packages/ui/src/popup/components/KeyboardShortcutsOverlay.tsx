import { hostNavigation } from '@openheaders/core/navigation';
import { Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  POPUP_SHORTCUTS,
  type PopupShortcutDef,
  type PopupShortcutGroup,
  type PopupShortcutId,
  usePopupShortcutChords,
} from '../shortcuts/popup-shortcuts';

const { Text } = Typography;

interface KeyboardShortcutsOverlayProps {
  visible: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  id?: PopupShortcutId;
  keys: string[];
  combo?: boolean;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
  hint?: { label: string; onClick: () => void };
}

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Mapping from registry group to the visible column heading in the
 * overlay. Popup shortcuts live in one place (`POPUP_SHORTCUTS`) so we
 * can't accidentally show a key here that the dispatcher doesn't
 * recognize, or rebind in settings without updating this overlay.
 */
const GROUP_TITLES: Record<PopupShortcutGroup, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  row: 'Table rows',
  browser: 'Browser',
  tourGuide: 'Tour Guide',
};

const GROUP_ORDER: readonly PopupShortcutGroup[] = ['navigation', 'actions', 'row', 'tourGuide', 'browser'];

const BROWSER_SHORTCUT: ShortcutEntry = {
  keys: isMac ? ['\u2318', '\u21E7', ','] : ['Ctrl', 'Shift', ','],
  combo: true,
  description: 'Open extension',
};

const BROWSER_HINT = {
  label: 'Customize extension shortcut \u2197',
  onClick: (): void => {
    hostNavigation.openShortcutSettings();
  },
};

/**
 * Display helpers — convert a normalized chord string (the format used
 * by the settings store and `buildChordsFromEvent`) into a single-key
 * overlay label, without modifiers. Popup shortcuts are single-key by
 * design; if a user rebinds to a modified chord we still render the
 * final key so the overlay doesn't go blank.
 */
const MOD_DISPLAY = isMac ? '\u2318' : 'Ctrl';
const MOD_DISPLAY_MAP: Record<string, string> = {
  mod: MOD_DISPLAY,
  shift: isMac ? '\u21E7' : 'Shift',
  alt: isMac ? '\u2325' : 'Alt',
  ctrl: isMac ? '\u2303' : 'Ctrl',
};

function displayKeyToken(raw: string): string {
  switch (raw) {
    case ' ':
      return 'Space';
    case 'arrowup':
      return '\u2191';
    case 'arrowdown':
      return '\u2193';
    case 'arrowleft':
      return '\u2190';
    case 'arrowright':
      return '\u2192';
    case 'escape':
      return 'Esc';
    case 'enter':
      return '\u21B5';
    default:
      return raw.length === 1 ? raw : raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}

function displayKey(chord: string): string {
  if (!chord) return '';
  const parts = chord.split('+');
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1).map((m) => MOD_DISPLAY_MAP[m] ?? m);
  const label = displayKeyToken(key);
  if (mods.length === 0) return label;
  return isMac ? `${mods.join('')}${label}` : `${mods.join('+')}+${label}`;
}

/**
 * Render a chord as separate Kbd-ready parts (`['Shift', 'T']`) so the
 * overlay can show modifier + key as side-by-side keys joined with `+`,
 * matching the browser-shortcut row. Returns an empty array for empty
 * chord strings, leaving the caller to fall back to a placeholder.
 */
function displayChordParts(chord: string): string[] {
  if (!chord) return [];
  const parts = chord.split('+');
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1).map((m) => MOD_DISPLAY_MAP[m] ?? m);
  return [...mods, displayKeyToken(key)];
}

function buildEntryKeys(def: PopupShortcutDef, chord: string): { keys: string[]; combo: boolean } {
  const hasModifier = chord.includes('+');
  if (hasModifier) {
    const parts = displayChordParts(chord);
    return { keys: parts.length > 0 ? parts : ['—'], combo: true };
  }
  const primary = displayKey(chord);
  const aliasKeys = (def.hardcodedAliases ?? [])
    .map((alias) => displayKey(alias.toLowerCase()))
    .filter((k) => k && k !== primary);
  const keys = primary ? [primary, ...aliasKeys] : aliasKeys;
  return { keys: keys.length > 0 ? keys : ['—'], combo: false };
}

interface OverlayColumns {
  left: ShortcutGroup[];
  right: ShortcutGroup[];
}

function useOverlayColumns(): OverlayColumns {
  // One subscription drives the entire overlay — if the user rebinds
  // any popup chord from Settings → Keyboard, the underlying store
  // replaces the snapshot and every overlay row repaints on the next
  // tick. No per-key hook call, so adding shortcuts can't trip React's
  // rules of hooks.
  const chords = usePopupShortcutChords();

  return useMemo<OverlayColumns>(() => {
    const grouped: Record<PopupShortcutGroup, ShortcutEntry[]> = {
      navigation: [],
      actions: [],
      row: [],
      browser: [],
      tourGuide: [],
    };
    for (const def of POPUP_SHORTCUTS) {
      const entry = buildEntryKeys(def, chords[def.id]);
      grouped[def.group].push({
        id: def.id,
        keys: entry.keys,
        combo: entry.combo,
        description: def.description,
      });
    }
    grouped.browser.push(BROWSER_SHORTCUT);

    const groups: ShortcutGroup[] = GROUP_ORDER.map((group) => ({
      title: GROUP_TITLES[group],
      shortcuts: grouped[group],
      hint: group === 'browser' ? BROWSER_HINT : undefined,
    }));

    return {
      left: groups.filter((g) => g.title === GROUP_TITLES.navigation || g.title === GROUP_TITLES.actions),
      right: groups.filter(
        (g) => g.title === GROUP_TITLES.row || g.title === GROUP_TITLES.browser || g.title === GROUP_TITLES.tourGuide,
      ),
    };
  }, [chords]);
}

const Kbd: React.FC<{ children: string }> = ({ children }) => <span className="kbd-key">{children}</span>;

const ShortcutColumn: React.FC<{ groups: ShortcutGroup[] }> = ({ groups }) => (
  <div className="keyboard-shortcuts-column">
    {groups.map((group) => (
      <div key={group.title} className="keyboard-shortcuts-group">
        <Text type="secondary" className="keyboard-shortcuts-group-title">
          {group.title}
        </Text>
        {group.shortcuts.map((shortcut) => (
          <div key={shortcut.description} className="keyboard-shortcut-row">
            <span className="keyboard-shortcut-keys">
              {shortcut.keys.map((key, i) => (
                <span key={key}>
                  {i > 0 && (
                    <Text type="secondary" style={{ fontSize: '10px', margin: '0 2px' }}>
                      {shortcut.combo ? '+' : '/'}
                    </Text>
                  )}
                  <Kbd>{key}</Kbd>
                </span>
              ))}
            </span>
            <Text style={{ fontSize: '12px' }}>{shortcut.description}</Text>
          </div>
        ))}
        {group.hint && (
          <span
            className="keyboard-shortcuts-customize-link"
            role="button"
            tabIndex={0}
            onClick={group.hint.onClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') group.hint!.onClick();
            }}
          >
            {group.hint.label}
          </span>
        )}
      </div>
    ))}
  </div>
);

const KeyboardShortcutsOverlay: React.FC<KeyboardShortcutsOverlayProps> = ({ visible, onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const columns = useOverlayColumns();

  // Close on click outside
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="keyboard-shortcuts-backdrop">
      <div className="keyboard-shortcuts-overlay" ref={overlayRef}>
        <div className="keyboard-shortcuts-header">
          <Text strong style={{ fontSize: '14px' }}>
            Keyboard Shortcuts
          </Text>
          <span className="keyboard-shortcuts-close">
            <Text type="secondary" style={{ fontSize: '11px' }}>
              press
            </Text>
            <Kbd>Esc</Kbd>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              or
            </Text>
            <Kbd>?</Kbd>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              to close
            </Text>
          </span>
        </div>
        <div className="keyboard-shortcuts-body">
          <ShortcutColumn groups={columns.left} />
          <div className="keyboard-shortcuts-divider" />
          <ShortcutColumn groups={columns.right} />
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsOverlay;
