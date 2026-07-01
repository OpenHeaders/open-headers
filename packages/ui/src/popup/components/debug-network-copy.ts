export interface DevtoolsShortcut {
  keys: string[];
  platform: string;
}

export interface BrowserCopy {
  name: string;
  shortcut: DevtoolsShortcut;
  alternative: string;
  menuHint?: string;
}

export const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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
      menuHint: 'Enable Develop first — Safari → Settings → Advanced → "Show features for web developers".',
    };
  }
  if (isEdge) return { name: 'Edge', shortcut, alternative: 'F12' };
  return { name: 'Chrome', shortcut, alternative: 'F12' };
}
