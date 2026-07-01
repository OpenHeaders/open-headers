/**
 * InjectRuleFields — language, code source, position, and code/URL editor.
 *
 * 4 combinations:
 *   JS + CODE  — syntax-highlighted JS editor, prefilled with <script> template
 *   JS + URL   — URL input + read-only <script src="..."> preview
 *   CSS + CODE — syntax-highlighted CSS editor, prefilled with <style> template
 *   CSS + URL  — URL input + read-only <link href="..."> preview
 *
 * All conditional rendering goes through `Form.Item shouldUpdate` so the
 * first paint is stable even when the form is populated via setFieldsValue.
 * The "prefill code template on language change" side effect lives in the
 * parent editor's `onValuesChange` (see `maybePrefillInjectCode`), not in
 * a useEffect here — field components stay pure-render.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Checkbox, Form, type FormInstance, Input, Select, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import CodeEditor from '../shared/CodeEditor';
import { getDocId } from '../docs/doc-ids';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

export const INJECT_TEMPLATES = {
  js: 'console.log("Hello World");',
  css: 'body {\n  background-color: #fff;\n}',
  'js-url':
    '<script src="{{scriptURL}}" type="text/javascript">\n  // Custom attributes to the script can be added here.\n  // Everything else will be ignored.\n</script>',
  'css-url':
    '<link href="{{scriptURL}}" rel="stylesheet" type="text/css">\n<!--\n  Custom attributes to the script can be added here.\n  Everything else will be ignored\n-->',
} as const;

const INJECT_TEMPLATE_VALUES: readonly string[] = Object.values(INJECT_TEMPLATES);

/**
 * Parent-owned prefill. Called from `onValuesChange` the moment the user
 * flips the Language select. If the current code buffer is empty or
 * matches a known template, swap it for the new language's template —
 * otherwise leave the user's edits alone.
 */
export function maybePrefillInjectCode(form: FormInstance, injectType: unknown): void {
  if (injectType !== 'script' && injectType !== 'css') return;
  const code = form.getFieldValue('injectCode') as string | undefined;
  const isTemplate = !code?.trim() || INJECT_TEMPLATE_VALUES.includes(code);
  if (!isTemplate) return;
  form.setFieldValue('injectCode', injectType === 'css' ? INJECT_TEMPLATES.css : INJECT_TEMPLATES.js);
}

const InjectRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();
  const form = Form.useFormInstance();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() =>
            openDocs(getDocId(form.getFieldValue('injectType') === 'css' ? 'inject-css' : 'inject-script', 'action'))
          }
        />
      </div>
      {/* Row 1: Language + Code Source + Insert timing — all inline */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Language:
          </Text>
          <EntityField path={paths.injectType}>
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
          </EntityField>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Code Source:
          </Text>
          <EntityField path={paths.injectSource}>
            <Form.Item name="injectSource" style={{ marginBottom: 0 }}>
              <Select
                size="small"
                style={{ width: 90 }}
                options={[
                  // TitleCase to match Header/QueryParam editor convention.
                  { value: 'code', label: 'Code' },
                  { value: 'url', label: 'URL' },
                ]}
              />
            </Form.Item>
          </EntityField>
        </div>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.injectType !== cur.injectType}>
          {({ getFieldValue }) => {
            if (getFieldValue('injectType') === 'css') return null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Insert:
                </Text>
                <EntityField path={paths.injectPosition}>
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
                </EntityField>
              </div>
            );
          }}
        </Form.Item>
      </div>

      {/* Code / URL editor swap — depends on injectType (for language) and injectSource. */}
      <Form.Item
        noStyle
        shouldUpdate={(prev, cur) => prev.injectType !== cur.injectType || prev.injectSource !== cur.injectSource}
      >
        {({ getFieldValue }) => {
          const injectType = getFieldValue('injectType');
          const codeSource = getFieldValue('injectSource');
          const language = injectType === 'css' ? 'css' : 'javascript';
          const urlPreview = injectType === 'css' ? INJECT_TEMPLATES['css-url'] : INJECT_TEMPLATES['js-url'];
          if (codeSource === 'url') {
            return (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  Source
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <EntityField path={paths.injectSourceUrl}>
                    <Form.Item name="injectSourceUrl" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
                      <Input size="small" placeholder="Enter Source URL (relative or absolute)" />
                    </Form.Item>
                  </EntityField>
                  <ScalarConflictChip formName="injectSourceUrl" schemaPath={paths.injectSourceUrl} />
                </div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  Code
                </Text>
                <CodeEditor language={language} value={urlPreview} readOnly minHeight={100} />
              </div>
            );
          }
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Code
                </Text>
                <ScalarConflictChip formName="injectCode" schemaPath={paths.injectCode} />
              </div>
              <EntityField path={paths.injectCode}>
                <Form.Item name="injectCode" style={{ marginBottom: 0 }}>
                  <CodeEditor language={language} minHeight={180} />
                </Form.Item>
              </EntityField>
            </div>
          );
        }}
      </Form.Item>

      {/* CSP Bypass */}
      <Form.Item name="injectBypassCSP" valuePropName="checked" style={{ marginBottom: 0 }}>
        <Checkbox>
          <Text style={{ fontSize: 12 }}>Bypass Content-Security-Policy so injected scripts always execute</Text>
        </Checkbox>
      </Form.Item>
    </div>
  );
};

export default InjectRuleFields;
