/**
 * Decimal (1000-byte) units, one decimal under 100 of a unit and a
 * thousands-separated integer above, capped at MB — the same reading a
 * browser's own storage/network surfaces give the identical byte count.
 */
export function formatSize(bytes: number | undefined): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1000) return `${bytes} B`;
  const kilobytes = bytes / 1000;
  if (kilobytes < 100) return `${kilobytes.toFixed(1)} kB`;
  if (kilobytes < 1000) return `${Math.round(kilobytes).toLocaleString()} kB`;
  const megabytes = kilobytes / 1000;
  if (megabytes < 100) return `${megabytes.toFixed(1)} MB`;
  return `${Math.round(megabytes).toLocaleString()} MB`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms == null || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

export function extractName(url: string): { name: string; detail: string } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const filename = segments.length > 0 ? segments[segments.length - 1] : parsed.hostname;
    const query = parsed.search;
    return { name: filename + query, detail: parsed.hostname };
  } catch {
    return { name: url, detail: '' };
  }
}

function extractFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || path;
  } catch {
    return url;
  }
}

/**
 * Extract a human-readable initiator string from the HAR `_initiator`
 * object, matching Chrome DevTools' Initiator column format:
 *   - script with stack -> top call frame filename:line
 *   - script/parser with url -> filename:line
 *   - fallback -> initiator type ("parser", "other", etc.)
 */
export function formatInitiator(initiator: unknown): string {
  const frame = getInitiatorFrame(initiator);
  if (frame) {
    const name = extractFilename(frame.url);
    return frame.lineNumber != null ? `${name}:${frame.lineNumber + 1}` : name;
  }
  if (!initiator || typeof initiator !== 'object') return '';
  return ((initiator as Record<string, unknown>).type as string) ?? '';
}

/**
 * Pull a `{ url, lineNumber?, columnNumber? }` frame out of a HAR
 * `_initiator` blob — the exact same shape `hostNavigation.openResource`
 * expects. Mirrors the precedence `formatInitiator` uses (stack top frame
 * first, then bare `url`/`lineNumber`), so the column label and the
 * click-to-Sources target are always consistent.
 */
export interface InitiatorFrame {
  url: string;
  lineNumber?: number;
  columnNumber?: number;
}

export function getInitiatorFrame(initiator: unknown): InitiatorFrame | null {
  if (!initiator || typeof initiator !== 'object') return null;
  const obj = initiator as Record<string, unknown>;
  const stack = obj.stack as
    | { callFrames?: Array<{ url?: string; lineNumber?: number; columnNumber?: number }> }
    | undefined;
  if (stack?.callFrames?.length) {
    const frame = stack.callFrames[0];
    if (frame.url) {
      return {
        url: frame.url,
        ...(frame.lineNumber != null ? { lineNumber: frame.lineNumber } : {}),
        ...(frame.columnNumber != null ? { columnNumber: frame.columnNumber } : {}),
      };
    }
  }
  if (typeof obj.url === 'string' && obj.url) {
    return {
      url: obj.url,
      ...(typeof obj.lineNumber === 'number' ? { lineNumber: obj.lineNumber } : {}),
      ...(typeof obj.columnNumber === 'number' ? { columnNumber: obj.columnNumber } : {}),
    };
  }
  return null;
}
