/**
 * RuleEditor — compact rule creation/editing form.
 *
 * Key fields on a single line where possible. Name is auto-filled
 * (e.g. "New Header Rule", "New Header Rule (2)").
 * Supports tab integration: dirty tracking + save ref registration.
 * In create mode, saving triggers the SaveToCollectionModal.
 */

import {
  CodeOutlined,
  LinkOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { useRules } from '@hooks/useRules';
import { App, Col, Divider, Form, Input, Row, Select, Space, Switch } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import BlockRuleFields from './rule-fields/BlockRuleFields';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields from './rule-fields/InjectRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';

type ExtensionRuleType = 'header' | 'block' | 'redirect' | 'query-param' | 'inject';

const RULE_TYPE_OPTIONS: Array<{ value: ExtensionRuleType; label: string; icon: React.ReactNode }> = [
  { value: 'header', label: 'Headers', icon: <SwapOutlined /> },
  { value: 'block', label: 'Block', icon: <StopOutlined /> },
  { value: 'redirect', label: 'Redirect', icon: <SendOutlined /> },
  { value: 'query-param', label: 'Query Params', icon: <LinkOutlined /> },
  { value: 'inject', label: 'Inject', icon: <CodeOutlined /> },
];

interface RuleEditorProps {
  mode: 'create' | 'edit';
  ruleType?: string;
  ruleUid?: string;
  tabId: string;
  draftName?: string;
  onSaved: (uid: string) => void;
  /** Called when the user clicks Save on a draft — triggers SaveToCollectionModal. */
  onSaveDraft?: (tabId: string, draftData: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (saveFn: () => void) => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
  mode,
  ruleType,
  ruleUid,
  tabId,
  draftName,
  onSaved,
  onSaveDraft,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { message } = App.useApp();
  const { rules, createLocalRule, updateLocalRule, localCollections } = useRules();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const selectedType = Form.useWatch('ruleType', form) as ExtensionRuleType | undefined;
  const initializedRef = useRef(false);
  const isDirtyRef = useRef(false);

  // Load existing rule in edit mode, or set defaults in create mode
  useEffect(() => {
    if (initializedRef.current) return;

    if (mode === 'edit' && ruleUid) {
      const rule = rules.find((r) => r.uid === ruleUid);
      if (!rule) return;
      initializedRef.current = true;

      const baseValues = {
        ruleType: rule.type,
        name: rule.name,
        domains: rule.domains.join(', '),
        tag: rule.tags[0] ?? '',
        enabled: rule.enabled,
      };

      switch (rule.type) {
        case 'header': {
          const hr = rule as V5.HeaderRule;
          form.setFieldsValue({
            ...baseValues,
            headerName: hr.action.headerName,
            headerOperation: hr.action.operation,
            staticValue: hr.staticValue ?? '',
            isResponse: hr.action.isResponse,
          });
          break;
        }
        case 'block':
          form.setFieldsValue(baseValues);
          break;
        case 'redirect': {
          const rr = rule as V5.RedirectRule;
          form.setFieldsValue({ ...baseValues, redirectMatchPattern: rr.action.matchPattern, redirectTo: rr.action.redirectTo });
          break;
        }
        case 'query-param': {
          const qr = rule as V5.QueryParamRule;
          form.setFieldsValue({ ...baseValues, queryParams: qr.action.params.map((p) => ({ param: p.param, value: p.value ?? '', operation: p.operation })) });
          break;
        }
        case 'inject': {
          const ir = rule as V5.InjectRule;
          form.setFieldsValue({ ...baseValues, injectType: ir.action.injectType, injectCode: ir.action.code, injectPosition: ir.action.position });
          break;
        }
      }
    } else if (mode === 'create' && ruleType) {
      initializedRef.current = true;
      form.setFieldsValue({
        ruleType,
        name: draftName ?? '',
        domains: '',
        tag: '',
        enabled: true,
        headerOperation: 'override',
        isResponse: false,
        staticValue: '',
        headerName: '',
        redirectMatchPattern: '',
        redirectTo: '',
        injectType: 'script',
        injectCode: '',
        injectPosition: 'body-end',
        queryParams: [{ param: '', value: '', operation: 'add' }],
      });
    }
  }, [mode, ruleType, ruleUid, rules, form, localCollections, draftName]);

  const handleValuesChange = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      onDirtyChange?.(true);
    }
  }, [onDirtyChange]);

  const buildRule = useCallback((values: Record<string, unknown>): Omit<V5.Rule, 'uid' | 'path'> | null => {
    const domains = (values.domains as string).split(/[,\n]/).map((d: string) => d.trim()).filter(Boolean);
    const tags = (values.tag as string)?.trim() ? [(values.tag as string).trim()] : [];
    const name = (values.name as string) || 'Untitled';
    const base = { name, enabled: values.enabled as boolean, tags, domains };

    switch (values.ruleType) {
      case 'header':
        return { ...base, type: 'header', action: { operation: values.headerOperation as V5.HeaderOperation, headerName: values.headerName as string, isResponse: values.isResponse as boolean }, staticValue: values.headerOperation === 'remove' ? undefined : (values.staticValue as string) } as Omit<V5.HeaderRule, 'uid' | 'path'>;
      case 'block':
        return { ...base, type: 'block', action: { statusCode: 403 } } as Omit<V5.BlockRule, 'uid' | 'path'>;
      case 'redirect':
        return { ...base, type: 'redirect', action: { matchPattern: (values.redirectMatchPattern as string) ?? '', redirectTo: values.redirectTo as string } } as Omit<V5.RedirectRule, 'uid' | 'path'>;
      case 'query-param':
        return { ...base, type: 'query-param', action: { params: (values.queryParams as Array<{ param: string; value: string; operation: string }>).map((p) => ({ param: p.param, value: p.operation === 'remove' ? undefined : p.value, operation: p.operation as V5.QueryParamOperation })) } } as Omit<V5.QueryParamRule, 'uid' | 'path'>;
      case 'inject':
        return { ...base, type: 'inject', action: { injectType: values.injectType as V5.InjectType, code: values.injectCode as string, position: values.injectPosition as V5.InjectAction['position'] } } as Omit<V5.InjectRule, 'uid' | 'path'>;
      default:
        return null;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const values = form.getFieldsValue();
    setSaving(true);

    try {
      const rule = buildRule(values);
      if (!rule) { message.error('Unknown rule type'); return; }

      if (mode === 'create') {
        // Draft mode: trigger SaveToCollectionModal
        if (onSaveDraft) {
          onSaveDraft(tabId, { ...rule } as Record<string, unknown>);
          return;
        }
        // Fallback: save to first collection directly
        const created = await createLocalRule(rule, localCollections[0]?.uid);
        if (created) {
          message.success('Rule created');
          isDirtyRef.current = false;
          onDirtyChange?.(false);
          onSaved(created.uid);
        } else {
          message.error('Failed to create rule');
        }
      } else if (ruleUid) {
        const success = await updateLocalRule(ruleUid, rule as Partial<Omit<V5.Rule, 'uid' | 'path'>>);
        if (success) {
          message.success('Rule updated');
          isDirtyRef.current = false;
          onDirtyChange?.(false);
          onSaved(ruleUid);
        } else {
          message.error('Failed to update rule');
        }
      }
    } finally {
      setSaving(false);
    }
  }, [form, buildRule, mode, ruleUid, tabId, updateLocalRule, createLocalRule, localCollections, message, onDirtyChange, onSaved, onSaveDraft]);

  useEffect(() => {
    registerSaveRef?.(handleSubmit);
  }, [registerSaveRef, handleSubmit]);

  const isEdit = mode === 'edit';

  return (
    <div className="rules-rule-editor">
      <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} size="small">
        {/* Name is managed via the tab/breadcrumb — click breadcrumb to rename */}
        <Form.Item name="name" hidden><Input /></Form.Item>

        {/* Row 1: Domains + Tag + Active */}
        <Row gutter={12} align="top">
          <Col flex="auto">
            <Form.Item
              name="domains"
              label="Domains"
              extra="Comma-separated. Wildcards: *.openheaders.io"
              style={{ marginBottom: 8 }}
            >
              <Input placeholder="*.openheaders.io, api.openheaders.io" />
            </Form.Item>
          </Col>
          <Col flex="140px">
            <Form.Item name="tag" label="Tag" style={{ marginBottom: 8 }}>
              <Input placeholder="e.g. dev" />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="enabled" label="Active" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch size="small" />
            </Form.Item>
          </Col>
        </Row>

        {/* Type selector */}
        <Form.Item name="ruleType" label="Type" style={{ marginBottom: 8, maxWidth: 200 }}>
          <Select
            disabled={isEdit}
            options={RULE_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: <Space size={4}>{o.icon}<span>{o.label}</span></Space>,
            }))}
          />
        </Form.Item>

        <Divider style={{ margin: '8px 0' }} />

        {/* Per-type fields */}
        {selectedType === 'header' && <HeaderRuleFields />}
        {selectedType === 'block' && <BlockRuleFields />}
        {selectedType === 'redirect' && <RedirectRuleFields />}
        {selectedType === 'query-param' && <QueryParamRuleFields />}
        {selectedType === 'inject' && <InjectRuleFields />}
      </Form>
    </div>
  );
};

export default RuleEditor;
