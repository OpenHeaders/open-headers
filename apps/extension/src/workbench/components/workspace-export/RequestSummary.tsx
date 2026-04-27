/**
 * RequestSummary — preview-modal disclosure for an incoming Request.
 *
 * Surfaces:
 *   - Method + URL one-liner.
 *   - "Executes JavaScript" badge when `preRequestScript` /
 *     `postResponseScript` are present (design §5.2 / §5.5).
 *   - First ~200 chars of each script behind a "View full" toggle
 *     (read-only, monospace) so the recipient can audit before importing.
 *
 * Untrusted-string discipline (§4.1 gate 10): script source is rendered
 * as a React text node (no `dangerouslySetInnerHTML`, no markdown).
 */

import { CodeOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';

const { Text } = Typography;

const SCRIPT_PREVIEW_CHARS = 200;

interface RequestSummaryProps {
  request: V5.Request;
}

const RequestSummary: React.FC<RequestSummaryProps> = ({ request }) => {
  const [expanded, setExpanded] = useState(false);
  const hasPre = !!request.preRequestScript;
  const hasPost = !!request.postResponseScript;
  const hasScripts = hasPre || hasPost;
  const shortPre = hasPre ? truncate(request.preRequestScript ?? '', SCRIPT_PREVIEW_CHARS) : null;
  const shortPost = hasPost ? truncate(request.postResponseScript ?? '', SCRIPT_PREVIEW_CHARS) : null;
  return (
    <div style={{ fontSize: 11, lineHeight: 1.4 }}>
      <Text type="secondary">
        <Text code style={{ fontSize: 10 }}>
          {request.method}
        </Text>{' '}
        <Text>{request.url}</Text>
      </Text>
      {hasScripts && (
        <div style={{ marginTop: 4 }}>
          <Tooltip title="This request runs JavaScript when you click Send. Strip scripts in Advanced if you don't trust the sender.">
            <Tag color="orange" icon={<CodeOutlined />} style={{ fontSize: 10 }}>
              executes JavaScript
            </Tag>
          </Tooltip>
          <Button type="link" size="small" onClick={() => setExpanded((e) => !e)} style={{ padding: 0 }}>
            {expanded ? 'Hide scripts' : 'View scripts'}
          </Button>
          {expanded && (
            <div style={{ marginTop: 4 }}>
              {hasPre && (
                <ScriptBlock
                  label="pre-request"
                  source={shortPre ?? ''}
                  truncated={(request.preRequestScript ?? '').length > SCRIPT_PREVIEW_CHARS}
                />
              )}
              {hasPost && (
                <ScriptBlock
                  label="post-response"
                  source={shortPost ?? ''}
                  truncated={(request.postResponseScript ?? '').length > SCRIPT_PREVIEW_CHARS}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ScriptBlock: React.FC<{ label: string; source: string; truncated: boolean }> = ({ label, source, truncated }) => (
  <div style={{ marginTop: 4 }}>
    <Text type="secondary" style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4 }}>
      {label.toUpperCase()}
    </Text>
    <pre
      style={{
        margin: '2px 0 0 0',
        padding: 8,
        background: 'var(--ant-color-fill-tertiary, #f5f5f5)',
        border: '1px solid var(--ant-color-border-secondary, #e8e8e8)',
        borderRadius: 4,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: 11,
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 160,
        overflowY: 'auto',
      }}
    >
      {source}
      {truncated && '\n…'}
    </pre>
    {truncated && (
      <Text type="secondary" style={{ fontSize: 10 }}>
        Truncated at {SCRIPT_PREVIEW_CHARS} chars — full source available in the request inspector after import.
      </Text>
    )}
  </div>
);

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export default RequestSummary;
