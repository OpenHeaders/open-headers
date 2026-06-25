/**
 * ResponseBodyView — the response body pane. Pretty-prints JSON (via
 * `formatBody`) and flags truncation when the runner capped the body.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Typography, theme } from 'antd';
import type React from 'react';
import { formatBody, formatBytes } from './response-format';

const { Text } = Typography;

/** Body cap the runner applies before truncating — surfaced in the
 *  truncation notice. */
const BODY_CAP_BYTES = 2 * 1024 * 1024;

const ResponseBodyView: React.FC<{ response: ExecutedRequestSnapshot }> = ({ response }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      {response.bodyTruncated && (
        <Text type="warning" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
          Response truncated at {formatBytes(BODY_CAP_BYTES)} (original {formatBytes(response.bodyBytes)}).
        </Text>
      )}
      <pre
        style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 12,
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: token.colorText,
        }}
      >
        {formatBody(response)}
      </pre>
    </div>
  );
};

export default ResponseBodyView;
