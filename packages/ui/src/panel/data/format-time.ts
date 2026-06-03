/**
 * Higher-resolution time formatting for the Network panel, mirroring the
 * reference browser's unit formatter: integer microseconds below 0.1 ms,
 * 2-decimal milliseconds below a second, 2-decimal seconds below a minute,
 * then minutes. Built on `Intl.NumberFormat` unit styling so the output is
 * identical to the browser's own labels.
 */

function unit(u: string, display: 'narrow' | 'short', fraction: number): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: u,
    unitDisplay: display,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}

const microseconds = unit('microsecond', 'narrow', 0);
const milliseconds = unit('millisecond', 'narrow', 2);
const seconds = unit('second', 'narrow', 2);
const minutes = unit('minute', 'short', 1);

export function formatTimeMs(ms: number): string {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 0.1) return microseconds.format(ms * 1000);
  if (ms < 1000) return milliseconds.format(ms);
  const s = ms / 1000;
  if (s < 60) return seconds.format(s);
  return minutes.format(s / 60);
}
