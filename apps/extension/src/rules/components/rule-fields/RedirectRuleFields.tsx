/**
 * RedirectRuleFields — match pattern + redirect target.
 */

import { Form, Input, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const RedirectRuleFields: React.FC = () => {
  return (
    <>
      {/* Row 1: Match pattern */}
      <Form.Item name="redirectMatchPattern" style={{ marginBottom: 16 }}>
        <Input placeholder="Match Pattern (e.g. https://old.openheaders.io/*)" />
      </Form.Item>

      {/* Row 2: Redirect To */}
      <Form.Item name="redirectTo" style={{ marginBottom: 16 }}>
        <Input placeholder="Redirect To (e.g. https://new.openheaders.io/$1)" />
      </Form.Item>

      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 16 }}>
        Leave Match Pattern empty to redirect all requests to the domains below.
      </Text>
    </>
  );
};

export default RedirectRuleFields;
