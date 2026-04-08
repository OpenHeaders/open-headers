import { Alert } from 'antd';
import type React from 'react';

const BlockRuleFields: React.FC = () => {
  return (
    <Alert
      type="info"
      showIcon
      message="Block rule"
      description="Requests matching the domains above will be blocked. The browser will show a network error to the page."
      style={{ marginBottom: 16 }}
    />
  );
};

export default BlockRuleFields;
