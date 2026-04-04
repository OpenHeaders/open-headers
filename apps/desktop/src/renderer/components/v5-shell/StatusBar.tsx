/**
 * StatusBar — bottom bar with status info and panel toggle icons.
 *
 * Left: clients, active rules, git sync.
 * Right: workspace, environment, version, panel toggles.
 */

import { Tooltip, theme } from 'antd';

interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}

interface StatusBarProps {
  panels: PanelVisibility;
  onTogglePanel: (panel: keyof PanelVisibility) => void;
}

function PanelToggle({
  title,
  shortcut,
  active,
  position,
  onClick,
}: {
  title: string;
  shortcut: string;
  active: boolean;
  position: 'left' | 'bottom' | 'right';
  onClick: () => void;
}) {
  const { token } = theme.useToken();
  const fillColor = active ? token.colorTextSecondary : 'none';
  const strokeColor = token.colorTextTertiary;

  return (
    <Tooltip title={`${title} (${shortcut})`}>
      <div
        className="v5-panel-toggle"
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

export function StatusBar({ panels, onTogglePanel }: StatusBarProps) {
  const { token } = theme.useToken();

  return (
    <div
      className="v5-statusbar"
      style={{
        background: token.colorBgElevated,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorTextSecondary,
      }}
    >
      <div className="v5-statusbar-left">
        <span className="v5-statusbar-item">
          <span className="v5-dot" style={{ background: token.colorSuccess }} />0 clients
        </span>
        <span className="v5-statusbar-item">0 rules active</span>
        <span className="v5-statusbar-item">Local workspace</span>
      </div>

      <div className="v5-statusbar-right">
        <span className="v5-statusbar-item">Personal Workspace</span>
        <span className="v5-statusbar-item">Development</span>
        <span className="v5-statusbar-item" style={{ opacity: 0.5 }}>
          vNEXT
        </span>

        <div className="v5-statusbar-divider" style={{ background: token.colorBorderSecondary }} />

        <div className="v5-panel-toggles">
          <PanelToggle
            title="Toggle sidebar"
            shortcut="⌘B"
            active={panels.sidebar}
            position="left"
            onClick={() => onTogglePanel('sidebar')}
          />
          <PanelToggle
            title="Toggle bottom panel"
            shortcut="⌘J"
            active={panels.bottomPanel}
            position="bottom"
            onClick={() => onTogglePanel('bottomPanel')}
          />
          <PanelToggle
            title="Toggle inspector"
            shortcut="⌥⌘\"
            active={panels.inspector}
            position="right"
            onClick={() => onTogglePanel('inspector')}
          />
        </div>
      </div>
    </div>
  );
}
