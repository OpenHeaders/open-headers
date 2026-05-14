/**
 * Workspace accent colors — shared palette used by the switcher pill,
 * manager color picker, and any other surface that needs to render a
 * workspace accent.
 *
 * Keys (not hex values) are persisted in storage so users can re-theme
 * the palette without invalidating existing data. The `neutral` key is
 * the default — unset `color` field resolves to a subtle token-derived
 * gray so workspaces created before color was chosen still render.
 */

import type { GlobalToken } from 'antd/es/theme/interface';

/**
 * Default two-tone icon for newly-created workspaces (seeded default
 * + initial value in the create-workspace form). Users can clear the
 * icon in the picker to fall back to the plain color square; they
 * can also pick any other icon from the registry. Exported so the
 * background `workspace-store` stamps the same key at boot.
 */
export const DEFAULT_WORKSPACE_ICON = 'AppstoreTwoTone';

export type WorkspaceColorKey = 'neutral' | 'blue' | 'cyan' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'yellow';

export const WORKSPACE_COLOR_KEYS: readonly WorkspaceColorKey[] = [
  'neutral',
  'blue',
  'cyan',
  'green',
  'orange',
  'pink',
  'purple',
  'red',
  'yellow',
];

const PALETTE: Record<Exclude<WorkspaceColorKey, 'neutral'>, string> = {
  blue: '#1677ff',
  cyan: '#08979c',
  green: '#52c41a',
  orange: '#fa8c16',
  pink: '#eb2f96',
  purple: '#722ed1',
  red: '#ff4d4f',
  yellow: '#faad14',
};

/**
 * Resolve a workspace color key (may be undefined / unknown) to a CSS
 * color string. Falls back to a subtle border-secondary token so
 * colorless workspaces still render a visible chip.
 */
export function resolveWorkspaceColor(key: string | undefined, token: GlobalToken): string {
  if (!key || key === 'neutral') return token.colorBorder;
  if (key in PALETTE) return PALETTE[key as Exclude<WorkspaceColorKey, 'neutral'>];
  // Accept raw hex for forward-compatibility (team workspaces set by
  // desktop YAML might ship with a direct color in v2).
  if (key.startsWith('#')) return key;
  return token.colorBorder;
}

/**
 * Resolve the primary color for a workspace's two-tone icon. Same
 * palette as {@link resolveWorkspaceColor} except the `neutral` key
 * (and undefined) both map to the theme's `colorPrimary` — a visible
 * accent instead of the subtle border-secondary gray that the chip
 * uses. Gray two-tone icons look broken; a themed primary reads as
 * intentional.
 */
export function resolveWorkspaceIconColor(key: string | undefined, token: GlobalToken): string {
  if (!key || key === 'neutral') return token.colorPrimary;
  if (key in PALETTE) return PALETTE[key as Exclude<WorkspaceColorKey, 'neutral'>];
  if (key.startsWith('#')) return key;
  return token.colorPrimary;
}

export function isValidWorkspaceColorKey(value: string | undefined): value is WorkspaceColorKey {
  if (!value) return false;
  return (WORKSPACE_COLOR_KEYS as readonly string[]).includes(value);
}
