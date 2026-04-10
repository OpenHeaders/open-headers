/**
 * InjectRuleFields — language, code source, position, and code/URL editor.
 *
 * 4 combinations:
 *   JS + CODE  — syntax-highlighted JS editor, prefilled with <script> template
 *   JS + URL   — URL input + read-only <script src="..."> preview
 *   CSS + CODE — syntax-highlighted CSS editor, prefilled with <style> template
 *   CSS + URL  — URL input + read-only <link href="..."> preview
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Form, Input, Select, Typography } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';
import CodeEditor from '../CodeEditor';

const { Text } = Typography;

const TEMPLATES = {
  js: 'console.log("Hello World");',
  css: 'body {\n  background-color: #fff;\n}',
  'js-url':
    '<script src="{{scriptURL}}" type="text/javascript">\n  // Custom attributes to the script can be added here.\n  // Everything else will be ignored.\n</script>',
  'css-url':
    '<link href="{{scriptURL}}" rel="stylesheet" type="text/css">\n<!--\n  Custom attributes to the script can be added here.\n  Everything else will be ignored\n-->',
};

const InjectRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();
  const form = Form.useFormInstance();
  const injectType = Form.useWatch('injectType');
  const codeSource = Form.useWatch('injectSource');
  const language = injectType === 'css' ? 'css' : 'javascript';
  const prevTypeRef = useRef(injectType);

  // Prefill code template when empty or when switching language
  useEffect(() => {
    const code = form.getFieldValue('injectCode') as string;
    const templateValues = Object.values(TEMPLATES);
    const isTemplate = !code?.trim() || templateValues.includes(code);
    if (isTemplate) {
      form.setFieldValue('injectCode', injectType === 'css' ? TEMPLATES.css : TEMPLATES.js);
    }
    prevTypeRef.current = injectType;
  }, [injectType, form]);

  const urlPreview = injectType === 'css' ? TEMPLATES['css-url'] : TEMPLATES['js-url'];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId(injectType === 'css' ? 'inject-css' : 'inject-script', 'action'))}
        />
      </div>
      {/* Row 1: Language + Code Source + Insert timing — all inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Language:
          </Text>
          <Form.Item name="injectType" style={{ marginBottom: 0 }}>
            <Select
              size="small"
              style={{ width: 90 }}
              options={[
                { value: 'script', label: 'JS' },
                { value: 'css', label: 'CSS' },
              ]}
            />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Code Source:
          </Text>
          <Form.Item name="injectSource" style={{ marginBottom: 0 }}>
            <Select
              size="small"
              style={{ width: 90 }}
              options={[
                { value: 'code', label: 'CODE' },
                { value: 'url', label: 'URL' },
              ]}
            />
          </Form.Item>
        </div>

        {injectType !== 'css' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Insert:
            </Text>
            <Form.Item name="injectPosition" style={{ marginBottom: 0 }}>
              <Select
                size="small"
                style={{ width: 170 }}
                options={[
                  { value: 'body-end', label: 'After Page Load' },
                  { value: 'head', label: 'As Soon As Possible' },
                ]}
              />
            </Form.Item>
          </div>
        )}
      </div>

      {/* URL mode */}
      {codeSource === 'url' ? (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Source
          </Text>
          <Form.Item name="injectSourceUrl" style={{ marginBottom: 8 }}>
            <Input size="small" placeholder="Enter Source URL (relative or absolute)" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Code
          </Text>
          <CodeEditor language={language} value={urlPreview} readOnly minHeight={100} />
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Code
          </Text>
          <Form.Item name="injectCode" style={{ marginBottom: 0 }}>
            <CodeEditor language={language} minHeight={180} />
          </Form.Item>
        </div>
      )}
    </div>
  );
};

export default InjectRuleFields;
