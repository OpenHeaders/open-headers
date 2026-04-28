/**
 * Display labels for surface ids. Surfaces register a stable string id
 * (`workbench`, `popup`, `devpanel`); presence tooltips render them as
 * human-readable names.
 */

const LABELS: Record<string, string> = {
  workbench: 'Workbench',
  popup: 'Popup',
  devpanel: 'DevPanel',
  sidepanel: 'Side Panel',
};

export function surfaceLabel(surfaceId: string): string {
  return LABELS[surfaceId] ?? surfaceId;
}

/** Stable color per surface id, used as the chip background. */
const COLORS: Record<string, string> = {
  workbench: '#1677ff',
  popup: '#52c41a',
  devpanel: '#722ed1',
  sidepanel: '#fa8c16',
};

export function surfaceColor(surfaceId: string): string {
  return COLORS[surfaceId] ?? '#8c8c8c';
}

export function surfaceInitial(surfaceId: string): string {
  const label = surfaceLabel(surfaceId);
  return label.charAt(0).toUpperCase();
}
