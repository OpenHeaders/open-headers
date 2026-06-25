/**
 * ResponseHeadersView — flat key/value listing of the response headers.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

const ResponseHeadersView: React.FC<{ headers: ExecutedRequestSnapshot['headers'] }> = ({ headers }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      {headers.map((h) => (
        <div key={`${h.key}:${h.value}`} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '2px 0' }}>
          <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, minWidth: 180 }}>
            {h.key}
          </Text>
          <Text
            style={{
              fontFamily: "'SF Mono', monospace",
              fontSize: 11,
              wordBreak: 'break-all',
              color: token.colorTextSecondary,
            }}
          >
            {h.value}
          </Text>
        </div>
      ))}
    </div>
  );
};

export default ResponseHeadersView;
