import type { MessageKey } from '@openheaders/i18n';
import { isMac } from '@openheaders/ui/shared/platform';

export interface DevtoolsShortcut {
  keys: string[];
  platform: string;
}

export interface BrowserCopy {
  name: string;
  shortcut: DevtoolsShortcut;
  alternative: string;
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

  if (isFirefox) return { name: 'Firefox', shortcut, alternative: 'F12' };
  if (isSafari) {
    return {
      name: 'Safari',
      shortcut: macShortcut,
      alternative: 'F12',
      menuHintKey: 'popup.debug.menuHintSafari',
    };
  }
  if (isEdge) return { name: 'Edge', shortcut, alternative: 'F12' };
  return { name: 'Chrome', shortcut, alternative: 'F12' };
}
