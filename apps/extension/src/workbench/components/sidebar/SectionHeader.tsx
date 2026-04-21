import type React from 'react';
import { theme } from 'antd';

export function SectionHeader({
  title,
  expanded,
  onToggle,
  actions,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div
      className="rules-sidebar-section"
      style={{ color: token.colorTextSecondary }}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onToggle();
      }}
      role="button"
      tabIndex={-1}
    >
      <span className="rules-sidebar-section-title">
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            marginRight: 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        {title}
      </span>
      {actions && (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation guard for nested click handlers
        <span onClick={(e) => e.stopPropagation()} onKeyDown={() => {}}>
          {actions}
        </span>
      )}
    </div>
  );
}
