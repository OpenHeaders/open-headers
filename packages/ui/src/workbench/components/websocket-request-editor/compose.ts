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

/** The compose mode to adopt when Format finds a plain-text message
 *  written in a structured language — the inverse of the map above
 *  for the modes that ARE a language, `null` for the rest. Safe to
 *  adopt: the mode is a display choice here, the frame travels
 *  verbatim. */
export function messageFormatForLanguage(language: LanguageId): WebSocketMessageFormat | null {
  switch (language) {
    case 'json':
    case 'xml':
    case 'html':
      return language;
    default:
      return null;
  }
}
