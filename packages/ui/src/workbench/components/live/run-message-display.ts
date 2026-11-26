/**
 * What a session step of a run opens to (the workflow runs plan, The Run
 * view): the messages its product holds, and one message's body as the
 * viewer reads it. Pure — the pane and its tests derive from here.
 */

import type { SessionMessage, StepProduct } from '@openheaders/core/live';
import { encodeBodyBytes, fromBase64 } from '../request-editor/response/response-encoding';

export type MessageProduct = Extract<StepProduct, { kind: 'message' }>;

/** What became of a message: an `expect`'s verdict on it, or its part in a `send`. */
export type RunMessageNote = 'matched' | 'not-matched' | 'stored' | 'sent' | 'reply';

export interface RunMessageEntry {
  message: SessionMessage;
  note: RunMessageNote;
}

/**
 * The messages of a product in the order they happened: an `expect`'s
 * whole window, or a `send`'s message and the reply to it.
 */
export function runMessageEntries(product: MessageProduct): RunMessageEntry[] {
  if (product.window !== undefined) {
    return product.window.map(({ message, outcome }) => ({ message, note: outcome }));
  }
  return [
    ...(product.message !== null ? [{ message: product.message, note: 'sent' as const }] : []),
    ...(product.reply !== undefined ? [{ message: product.reply, note: 'reply' as const }] : []),
  ];
}

/** The message a pane opens on: the match, else the last one there is. */
export function defaultRunMessageIndex(entries: readonly RunMessageEntry[]): number | null {
  const matched = entries.findIndex((entry) => entry.note === 'matched');
  if (matched >= 0) return matched;
  return entries.length > 0 ? entries.length - 1 : null;
}

const PREVIEW_MAX_CHARS = 200;

export interface RunMessageBody {
  /** The body as text — the stored base64 for bytes that are not text. */
  text: string;
  format: 'json' | 'text';
  binary: boolean;
  bytes: () => Uint8Array;
  /** One line of it for a list row; empty for bytes. */
  preview: string;
}

export function runMessageBody(message: SessionMessage): RunMessageBody {
  const { body } = message;
  if (message.bodyEncoding === 'base64') {
    return { text: body, format: 'text', binary: true, bytes: () => fromBase64(body), preview: '' };
  }
  const trimmed = body.trimStart();
  let format: 'json' | 'text' = 'text';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(body);
      format = 'json';
    } catch {
      format = 'text';
    }
  }
  return {
    text: body,
    format,
    binary: false,
    bytes: () => encodeBodyBytes(body),
    preview: body.replace(/\n\s*/g, ' ').slice(0, PREVIEW_MAX_CHARS),
  };
}
