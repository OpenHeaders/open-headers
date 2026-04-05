/**
 * SimpleTabs — lightweight tab bar that doesn't use antd's EllipsisMeasure.
 *
 * antd's Tabs component uses EllipsisMeasure internally for tab overflow detection,
 * which crashes in zero-width containers during Allotment's initial layout pass.
 * This component uses pure CSS for layout — no JavaScript measurement — so it works
 * at any container width including zero.
 *
 * Follows the same visual pattern as the existing v5-shell custom tabs
 * (TabBar, BottomPanel tabs, Inspector tabs).
 */

import { theme } from 'antd';
import type React from 'react';

export interface SimpleTab {
  key: string;
  label: React.ReactNode;
}

interface SimpleTabsProps {
  items: SimpleTab[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: React.CSSProperties;
}

export function SimpleTabs({ items, activeKey, onChange, style }: SimpleTabsProps) {
  const { token } = theme.useToken();

  return (
    <div
      className="v5-simple-tabs"
      style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, ...style }}
    >
      {items.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <span
            key={tab.key}
            className={`v5-simple-tab${isActive ? ' active' : ''}`}
            style={
              isActive
                ? { color: token.colorPrimary, borderBottomColor: token.colorPrimary }
                : { color: token.colorTextSecondary }
            }
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onChange(tab.key);
            }}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
          >
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}
