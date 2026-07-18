/**
 * Screen buffer + diff renderer. A frame is an array of pre-styled
 * rows; render() rewrites only the rows that changed since the last
 * frame and flushes them as a single write (the flicker-free budget
 * the Phase 1 spike proved at 200×60). Rows never wrap: composers
 * truncate with truncateToWidth (ANSI-aware) and the session disables
 * autowrap as the terminal-level backstop.
 */

import type { TerminalSize, TtyOutput } from './tty';

export interface ScreenRenderer {
  /** Paint a frame; rows beyond the terminal height are dropped, missing rows cleared. */
  render(frame: readonly string[]): void;
  /** New geometry — invalidates the buffer so the next render repaints everything. */
  resize(size: TerminalSize): void;
  readonly size: TerminalSize;
}

export function createScreenRenderer(output: TtyOutput, initial: TerminalSize): ScreenRenderer {
  let size = initial;
  let previous: readonly string[] = [];
  let repaint = true;

  function render(frame: readonly string[]): void {
    const visible = Math.min(frame.length, size.rows);
    let out = '';
    for (let i = 0; i < visible; i += 1) {
      const row = frame[i] ?? '';
      if (!repaint && previous[i] === row) continue;
      out += `\x1b[${i + 1};1H\x1b[2K${row}`;
    }
    const stale = repaint ? size.rows : Math.min(previous.length, size.rows);
    for (let i = visible; i < stale; i += 1) {
      out += `\x1b[${i + 1};1H\x1b[2K`;
    }
    previous = frame.slice(0, visible);
    repaint = false;
    if (out !== '') output.write(out);
  }

  function resize(next: TerminalSize): void {
    size = next;
    repaint = true;
  }

  return {
    render,
    resize,
    get size() {
      return size;
    },
  };
}

function isSgrStart(text: string, index: number): number {
  if (!text.startsWith('\x1b[', index)) return -1;
  const end = text.indexOf('m', index + 2);
  if (end === -1) return -1;
  for (let i = index + 2; i < end; i += 1) {
    const code = text.charCodeAt(i);
    const digit = code >= 0x30 && code <= 0x39;
    if (!digit && code !== 0x3b) return -1;
  }
  return end + 1;
}

/** Display cells a styled string occupies — SGR sequences count zero, other code points one. */
export function visibleWidth(text: string): number {
  let cells = 0;
  let i = 0;
  while (i < text.length) {
    const afterSgr = isSgrStart(text, i);
    if (afterSgr !== -1) {
      i = afterSgr;
      continue;
    }
    cells += 1;
    i += (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
  }
  return cells;
}

/** Remove SGR sequences — a styled row reduced to its plain cells (overlay dim wash). */
export function stripSgr(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const afterSgr = isSgrStart(text, i);
    if (afterSgr !== -1) {
      i = afterSgr;
      continue;
    }
    const step = (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
    out += text.slice(i, i + step);
    i += step;
  }
  return out;
}

/** Cells [start, end) of a plain (SGR-free) string — overlay row splicing. */
export function sliceCells(text: string, start: number, end: number): string {
  let out = '';
  let cell = 0;
  let i = 0;
  while (i < text.length && cell < end) {
    const step = (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
    if (cell >= start) out += text.slice(i, i + step);
    cell += 1;
    i += step;
  }
  return out;
}

/**
 * Clip a styled string to `width` display cells, ellipsis at the cell
 * edge (design §5.3: truncation, never wrapping). SGR sequences pass
 * through uncounted; a truncated styled string is closed with a reset
 * after the ellipsis so styling never leaks into the next cell.
 */
export function truncateToWidth(text: string, width: number, ellipsis = '…'): string {
  if (width <= 0) return '';
  const budget = Math.max(0, width - visibleWidth(ellipsis));
  let cells = 0;
  let styled = false;
  let cut = -1;
  let hardCut = -1;
  let i = 0;
  while (i < text.length) {
    const afterSgr = isSgrStart(text, i);
    if (afterSgr !== -1) {
      styled = true;
      i = afterSgr;
      continue;
    }
    if (cells === budget && cut === -1) cut = i;
    if (cells === width && hardCut === -1) hardCut = i;
    cells += 1;
    i += (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
  }
  if (cells <= width) return text;
  const reset = styled ? '\x1b[0m' : '';
  if (budget === 0) return `${hardCut === -1 ? text : text.slice(0, hardCut)}${reset}`;
  return `${cut === -1 ? '' : text.slice(0, cut)}${ellipsis}${reset}`;
}
