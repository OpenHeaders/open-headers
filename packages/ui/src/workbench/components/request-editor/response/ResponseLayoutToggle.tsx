/**
 * Segmented icon toggle for the request/response split orientation.
 * Reuses the dock-layout split glyphs so the affordance reads the same
 * as the tab strip's "Split and Move" menu: side-by-side (`split-right`)
 * vs stacked (`split-down`).
 */

import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import LayoutMenuIcon from '../../LayoutMenuIcon';
import type { RequestEditorLayout } from '../useRequestEditorLayout';

interface ResponseLayoutToggleProps {
  layout: RequestEditorLayout;
  onChange: (next: RequestEditorLayout) => void;
}

const ResponseLayoutToggle: React.FC<ResponseLayoutToggleProps> = ({ layout, onChange }) => {
  const { token } = theme.useToken();
  const renderButton = (value: RequestEditorLayout, kind: 'split-right' | 'split-down', tip: string) => {
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

export default ResponseLayoutToggle;
