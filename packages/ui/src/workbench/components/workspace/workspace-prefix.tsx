/**
 * renderWorkspacePrefix — single place that decides how a workspace's
 * prefix indicator is drawn. One of two shapes, never both:
 *
 *   - icon set  → TwoTone icon, color applied as the two-tone primary
 *   - icon unset → plain color square filled with the palette color
 *
 * Every surface that renders a workspace prefix (switcher trigger,
 * switcher dropdown rows, popup pill, manager row, identity picker
 * trigger) calls this helper so the two rendering modes stay in sync.
 */

import type { GlobalToken } from 'antd/es/theme/interface';
import type React from 'react';
import { renderTwoToneIcon } from '../shared/TwoToneIconPicker';
import { resolveWorkspaceColor, resolveWorkspaceIconColor } from './workspace-colors';

export interface WorkspacePrefixInput {
  icon?: string;
  color?: string;
}

export interface WorkspacePrefixOptions {
  /**
   * Outer box size in pixels. Icon font-size is derived as
   * `round(size * 0.8)` so the glyph carries the same visual weight
   * as the color square. Pass whatever fits the surface (22-28px for
   * menu rows, 14-16px inline in dense labels).
   */
  size: number;
  /** Extra styles merged into the wrapper. Use for margin/flex tuning. */
  style?: React.CSSProperties;
}

export function renderWorkspacePrefix(
  workspace: WorkspacePrefixInput,
  token: GlobalToken,
  options: WorkspacePrefixOptions,
): React.ReactNode {
  const { size, style } = options;
  const wrapperBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
    ...style,
  };

  if (workspace.icon) {
    return (
      <span aria-hidden style={wrapperBase}>
        {renderTwoToneIcon(
          workspace.icon,
          { fontSize: Math.round(size * 0.8) },
          resolveWorkspaceIconColor(workspace.color, token),
        )}
      </span>
    );
  }

  // Color-square mode — no icon selected.
  const squareSize = Math.round(size * 0.6);
  return (
    <span aria-hidden style={wrapperBase}>
      <span
        style={{
          display: 'inline-block',
          width: squareSize,
          height: squareSize,
          borderRadius: 3,
          background: resolveWorkspaceColor(workspace.color, token),
          border: `1px solid ${token.colorBorder}`,
        }}
      />
    </span>
  );
}
