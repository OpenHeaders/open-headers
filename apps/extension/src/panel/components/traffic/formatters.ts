export function formatSize(bytes: number | undefined): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export function statusClass(code: number | undefined): string {
  if (code == null) return '';
  if (code >= 500) return 'dt-col-status--5xx';
  if (code >= 400) return 'dt-col-status--4xx';
  if (code >= 300) return 'dt-col-status--3xx';
  if (code >= 200 && code < 300) return 'dt-col-status--2xx';
  return '';
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
  if (!initiator || typeof initiator !== 'object') return '';
  const obj = initiator as Record<string, unknown>;
  const type = (obj.type as string) ?? '';

  const stack = obj.stack as { callFrames?: Array<{ url?: string; lineNumber?: number }> } | undefined;
  if (stack?.callFrames?.length) {
    const frame = stack.callFrames[0];
    if (frame.url) {
      const name = extractFilename(frame.url);
      return frame.lineNumber != null ? `${name}:${frame.lineNumber + 1}` : name;
    }
  }

  if (typeof obj.url === 'string' && obj.url) {
    const name = extractFilename(obj.url);
    return typeof obj.lineNumber === 'number' ? `${name}:${obj.lineNumber + 1}` : name;
  }

  return type;
}
