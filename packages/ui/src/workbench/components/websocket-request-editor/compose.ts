/**
 * Compose vocabulary of the WebSocket editor — the pure pieces its
 * modules share: the chord labels, the ws/wss scheme surgery the
 * header lock performs, and the raw flavor's display-mode → Monaco
 * language map.
 */

import type { WebSocketMessageFormat } from '@openheaders/core/types';
import { isMac } from '@openheaders/ui/shared/platform';
import type { LanguageId } from '@openheaders/ui/workbench/languages/registry';

export const CONNECT_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';
export const SEND_MESSAGE_SHORTCUT = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';

/** Monaco language for each raw-flavor compose display mode. */
export const MESSAGE_FORMAT_LANGUAGE = {
  text: 'text',
  json: 'json',
  xml: 'xml',
  html: 'html',
} as const satisfies Record<WebSocketMessageFormat, LanguageId>;

/** Flip the URL between ws:// and wss:// without touching the rest —
 *  the editor's scheme lock is string surgery on the draft URL only
 *  (templates and schemeless authorities stay as typed until locked). */
export const toggleScheme = (url: string): string => {
  if (url.startsWith('wss://')) return `ws://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `wss://${url.slice('ws://'.length)}`;
  // No recognized scheme yet — locking prepends the secure one.
  return `wss://${url}`;
};
