import { Form, Input } from 'antd';
import type React from 'react';

const RedirectRuleFields: React.FC = () => {
  return (
    <>
      <Form.Item
        name="redirectMatchPattern"
        label="Match Pattern"
        extra="URL pattern to match. Leave empty to match all requests to the domains above."
      >
        <Input placeholder="e.g. https://old.openheaders.io/*" />
      </Form.Item>

      <Form.Item
        name="redirectTo"
        label="Redirect To"
      >
        <Input placeholder="e.g. https://new.openheaders.io/$1" />
      </Form.Item>
    </>
  );
};

export default RedirectRuleFields;
