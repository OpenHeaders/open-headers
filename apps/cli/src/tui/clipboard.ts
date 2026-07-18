/**
 * OSC 52 clipboard write — the `y` yank path (TUI_DESIGN.md §2). The
 * terminal owns the actual clipboard; we emit the escape and confirm
 * in the status bar. Works over ssh where no local clipboard API can.
 */

import { Buffer } from 'node:buffer';

export function osc52Copy(text: string): string {
  return `\x1b]52;c;${Buffer.from(text, 'utf-8').toString('base64')}\x07`;
}
