/**
 * Time-cell formatting for the message-stream grids (WS frames / SSE
 * events). The cell shows the local wall-clock instant at millisecond
 * resolution (`HH:MM:SS.mmm`); the tooltip carries the full locale
 * date-time, matching the host's Messages / EventStream tabs.
 */

export function formatStreamTime(atMs: number): string {
  const d = new Date(atMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

export function streamTimeTooltip(atMs: number): string {
  return new Date(atMs).toLocaleString();
}
