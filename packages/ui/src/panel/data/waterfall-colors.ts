/**
 * Resource-type palette for the Waterfall bar.
 *
 * The simplified bar is colored by resource type rather than by timing phase:
 * a soft pastel fill per type, a slightly lighter shade for the waiting
 * (latency) half, and a darker outline so the pale fills stay legible. Kept
 * pure (no React) so the geometry/tests can reason about a bar's colors
 * without rendering it.
 */

/** [hue, saturation, lightness] base for each resource type. */
const TYPE_HSL: Record<string, [number, number, number]> = {
  document: [215, 100, 80],
  stylesheet: [272, 64, 80],
  script: [31, 100, 80],
  xhr: [53, 100, 80],
  image: [90, 50, 80],
  media: [90, 50, 80],
  font: [8, 100, 80],
  websocket: [0, 0, 85],
  wasm: [262, 60, 80],
  other: [0, 0, 85],
};

export interface BarColors {
  waiting: string;
  download: string;
  border: string;
}

/** Collapse the many raw resource-type spellings onto a palette key. */
function typeKey(resourceType: string | undefined): string {
  const rt = (resourceType ?? '').toLowerCase();
  if (rt === 'main_frame' || rt === 'sub_frame' || rt === 'document') return 'document';
  if (rt === 'xmlhttprequest' || rt === 'fetch' || rt === 'xhr') return 'xhr';
  if (rt === 'js') return 'script';
  if (rt === 'css') return 'stylesheet';
  if (rt === 'img') return 'image';
  return TYPE_HSL[rt] ? rt : 'other';
}

export function barColors(resourceType: string | undefined): BarColors {
  const [h, s, l] = TYPE_HSL[typeKey(resourceType)];
  return {
    download: `hsl(${h} ${s}% ${l}%)`,
    waiting: `hsl(${h} ${s}% ${Math.min(Math.round(l * 1.1), 96)}%)`,
    border: `hsl(${h} ${Math.round(s / 2)}% ${Math.max(l - 20, 0)}%)`,
  };
}
