/**
 * EmptyState — shown when no rule is selected in the editor area.
 */

import { Button, Space, Tooltip, Typography } from 'antd';
import type React from 'react';
import { ALL_RULE_TYPES } from '../rule-type-menu';

const { Title, Text } = Typography;

interface EmptyStateProps {
  onCreateRule: (type: string) => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateRule }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 24,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Title level={4} style={{ marginBottom: 8 }}>
          Create a new rule
        </Title>
        <Text type="secondary">Select a rule from the sidebar or create one below</Text>
      </div>
      <Space direction="vertical" size={8} style={{ width: 280 }}>
        {ALL_RULE_TYPES.map((rt) => (
          <Tooltip
            key={rt.key}
            title={rt.desktopOnly ? 'Available in desktop app — requires HTTP proxy' : rt.description}
          >
            <Button
              icon={rt.icon}
              onClick={rt.desktopOnly ? undefined : () => onCreateRule(rt.key)}
              disabled={rt.desktopOnly}
              block
              size="large"
              style={{ textAlign: 'left', justifyContent: 'flex-start', opacity: rt.desktopOnly ? 0.45 : 1 }}
            >
              {rt.label}
            </Button>
          </Tooltip>
        ))}
      </Space>
    </div>
  );
};

export default EmptyState;
