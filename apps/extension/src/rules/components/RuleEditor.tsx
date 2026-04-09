/**
 * RuleEditor — mirrors the desktop "Add Header Rule" modal UX exactly.
 *
 * Ownership model (separation of concerns):
 *   - **Form** owns content fields: domains and per-type fields (headerName, staticValue, etc.)
 *   - **Rule store** (via context) owns `enabled` and `name` for persisted rules
 *   - **Local state** owns `enabled` for draft (create) tabs
 *   - **Tab label** (via props) owns `name` for draft tabs
 *
 * This means toggling enabled from the sidebar immediately reflects here,
 * and breadcrumb renames are never overwritten by a stale form value on save.
 */

import { CodeOutlined, LinkOutlined, SendOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { runtime } from '@utils/browser-api';
import { App, Form, Segmented, Switch, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DomainTags from './DomainTags';
import BlockRuleFields from './rule-fields/BlockRuleFields';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields from './rule-fields/InjectRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';

const { Text } = Typography;

type ExtensionRuleType = 'header' | 'block' | 'redirect' | 'query-param' | 'inject';

const RULE_TYPE_SEGMENTS: Array<{ value: ExtensionRuleType; label: React.ReactNode }> = [
  {
    value: 'header',
    label: (
      <span>
        <SwapOutlined style={{ marginRight: 5, color: '#1677ff' }} />
        Headers
      </span>
    ),
  },
  {
    value: 'block',
    label: (
      <span>
        <StopOutlined style={{ marginRight: 5, color: '#ff4d4f' }} />
        Block
      </span>
    ),
  },
  {
    value: 'redirect',
    label: (
      <span>
        <SendOutlined style={{ marginRight: 5, color: '#722ed1' }} />
        Redirect
      </span>
    ),
  },
  {
    value: 'query-param',
    label: (
      <span>
        <LinkOutlined style={{ marginRight: 5, color: '#13c2c2' }} />
        Params
      </span>
    ),
  },
  {
    value: 'inject',
    label: (
      <span>
        <CodeOutlined style={{ marginRight: 5, color: '#52c41a' }} />
        Inject
      </span>
    ),
  },
];

const RULE_TYPE_TITLE: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
};

interface RuleEditorProps {
  mode: 'create' | 'edit';
  ruleType?: string;
  ruleUid?: string;
  tabId: string;
  /** Display name for drafts (from tab label, managed by breadcrumb). */
  draftName?: string;
  onSaved: (uid: string) => void;
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
  const [_saving, setSaving] = useState(false);
  const selectedType = Form.useWatch('ruleType', form) as ExtensionRuleType | undefined;
  const initializedRef = useRef(false);
  const isDirtyRef = useRef(false);

  // ── Enabled state: owned by rule store (edit) or local (create) ──

  const [draftEnabled, setDraftEnabled] = useState(true);

  /** Live rule from context — always current for edit mode. */
  const liveRule = useMemo(
    () => (mode === 'edit' && ruleUid ? rules.find((r) => r.uid === ruleUid) : undefined),
    [mode, ruleUid, rules],
  );

  /** Single source of truth for enabled state. */
  const isEnabled = mode === 'edit' ? (liveRule?.enabled ?? true) : draftEnabled;

  /** Single source of truth for name. */
  const ruleName = mode === 'edit' ? (liveRule?.name ?? 'Rule') : (draftName ?? 'Untitled');

  const handleToggleEnabled = useCallback(() => {
    if (mode === 'edit' && ruleUid) {
      // Same path as sidebar — goes through background, updates rule store, broadcasts back
      runtime.sendMessage({ type: 'toggleRule', ruleId: ruleUid, enabled: !isEnabled });
    } else {
      setDraftEnabled((prev) => !prev);
    }
  }, [mode, ruleUid, isEnabled]);

  // ── Form initialization (content fields only — no name/enabled) ──

  useEffect(() => {
    if (initializedRef.current) return;

    if (mode === 'edit' && ruleUid) {
      const rule = rules.find((r) => r.uid === ruleUid);
      if (!rule) return;
      initializedRef.current = true;

      const domains = rule.conditions.filter((c) => c.type === 'host' && !c.exclude).flatMap((c) => c.values);
      const baseValues = {
        ruleType: rule.type,
        domains,
      };

      switch (rule.type) {
        case 'header': {
          const hr = rule as V5.HeaderRule;
          form.setFieldsValue({
            ...baseValues,
            headerName: hr.action.headerName,
            headerOperation: hr.action.operation,
            staticValue: hr.action.value ?? '',
            isResponse: hr.action.isResponse,
          });
          break;
        }
        case 'block':
          form.setFieldsValue(baseValues);
          break;
        case 'redirect': {
          const rr = rule as V5.RedirectRule;
          form.setFieldsValue({
            ...baseValues,
            redirectMatchPattern: rr.action.matchPattern,
            redirectTo: rr.action.redirectTo,
          });
          break;
        }
        case 'query-param': {
          const qr = rule as V5.QueryParamRule;
          form.setFieldsValue({
            ...baseValues,
            queryParams: qr.action.params.map((p) => ({
              param: p.param,
              value: p.value ?? '',
              operation: p.operation,
            })),
          });
          break;
        }
        case 'inject': {
          const ir = rule as V5.InjectRule;
          form.setFieldsValue({
            ...baseValues,
            injectType: ir.action.injectType,
            injectCode: ir.action.code,
            injectPosition: ir.action.position,
          });
          break;
        }
      }
    } else if (mode === 'create' && ruleType) {
      initializedRef.current = true;
      form.setFieldsValue({
        ruleType,
        domains: [],
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
  }, [mode, ruleType, ruleUid, rules, form]);

  const handleValuesChange = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      onDirtyChange?.(true);
    }
  }, [onDirtyChange]);

  // ── Build rule: merges form content with externally-owned name/enabled ──

  const buildRule = useCallback(
    (formValues: Record<string, unknown>): Omit<V5.Rule, 'uid' | 'path'> | null => {
      const domainValues = Array.isArray(formValues.domains) ? (formValues.domains as string[]) : [];
      const conditions: V5.RuleCondition[] =
        domainValues.length > 0 ? [{ type: 'host' as const, operator: 'contains' as const, values: domainValues }] : [];
      const base = { name: ruleName, enabled: isEnabled, conditions };

      switch (formValues.ruleType) {
        case 'header':
          return {
            ...base,
            type: 'header',
            action: {
              operation: formValues.headerOperation as V5.HeaderOperation,
              headerName: formValues.headerName as string,
              isResponse: formValues.isResponse as boolean,
              value: formValues.headerOperation === 'remove' ? undefined : (formValues.staticValue as string),
            },
          } as Omit<V5.HeaderRule, 'uid' | 'path'>;
        case 'block':
          return { ...base, type: 'block', action: { statusCode: 403 } } as Omit<V5.BlockRule, 'uid' | 'path'>;
        case 'redirect':
          return {
            ...base,
            type: 'redirect',
            action: {
              matchPattern: (formValues.redirectMatchPattern as string) ?? '',
              redirectTo: formValues.redirectTo as string,
            },
          } as Omit<V5.RedirectRule, 'uid' | 'path'>;
        case 'query-param':
          return {
            ...base,
            type: 'query-param',
            action: {
              params: (formValues.queryParams as Array<{ param: string; value: string; operation: string }>).map(
                (p) => ({
                  param: p.param,
                  value: p.operation === 'remove' ? undefined : p.value,
                  operation: p.operation as V5.QueryParamOperation,
                }),
              ),
            },
          } as Omit<V5.QueryParamRule, 'uid' | 'path'>;
        case 'inject':
          return {
            ...base,
            type: 'inject',
            action: {
              injectType: formValues.injectType as V5.InjectType,
              code: formValues.injectCode as string,
              position: formValues.injectPosition as V5.InjectAction['position'],
            },
          } as Omit<V5.InjectRule, 'uid' | 'path'>;
        default:
          return null;
      }
    },
    [ruleName, isEnabled],
  );

  const handleSubmit = useCallback(async () => {
    const values = form.getFieldsValue();
    setSaving(true);
    try {
      const rule = buildRule(values);
      if (!rule) {
        message.error('Unknown rule type');
        return;
      }

      if (mode === 'create') {
        if (onSaveDraft) {
          onSaveDraft(tabId, { ...rule } as Record<string, unknown>);
          return;
        }
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
  }, [
    form,
    buildRule,
    mode,
    ruleUid,
    tabId,
    updateLocalRule,
    createLocalRule,
    localCollections,
    message,
    onDirtyChange,
    onSaved,
    onSaveDraft,
  ]);

  useEffect(() => {
    registerSaveRef?.(handleSubmit);
  }, [registerSaveRef, handleSubmit]);

  const isEdit = mode === 'edit';

  return (
    <div className="rules-rule-editor">
      <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} size="small">
        {/* ── Top bar: title+toggle column | Segmented type ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
              {isEdit ? 'Edit' : 'Add'} {RULE_TYPE_TITLE[selectedType ?? 'header'] ?? 'Rule'}
            </Text>
            {/* NOT a form field — owned by rule store (edit) or local state (create) */}
            <Switch
              checked={isEnabled}
              onChange={handleToggleEnabled}
              checkedChildren="Enabled"
              unCheckedChildren="Disabled"
            />
          </div>

          <Form.Item name="ruleType" style={{ marginBottom: 0 }}>
            <Segmented
              size="middle"
              options={RULE_TYPE_SEGMENTS.map((s) => ({
                ...s,
                disabled: isEdit && s.value !== selectedType,
              }))}
              style={{ fontWeight: 500 }}
            />
          </Form.Item>
        </div>

        {/* ── Per-type fields ── */}
        {selectedType === 'header' && <HeaderRuleFields />}
        {selectedType === 'block' && <BlockRuleFields />}
        {selectedType === 'redirect' && <RedirectRuleFields />}
        {selectedType === 'query-param' && <QueryParamRuleFields />}
        {selectedType === 'inject' && <InjectRuleFields />}

        {/* ── Domains section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 6 }}>
            <Text strong style={{ fontSize: 13 }}>
              Domains
            </Text>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
            Separate multiple domains with Enter or comma. Use * as wildcard. Press Backspace to delete last domain.
            <br />
            Examples: localhost:3001 &middot; openheaders.io &middot; *.openheaders.io &middot; {'{{DOMAIN_VAR}}'}{' '}
            &middot; {'{{BASE_URL}}'}.com &middot; 192.168.1.1
          </div>
          <Form.Item name="domains" style={{ marginBottom: 0 }}>
            <DomainTags />
          </Form.Item>
        </div>
      </Form>
    </div>
  );
};

export default RuleEditor;
