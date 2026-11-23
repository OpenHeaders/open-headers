import type { MessageKey } from '@openheaders/i18n';
import { isMac } from '@openheaders/ui/shared/platform';

export interface DevtoolsShortcut {
  keys: string[];
  platform: string;
}

/**
 * Which inspector the browser ships. Safari's is Web Inspector: its own
 * name, its own menu path (Develop → Show Web Inspector), no internal-page
 * scheme to warn about, and an extension tab that sits among the built-in
 * ones with no marker or overflow.
 */
export type InspectorKind = 'devtools' | 'web-inspector';

export interface BrowserCopy {
  name: string;
  shortcut: DevtoolsShortcut;
  alternative: string;
  inspector: InspectorKind;
  menuHintKey?: MessageKey;
}

export function detectBrowser(): BrowserCopy {
  const ua = navigator.userAgent;
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isSafari = !isFirefox && /Safari/.test(ua) && !/Chrome|Chromium/.test(ua);

  const macShortcut: DevtoolsShortcut = { keys: ['⌘', '⌥', 'I'], platform: 'macOS' };
  const pcShortcut: DevtoolsShortcut = { keys: ['Ctrl', 'Shift', 'I'], platform: 'Windows / Linux' };
  const shortcut = isMac ? macShortcut : pcShortcut;

  if (isFirefox) return { name: 'Firefox', shortcut, alternative: 'F12', inspector: 'devtools' };
  if (isSafari) {
    return {
      name: 'Safari',
      shortcut: macShortcut,
      alternative: 'F12',
      inspector: 'web-inspector',
      menuHintKey: 'popup.debug.menuHintSafari',
    };
  }
  if (isEdge) return { name: 'Edge', shortcut, alternative: 'F12', inspector: 'devtools' };
  return { name: 'Chrome', shortcut, alternative: 'F12', inspector: 'devtools' };
}
