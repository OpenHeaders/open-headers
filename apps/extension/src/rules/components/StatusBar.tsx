/**
 * StatusBar — bottom bar with status info and panel toggle icons.
 *
 * Left: connection status, active rules.
 * Right: version, panel toggle SVGs (sidebar, bottom, inspector).
 *
 * Mirrors the desktop V5Shell StatusBar exactly.
 */

import { useRules } from '@hooks/useRules';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import type { PanelVisibility } from '../types';

declare const __APP_VERSION__: string;

// ── Panel toggle SVG (matches desktop exactly) ──────────────────

function PanelToggle({
  title,
  active,
  position,
  onClick,
}: {
  title: string;
  active: boolean;
  position: 'left' | 'bottom' | 'right';
  onClick: () => void;
}) {
  const { token } = theme.useToken();
  const fillColor = active ? token.colorTextSecondary : 'none';
  const strokeColor = token.colorTextTertiary;

  return (
    <Tooltip title={title} placement="top">
      <div
        className="rules-panel-toggle"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClick();
        }}
        role="button"
        tabIndex={0}
      >
        <svg viewBox="0 0 16 13" width={16} height={13} role="img">
          <title>{title}</title>
          <rect x="0.5" y="0.5" width="15" height="12" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={1} />
          {position === 'left' && (
            <>
              <rect
                x="0.5"
                y="0.5"
                width="4.5"
                height="12"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="5" y1="0.5" x2="5" y2="12.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
          {position === 'bottom' && (
            <>
              <rect
                x="0.5"
                y="8.5"
                width="15"
                height="4"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="0.5" y1="8.5" x2="15.5" y2="8.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
          {position === 'right' && (
            <>
              <rect
                x="11"
                y="0.5"
                width="4.5"
                height="12"
                rx="1.5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
                opacity={active ? 0.35 : 0.15}
              />
              <line x1="11" y1="0.5" x2="11" y2="12.5" stroke={strokeColor} strokeWidth={1} />
            </>
          )}
        </svg>
      </div>
    </Tooltip>
  );
}

// ── StatusBar ───────────────────────────────────────────────────

interface StatusBarProps {
  panels: PanelVisibility;
  onTogglePanel: (panel: keyof PanelVisibility) => void;
}

const StatusBar: React.FC<StatusBarProps> = ({ panels, onTogglePanel }) => {
  const { token } = theme.useToken();
  const { isConnected, isStatusLoaded, rules } = useRules();

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div
      className="rules-statusbar"
      style={{
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorTextSecondary,
      }}
    >
      <div className="rules-statusbar-left">
        <span className="rules-statusbar-item">
          <span
            className="rules-dot"
            style={{
              background: !isStatusLoaded
                ? token.colorTextTertiary
                : isConnected
                  ? token.colorSuccess
                  : token.colorWarning,
            }}
          />
          {!isStatusLoaded ? 'Loading...' : isConnected ? 'Connected' : 'Offline'}
        </span>
        <span className="rules-statusbar-item">
          {enabledCount}/{rules.length} rule{rules.length !== 1 ? 's' : ''} active
        </span>
      </div>

      <div className="rules-statusbar-right">
        <span className="rules-statusbar-item" style={{ fontSize: 10, color: token.colorTextTertiary }}>
          v{__APP_VERSION__}
        </span>
        <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
        <div className="rules-panel-toggles">
          <PanelToggle
            title="Left sidebar"
            active={panels.sidebar}
            position="left"
            onClick={() => onTogglePanel('sidebar')}
          />
          <PanelToggle
            title="Bottom panel"
            active={panels.bottomPanel}
            position="bottom"
            onClick={() => onTogglePanel('bottomPanel')}
          />
          <PanelToggle
            title="Right sidebar"
            active={panels.inspector}
            position="right"
            onClick={() => onTogglePanel('inspector')}
          />
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
