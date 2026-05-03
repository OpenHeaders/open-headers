/**
 * Render a millisecond duration as a compact "Xs / Xm / Xh ago" string.
 *
 * Tuned for awareness chip subtitles where space is tight. Negatives
 * clamp to "just now" — a peer's HLC briefly running ahead of local is
 * normal under skew and shouldn't surface as nonsense like "-3s ago".
 */

export function formatAgo(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1500) return 'just now';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
