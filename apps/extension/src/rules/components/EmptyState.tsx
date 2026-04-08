/**
 * EmptyState — shown when no rule is selected in the editor area.
 */

import {
  CodeOutlined,
  LinkOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import type React from 'react';

const { Title, Text } = Typography;

interface EmptyStateProps {
  onCreateRule: (type: string) => void;
}

const ruleTypes = [
  { key: 'header', icon: <SwapOutlined />, label: 'Modify Headers' },
  { key: 'block', icon: <StopOutlined />, label: 'Block Requests' },
  { key: 'redirect', icon: <SendOutlined />, label: 'Redirect Requests' },
  { key: 'query-param', icon: <LinkOutlined />, label: 'Modify Query Params' },
  { key: 'inject', icon: <CodeOutlined />, label: 'Inject Scripts/CSS' },
];

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateRule }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <Title level={4} style={{ marginBottom: 8 }}>Create a new rule</Title>
        <Text type="secondary">Select a rule from the sidebar or create one below</Text>
      </div>
      <Space direction="vertical" size={8} style={{ width: 280 }}>
        {ruleTypes.map((rt) => (
          <Button
            key={rt.key}
            icon={rt.icon}
            onClick={() => onCreateRule(rt.key)}
            block
            size="large"
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
          >
            {rt.label}
          </Button>
        ))}
      </Space>
    </div>
  );
};

export default EmptyState;
