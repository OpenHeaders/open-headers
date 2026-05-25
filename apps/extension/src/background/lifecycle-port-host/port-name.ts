/**
 * Port name parsing for the lifecycle pipe. New, versionless namespace
 * (`oh-lifecycle:`) distinct from the legacy `devtools-inspector:` /
 * `devtools-har-source:` pipes — both pipes run side by side until W-b
 * deletes the legacy wire shape.
 */

export const LIFECYCLE_PORT_PREFIX = 'oh-lifecycle:';

/** Parse `oh-lifecycle:<tabId>`. Returns `null` for any other shape. */
export function parseLifecyclePortName(name: string): number | null {
  if (!name.startsWith(LIFECYCLE_PORT_PREFIX)) return null;
  const parsed = Number.parseInt(name.slice(LIFECYCLE_PORT_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function lifecyclePortName(tabId: number): string {
  return `${LIFECYCLE_PORT_PREFIX}${tabId}`;
}
