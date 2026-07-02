/**
 * Segmented icon toggle for a two-pane split orientation — used by the
 * request editor's request/response split and the rule editor's
 * actions/conditions split. Reuses the dock-layout split glyphs so the
 * affordance reads the same as the tab strip's "Split and Move" menu:
 * side-by-side (`split-right`) vs stacked (`split-down`).
 */

import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import type { SplitLayout } from '../../hooks/useSplitLayoutPreference';
import LayoutMenuIcon from '../shell/LayoutMenuIcon';

interface SplitLayoutToggleProps {
  layout: SplitLayout;
  onChange: (next: SplitLayout) => void;
}

const SplitLayoutToggle: React.FC<SplitLayoutToggleProps> = ({ layout, onChange }) => {
  const { token } = theme.useToken();
  const renderButton = (value: SplitLayout, kind: 'split-right' | 'split-down', tip: string) => {
    const active = layout === value;
    return (
      <Tooltip title={tip}>
        <Button
          type="text"
          size="small"
          aria-pressed={active}
          onClick={() => onChange(value)}
          icon={<LayoutMenuIcon kind={kind} size={15} />}
          style={{
            width: 28,
            height: 22,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: active ? token.colorFillSecondary : undefined,
          }}
        />
      </Tooltip>
    );
  };
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {renderButton('horizontal', 'split-right', 'Horizontal layout — side by side')}
      {renderButton('vertical', 'split-down', 'Vertical layout — stacked')}
    </div>
  );
};

export default SplitLayoutToggle;
