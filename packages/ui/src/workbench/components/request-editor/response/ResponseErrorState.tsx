/**
 * Error state for a failed send — there is no wire response to tab
 * through, so the pane explains the failure instead of mounting an
 * empty Body/Headers tab set with the error crammed into the header.
 * Mirrors ResponseEmptyState's centered grey-icon layout so the two
 * placeholder states read as one family.
 */

import { DisconnectOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

const ResponseErrorState: React.FC<{ error: string }> = ({ error }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 0,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <DisconnectOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
      <Text strong style={{ fontSize: 12 }}>
        Could not send request
      </Text>
      <Text type="secondary" style={{ fontSize: 12, maxWidth: 460 }} data-testid="oh-response-error">
        {error}
      </Text>
    </div>
  );
};

export default ResponseErrorState;
