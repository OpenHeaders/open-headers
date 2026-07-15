import { hasCapability } from '@openheaders/core/capabilities';
import { hostNavigation } from '@openheaders/core/navigation';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
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

/**
 * Mapping from registry group to the visible column heading in the
 * overlay. Popup shortcuts live in one place (`POPUP_SHORTCUTS`) so we
 * can't accidentally show a key here that the dispatcher doesn't
 * recognize, or rebind in settings without updating this overlay.
 */
const GROUP_TITLE_KEYS: Record<PopupShortcutGroup, MessageKey> = {
  navigation: 'popup.shortcuts.groupNavigation',
  actions: 'popup.shortcuts.groupActions',
  row: 'popup.shortcuts.groupRow',
  browser: 'popup.shortcuts.groupBrowser',
  tourGuide: 'popup.shortcuts.groupTour',
};

const GROUP_ORDER: readonly PopupShortcutGroup[] = ['navigation', 'actions', 'row', 'tourGuide', 'browser'];

const BROWSER_SHORTCUT_KEYS: readonly string[] = isMac ? ['\u2318', '\u21E7', ','] : ['Ctrl', 'Shift', ','];

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

function useOverlayColumns(t: Translate): OverlayColumns {
  // One subscription drives the entire overlay — if the user rebinds
  // any popup chord from Settings → Keyboard, the underlying store
  // replaces the snapshot and every overlay row repaints on the next
  // tick. No per-key hook call, so adding shortcuts can't trip React's
  // rules of hooks.
  const chords = usePopupShortcutChords();
  // The Debug mode toggle isn't a popup chord — it's the cross-surface
  // `keyboard.toggleDebugMode`, read here so the overlay lists it alongside
  // the popup actions. Hidden where the host can't drive the debugging
  // protocol, matching the footer pill.
  const debugChord = useSettingValue('keyboard.toggleDebugMode');
  const debugAvailable = hasCapability('cdpInspection');

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
        description: t(def.descriptionKey),
      });
    }
    if (debugAvailable) {
      const parts = displayChordParts(typeof debugChord === 'string' ? debugChord : '');
      grouped.actions.push({
        keys: parts.length > 0 ? parts : ['—'],
        combo: true,
        description: t('popup.shortcuts.toggleDebugMode'),
      });
    }
    grouped.browser.push({
      keys: [...BROWSER_SHORTCUT_KEYS],
      combo: true,
      description: t('popup.shortcuts.openExtension'),
    });

    const groups: ShortcutGroup[] = GROUP_ORDER.map((group) => ({
      title: t(GROUP_TITLE_KEYS[group]),
      shortcuts: grouped[group],
      hint:
        group === 'browser'
          ? {
              label: t('popup.shortcuts.customize'),
              onClick: (): void => {
                hostNavigation.openShortcutSettings();
              },
            }
          : undefined,
    }));

    const leftTitles = new Set([t(GROUP_TITLE_KEYS.navigation), t(GROUP_TITLE_KEYS.actions)]);
    return {
      left: groups.filter((g) => leftTitles.has(g.title)),
      right: groups.filter((g) => !leftTitles.has(g.title)),
    };
  }, [chords, debugChord, debugAvailable, t]);
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
  const t = useT();
  const columns = useOverlayColumns(t);
  // Live chord for the toggle itself, so the "or X to close" hint in
  // the header follows a rebind; the fragment drops when unbound
  // (Esc always closes).
  const helpChords = usePopupShortcutChords();
  const helpKeys = displayChordParts(helpChords['toggle-shortcuts-help']);

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
            {t('popup.shortcuts.title')}
          </Text>
          <span className="keyboard-shortcuts-close">
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.shortcuts.press')}
            </Text>
            <Kbd>Esc</Kbd>
            {helpKeys.length > 0 && (
              <>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {t('popup.shortcuts.or')}
                </Text>
                {helpKeys.map((key, i) => (
                  <span key={key}>
                    {i > 0 && (
                      <Text type="secondary" style={{ fontSize: '10px', margin: '0 2px' }}>
                        +
                      </Text>
                    )}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </>
            )}
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.shortcuts.toClose')}
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
