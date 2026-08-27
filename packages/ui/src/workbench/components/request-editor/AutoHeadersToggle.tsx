/**
 * AutoHeadersToggle — the "N hidden" / "Hide auto-generated headers"
 * button above a headers table, with the info tooltip that appears
 * while the generated rows are shown. Shared by the HTTP and WebSocket
 * editors so the hidden-headers affordance reads the same on both.
 */

import { EyeInvisibleOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

interface AutoHeadersToggleProps {
  shown: boolean;
  /** Number of generated rows the toggle reveals. */
  count: number;
  onToggle: () => void;
}

const AutoHeadersToggle: React.FC<AutoHeadersToggleProps> = ({ shown, count, onToggle }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Button
        size="small"
        type="text"
        icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={onToggle}
        style={{ color: token.colorTextSecondary, fontSize: 12 }}
      >
        {shown
          ? t('workbench.editors.request.headers.hideAuto')
          : t('workbench.editors.request.headers.hiddenCount', { count })}
      </Button>
      {shown && (
        <Tooltip title={t('workbench.editors.request.headers.autoInfo')}>
          <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: 12, cursor: 'help' }} />
        </Tooltip>
      )}
    </div>
  );
};

export default AutoHeadersToggle;
