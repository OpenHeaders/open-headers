/**
 * RedirectRuleFields — match pattern + redirect target + inline Tag.
 */

import { Form, Input, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const RedirectRuleFields: React.FC = () => {
  return (
    <>
      {/* Row 1: Match pattern + Tag inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Form.Item name="redirectMatchPattern" style={{ marginBottom: 0, flex: 1 }}>
          <Input placeholder="Match Pattern (e.g. https://old.openheaders.io/*)" />
        </Form.Item>

        <Form.Item name="tag" style={{ marginBottom: 0, width: 180 }}>
          <Input placeholder="Tag (optional)" maxLength={20} />
        </Form.Item>
      </div>

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
