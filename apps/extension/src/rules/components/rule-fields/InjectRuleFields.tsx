/**
 * InjectRuleFields — type toggle, position, code with syntax highlighting.
 */

import { Form, Radio, Select, Typography } from 'antd';
import type React from 'react';
import CodeEditor from '../CodeEditor';

const { Text } = Typography;

const InjectRuleFields: React.FC = () => {
  const injectType = Form.useWatch('injectType');
  const language = injectType === 'css' ? 'css' : 'javascript';

  return (
    <>
      {/* Row 1: Type toggle + Position — all inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <Form.Item name="injectType" style={{ marginBottom: 0 }}>
          <Radio.Group optionType="button" buttonStyle="solid" size="small">
            <Radio.Button value="script">JavaScript</Radio.Button>
            <Radio.Button value="css">CSS</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="injectPosition" style={{ marginBottom: 0, width: 220 }}>
          <Select>
            <Select.Option value="head">Document Start (head)</Select.Option>
            <Select.Option value="body-start">Document End (body start)</Select.Option>
            <Select.Option value="body-end">Document Idle (body end)</Select.Option>
          </Select>
        </Form.Item>
      </div>

      {/* Code editor */}
      <Form.Item
        name="injectCode"
        label={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Code
          </Text>
        }
        style={{ marginBottom: 16 }}
      >
        <CodeEditor
          language={language}
          placeholder={
            language === 'css'
              ? '/* Enter CSS rules */\nbody {\n  background: #f0f0f0;\n}'
              : '// Enter JavaScript code\nconsole.log("Hello from Open Headers");'
          }
          minHeight={180}
        />
      </Form.Item>
    </>
  );
};

export default InjectRuleFields;
