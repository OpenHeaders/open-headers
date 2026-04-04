/**
 * EditorArea — editor content area (rendered inside the tab/breadcrumb container).
 *
 * Placeholder: shows a welcome screen until tab content is implemented.
 */

import { ApiOutlined, PlusOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Space, Typography, theme } from 'antd';
import appIcon from '@/renderer/images/icon128.png';

const { Title, Text } = Typography;

export function EditorArea() {
  const { token } = theme.useToken();

  return (
    <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
      <img src={appIcon} alt="Open Headers" style={{ width: 48, height: 48, marginBottom: 16 }} />
      <Title level={3} style={{ marginBottom: 4 }}>
        Open Headers — Next
      </Title>
      <Text type="secondary" style={{ marginBottom: 32 }}>
        The definitive open-source browser DevTools platform
      </Text>

      <Space direction="vertical" size={12} style={{ width: '100%', maxWidth: 320 }}>
        <Button type="primary" icon={<ApiOutlined />} block>
          <PlusOutlined /> New Request
        </Button>
        <Button icon={<ThunderboltOutlined />} block>
          <PlusOutlined /> New Rule
        </Button>
        <Button icon={<RocketOutlined />} block>
          Import from Postman / Bruno / Insomnia
        </Button>
      </Space>
    </div>
  );
}
