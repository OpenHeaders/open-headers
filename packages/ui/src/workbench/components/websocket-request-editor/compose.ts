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

/** Monaco language for each raw-flavor compose mode — a binary
 *  compose authors its byte spelling as plain text. */
export const MESSAGE_FORMAT_LANGUAGE = {
  text: 'text',
  json: 'json',
  xml: 'xml',
  html: 'html',
  binary: 'text',
} as const satisfies Record<WebSocketMessageFormat, LanguageId>;
