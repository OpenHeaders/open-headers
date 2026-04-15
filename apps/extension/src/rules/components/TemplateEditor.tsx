/**
 * TemplateEditor — edit or view a user-defined template.
 *
 * Reuses the same per-type field components as RuleEditor.
 * Templates store form field values + conditions, not live rule actions.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { App, Checkbox, Form, Input, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConditionEditor from './ConditionEditor';
import BlockRuleFields from './rule-fields/BlockRuleFields';
import BodyRuleFields, { BODY_DYNAMIC_TEMPLATE } from './rule-fields/BodyRuleFields';
import DelayRuleFields from './rule-fields/DelayRuleFields';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields from './rule-fields/InjectRuleFields';
import MockRuleFields, { MOCK_DYNAMIC_TEMPLATE } from './rule-fields/MockRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';
import TwoToneIconPicker from './TwoToneIconPicker';

const { Text } = Typography;
const { TextArea } = Input;

const RULE_TYPE_OPTIONS = [
  { value: 'header', label: 'Header Rule' },
  { value: 'block', label: 'Block Rule' },
  { value: 'redirect', label: 'Redirect Rule' },
  { value: 'query-param', label: 'Query Param Rule' },
  { value: 'inject', label: 'Inject Rule' },
  { value: 'delay', label: 'Delay Rule' },
  { value: 'body', label: 'API Request Body Rule' },
  { value: 'mock', label: 'API Response Rule' },
];

interface TemplateEditorProps {
  templateUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (saveFn: () => void) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ templateUid, onDirtyChange, registerSaveRef }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { templates, updateTemplate } = useRules();
  const [form] = Form.useForm();
  const initializedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const [headerActiveTab, setHeaderActiveTab] = useState('request');
  const [headerReqCount, setHeaderReqCount] = useState(0);
  const [headerResCount, setHeaderResCount] = useState(0);

  const template = templates.find((t) => t.uid === templateUid);
  const selectedType = Form.useWatch('ruleType', form) as string | undefined;

  // ── Form initialization ──────────────────────────────────────

  useEffect(() => {
    if (initializedRef.current || !template) return;
    initializedRef.current = true;

    const values: Record<string, unknown> = {
      ruleType: template.ruleType,
      templateName: template.name,
      templateIcon: template.icon,
      templateDescription: template.description,
      includeConditions: template.includes.conditions,
      includeFormValues: template.includes.formValues,
      conditions: template.conditions ?? [],
      ...(template.formValues ?? {}),
    };
    form.setFieldsValue(values);

    // Set header tab + counts based on content
    if (template.ruleType === 'header' && template.formValues) {
      const resH = template.formValues.responseHeaders as unknown[] | undefined;
      const reqH = template.formValues.requestHeaders as unknown[] | undefined;
      const reqLen = reqH?.length ?? 0;
      const resLen = resH?.length ?? 0;
      setHeaderReqCount(reqLen);
      setHeaderResCount(resLen);
      setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
    }
  }, [template, form]);

  // ── Save ────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!template) return;
    const values = form.getFieldsValue();

    const includeConditions = values.includeConditions !== false;
    const includeFormValues = values.includeFormValues !== false;

    // Extract form values (exclude template metadata fields)
    const metaKeys = new Set([
      'ruleType',
      'templateName',
      'templateIcon',
      'templateDescription',
      'includeConditions',
      'includeFormValues',
      'conditions',
    ]);
    const formValues: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(values)) {
      if (!metaKeys.has(key)) formValues[key] = val;
    }

    const updates: Partial<Omit<V5.Template, 'uid' | 'path'>> = {
      name: values.templateName || template.name,
      icon: values.templateIcon || template.icon,
      description: values.templateDescription || '',
      includes: { conditions: includeConditions, formValues: includeFormValues },
      conditions: includeConditions ? (values.conditions ?? []) : [],
      formValues: includeFormValues ? formValues : {},
    };

    const success = await updateTemplate(template.uid, updates);
    if (success) {
      message.success('Template saved');
      isDirtyRef.current = false;
      onDirtyChange?.(false);
    } else {
      message.error('Failed to save template');
    }
  }, [template, form, updateTemplate, message, onDirtyChange]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      if (!isDirtyRef.current) {
        isDirtyRef.current = true;
        onDirtyChange?.(true);
      }
      const reqH = form.getFieldValue('requestHeaders') as unknown[] | undefined;
      const resH = form.getFieldValue('responseHeaders') as unknown[] | undefined;
      setHeaderReqCount(reqH?.length ?? 0);
      setHeaderResCount(resH?.length ?? 0);

      // Same dynamic-template prefill as RuleEditor — side effects live at
      // the form parent so Body/Mock field components stay pure-render.
      if (changedValues.bodyModType === 'dynamic') {
        const dyn = form.getFieldValue('bodyDynamicContent') as string | undefined;
        if (!dyn?.trim()) form.setFieldValue('bodyDynamicContent', BODY_DYNAMIC_TEMPLATE);
      }
      if (changedValues.mockBodyType === 'dynamic') {
        const dyn = form.getFieldValue('mockDynamicBody') as string | undefined;
        if (!dyn?.trim()) form.setFieldValue('mockDynamicBody', MOCK_DYNAMIC_TEMPLATE);
      }
    },
    [onDirtyChange, form],
  );

  if (!template) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Text type="secondary">Template not found</Text>
      </div>
    );
  }

  return (
    <div className="rules-rule-editor">
      <Form form={form} layout="vertical" onFinish={handleSave} onValuesChange={handleValuesChange} size="small">
        <Form.Item name="ruleType" hidden>
          <input type="hidden" />
        </Form.Item>

        {/* ── Template metadata ── */}
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
          Edit Template
        </Text>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
          <Form.Item name="templateIcon" style={{ marginBottom: 0 }}>
            <TwoToneIconPicker />
          </Form.Item>
          <Form.Item name="templateName" style={{ marginBottom: 0, flex: 1 }}>
            <Input size="small" placeholder="Template name" />
          </Form.Item>
          <Form.Item name="ruleType" style={{ marginBottom: 0, width: 160 }}>
            <Select size="small" options={RULE_TYPE_OPTIONS} disabled />
          </Form.Item>
        </div>

        <Form.Item name="templateDescription" style={{ marginBottom: 16 }}>
          <TextArea size="small" placeholder="Description (optional)" autoSize={{ minRows: 1, maxRows: 3 }} />
        </Form.Item>

        {/* ── Include toggles ── */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 20,
            padding: '8px 12px',
            background: token.colorFillQuaternary,
            borderRadius: 6,
          }}
        >
          <Form.Item name="includeConditions" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Include conditions</Checkbox>
          </Form.Item>
          <Form.Item name="includeFormValues" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Include actions</Checkbox>
          </Form.Item>
        </div>

        {/* ── Per-type fields ── */}
        {selectedType === 'header' && (
          <HeaderRuleFields
            activeTab={headerActiveTab}
            onTabChange={setHeaderActiveTab}
            reqCount={headerReqCount}
            resCount={headerResCount}
          />
        )}
        {selectedType === 'block' && <BlockRuleFields />}
        {selectedType === 'redirect' && <RedirectRuleFields />}
        {selectedType === 'query-param' && <QueryParamRuleFields />}
        {selectedType === 'inject' && <InjectRuleFields />}
        {selectedType === 'delay' && <DelayRuleFields />}
        {selectedType === 'body' && <BodyRuleFields />}
        {selectedType === 'mock' && <MockRuleFields />}

        {/* ── Conditions ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Text strong style={{ fontSize: 13 }}>
              Conditions
            </Text>
            <InfoCircleOutlined style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }} />
          </div>
          <Form.Item name="conditions" style={{ marginBottom: 0 }}>
            <ConditionEditor />
          </Form.Item>
        </div>
      </Form>
    </div>
  );
};

export default TemplateEditor;
