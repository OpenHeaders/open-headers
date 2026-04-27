/**
 * Strip-scripts top row — surfaced above the entity tree on URL-fetch /
 * deep-link / playground sources, pre-checked. The full Advanced
 * collapse is hidden for those sources (design §5.5); this row is the
 * one protective default the user can toggle off without rummaging
 * through Advanced.
 */

import { WarningOutlined } from '@ant-design/icons';
import { Alert, Checkbox, Space, Typography } from 'antd';
import type React from 'react';
import type { ImportPreviewSource } from './types';

const { Text } = Typography;

const StripScriptsTopRow: React.FC<{
  source: ImportPreviewSource;
  stripScripts: boolean;
  onChange: (next: boolean) => void;
}> = ({ source, stripScripts, onChange }) => {
  const sourceLabel = source === 'link' ? 'deep-link' : source === 'playground' ? 'playground' : 'remote';
  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      message="Strip request scripts on import"
      description={
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pre-checked for {sourceLabel} sources — request `preRequestScript` and `postResponseScript` will be removed
            so untrusted JavaScript can't run when you click Send.
          </Text>
          <Checkbox checked={stripScripts} onChange={(e) => onChange(e.target.checked)}>
            <Text strong>Strip scripts on import</Text>
          </Checkbox>
        </Space>
      }
    />
  );
};

export default StripScriptsTopRow;
