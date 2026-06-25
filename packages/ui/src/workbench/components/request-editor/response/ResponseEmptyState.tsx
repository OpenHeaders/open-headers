/**
 * Placeholder shown in the response pane before the first Send (and
 * while one is in flight). The pane stays attached so the divider +
 * layout toggle are reachable from the start.
 */

import { CaretRightOutlined, LoadingOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

const ResponseEmptyState: React.FC<{ sending: boolean }> = ({ sending }) => {
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
      {sending ? (
        <>
          <LoadingOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Sending request…
          </Text>
        </>
      ) : (
        <>
          <CaretRightOutlined style={{ fontSize: 20, color: token.colorTextQuaternary }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Send the request to see the response here.
          </Text>
        </>
      )}
    </div>
  );
};

export default ResponseEmptyState;
