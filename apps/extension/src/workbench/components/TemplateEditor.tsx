/**
 * TemplateEditor — edit or view a user-defined template.
 *
 * Reuses the same per-type field components as RuleEditor.
 * Templates store form field values + conditions, not live rule actions.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import { useAwareness } from '@hooks/useAwareness';
import { useRules } from '@hooks/useRules';
import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Checkbox, Form, Input, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSurfaceIdentity } from '@/shared/awareness';
import ConditionEditor from './ConditionEditor';
import { mapAntdIdToTemplateFieldPath } from './template-field-path-map';
import { ActionValueBanner } from './rule-fields/ActionValueBanner';
import BlockRuleFields from './rule-fields/BlockRuleFields';
import BodyRuleFields, { BODY_DYNAMIC_TEMPLATE } from './rule-fields/BodyRuleFields';
import DelayRuleFields from './rule-fields/DelayRuleFields';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields, { maybePrefillInjectCode } from './rule-fields/InjectRuleFields';
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
  const workspaceId = useActiveWorkspaceId();
  const [form] = Form.useForm();
  const initializedRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [headerActiveTab, setHeaderActiveTab] = useState('request');
  const [headerReqCount, setHeaderReqCount] = useState(0);
  const [headerResCount, setHeaderResCount] = useState(0);

  const template = templates.find((t) => t.uid === templateUid);
  const identity = useSurfaceIdentity();
  // Template rule type is fixed at creation — the Select is rendered
  // disabled below, and there's no code path that changes it. Derive
  // straight from the template record so the first render is correct.
  const selectedType = template?.ruleType;

  // ── Form initialization ──────────────────────────────────────

  const populateFormFromTemplate = useCallback(
    (t: V5.Template) => {
      const values: Record<string, unknown> = {
        ruleType: t.ruleType,
        templateName: t.name,
        templateIcon: t.icon,
        templateDescription: t.description,
        includeConditions: t.includes.conditions,
        includeFormValues: t.includes.formValues,
        conditions: t.conditions ?? [],
        ...(t.formValues ?? {}),
      };
      form.setFieldsValue(values);

      if (t.ruleType === 'header' && t.formValues) {
        const resH = t.formValues.responseHeaders as unknown[] | undefined;
        const reqH = t.formValues.requestHeaders as unknown[] | undefined;
        const reqLen = reqH?.length ?? 0;
        const resLen = resH?.length ?? 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
      }
    },
    [form],
  );

  useEffect(() => {
    if (initializedRef.current || !template) return;
    initializedRef.current = true;
    populateFormFromTemplate(template);
  }, [template, populateFormFromTemplate]);

  // Live-update reconciliation (sync engine §6.3 ergonomic delta).
  // After init, `template` mutates whenever another surface commits a
  // change. When this editor has no uncommitted edits, re-prime from
  // the new live template — same shape as init. When dirty, leave the
  // form alone: the LWW save resolves at oracle time per §6.3.
  const templateSignature = template ? JSON.stringify(template) : null;
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!template) return;
    if (isDirty) return;
    populateFormFromTemplate(template);
    // templateSignature is the change trigger; populate runs against
    // the latest template object.
  }, [templateSignature, template, populateFormFromTemplate, isDirty]);

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
      setIsDirty(false);
      onDirtyChange?.(false);
    } else {
      message.error('Failed to save template');
    }
  }, [template, form, updateTemplate, message, onDirtyChange]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  // Per-field focus path — same posture as RuleEditor session 12.
  const [focusedFieldPath, setFocusedFieldPath] = useState<string | null>(null);
  const handleFocusCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const id = target?.getAttribute?.('id') ?? null;
    const path = mapAntdIdToTemplateFieldPath(id);
    if (path) setFocusedFieldPath(path);
  }, []);
  const handleBlurCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next && e.currentTarget.contains(next)) return;
    setFocusedFieldPath(null);
  }, []);
  const fieldFocus = useMemo(
    () =>
      template && focusedFieldPath
        ? { type: TEMPLATE_ENTITY_TYPE, id: template.uid, path: focusedFieldPath }
        : null,
    [template, focusedFieldPath],
  );

  useAwareness({
    workspaceId,
    identity,
    entityFocus: template ? { type: TEMPLATE_ENTITY_TYPE, id: template.uid } : null,
    fieldFocus,
    dirtyFields: isDirty ? ['*'] : [],
    enabled: !!template,
  });

  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      setIsDirty((prev) => {
        if (!prev) onDirtyChange?.(true);
        return true;
      });
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
      if ('injectType' in changedValues) {
        maybePrefillInjectCode(form, changedValues.injectType);
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
    <div className="rules-rule-editor" onFocusCapture={handleFocusCapture} onBlurCapture={handleBlurCapture}>
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
        {/* Inline action validation — same single-mount pattern as RuleEditor. */}
        {selectedType && <ActionValueBanner ruleType={selectedType} />}

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
