/**
 * DocsTab — free-form markdown notes for the request. Persists as the
 * optional `description` field on the `Request` schema so rationale
 * rides along in the workspace YAML (alongside the body + scripts)
 * when team sync lands.
 */

import { Input, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface DocsTabProps {
  value: string;
  onChange: (value: string) => void;
}

const DocsTab: React.FC<DocsTabProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Document this request. Markdown supported. Lands in the team-workspace YAML alongside the request body.
      </Text>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="## What does this request do?&#10;&#10;Leave context for teammates — why it exists, when to run it, expected auth scope."
        autoSize={{ minRows: 10, maxRows: 30 }}
        style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 12,
          background: token.colorBgContainer,
        }}
      />
    </div>
  );
};

export default DocsTab;
