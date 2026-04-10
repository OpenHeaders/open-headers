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

import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { runtime } from '@utils/browser-api';
import { App, Form, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInspectorNav } from '../hooks/useInspectorNav';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import ConditionEditor from './ConditionEditor';
import SaveAsTemplateModal from './SaveAsTemplateModal';
import BlockRuleFields from './rule-fields/BlockRuleFields';
import BodyRuleFields from './rule-fields/BodyRuleFields';
import DelayRuleFields from './rule-fields/DelayRuleFields';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields from './rule-fields/InjectRuleFields';
import MockRuleFields from './rule-fields/MockRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';

const { Text } = Typography;

const RULE_TYPE_TITLE: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  body: 'Body Rule',
  delay: 'Delay Rule',
  mock: 'API Response Rule',
};

interface RuleEditorProps {
  mode: 'create' | 'edit';
  ruleType?: string;
  ruleUid?: string;
  tabId: string;
  /** Display name for drafts (from tab label, managed by breadcrumb). */
  draftName?: string;
  /** Template to pre-apply on mount (from tab identity, not URL state). */
  initialTemplateKey?: string;
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
  initialTemplateKey,
  onSaved,
  onSaveDraft,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { openDocs } = useInspectorNav();
  const { rules, createLocalRule, updateLocalRule, localCollections, templates: userTemplates } = useRules();
  const [form] = Form.useForm();
  const [_saving, setSaving] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const selectedType = Form.useWatch('ruleType', form) as V5.ExtensionRuleType | undefined;
  const initializedRef = useRef(false);
  const isDirtyRef = useRef(false);

  // ── Header tab state (lifted from HeaderRuleFields for reliable timing) ──
  const [headerActiveTab, setHeaderActiveTab] = useState('request');

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

  // ── Template selector ─────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateKey ?? 'empty');

  const builtinTemplates = useMemo(() => TEMPLATES_BY_TYPE[selectedType ?? 'header'] ?? [], [selectedType]);
  const filteredUserTemplates = useMemo(
    () => userTemplates.filter((t) => t.ruleType === (selectedType ?? 'header')),
    [userTemplates, selectedType],
  );

  const applyTemplate = useCallback(
    (key: string) => {
      setSelectedTemplate(key);
      if (key === 'empty') {
        form.resetFields();
        form.setFieldsValue({ ruleType: selectedType, conditions: [] });
        setHeaderActiveTab('request');
        return;
      }

      // Try built-in templates first
      const type = selectedType ?? 'header';
      const builtins = TEMPLATES_BY_TYPE[type] ?? [];
      const builtin = builtins.find((t) => t.key === key);
      if (builtin) {
        const allValues = { ruleType: type, conditions: builtin.conditions, ...builtin.formValues };
        const fields = Object.entries(allValues).map(([name, value]) => ({ name, value }));
        form.setFields(fields);
        const fv = builtin.formValues;
        const resLen = Array.isArray(fv.responseHeaders) ? fv.responseHeaders.length : 0;
        const reqLen = Array.isArray(fv.requestHeaders) ? fv.requestHeaders.length : 0;
        setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
      } else {
        // Try user templates (key is the uid)
        const userTpl = userTemplates.find((t) => t.uid === key);
        if (userTpl) {
          const allValues: Record<string, unknown> = { ruleType: type };
          if (userTpl.includes.conditions && userTpl.conditions) {
            allValues.conditions = userTpl.conditions;
          }
          if (userTpl.includes.formValues && userTpl.formValues) {
            Object.assign(allValues, userTpl.formValues);
          }
          const fields = Object.entries(allValues).map(([name, value]) => ({ name, value }));
          form.setFields(fields);
          const fv = userTpl.formValues ?? {};
          const resLen = Array.isArray(fv.responseHeaders) ? (fv.responseHeaders as unknown[]).length : 0;
          const reqLen = Array.isArray(fv.requestHeaders) ? (fv.requestHeaders as unknown[]).length : 0;
          setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
        }
      }

      if (!isDirtyRef.current) {
        isDirtyRef.current = true;
        onDirtyChange?.(true);
      }
    },
    [selectedType, form, onDirtyChange, userTemplates],
  );

  // ── Form initialization (content fields only — no name/enabled) ──

  useEffect(() => {
    if (initializedRef.current) return;

    if (mode === 'edit' && ruleUid) {
      const rule = rules.find((r) => r.uid === ruleUid);
      if (!rule) return;
      initializedRef.current = true;

      const baseValues = {
        ruleType: rule.type,
        conditions: rule.conditions,
      };

      switch (rule.type) {
        case 'header': {
          const hr = rule as V5.HeaderRule;
          const reqH = hr.action.requestHeaders ?? [];
          const resH = hr.action.responseHeaders ?? [];
          form.setFieldsValue({ ...baseValues, requestHeaders: reqH, responseHeaders: resH });
          setHeaderActiveTab(resH.length > 0 && reqH.length === 0 ? 'response' : 'request');
          break;
        }
        case 'block':
          form.setFieldsValue(baseValues);
          break;
        case 'redirect': {
          const rr = rule as V5.RedirectRule;
          form.setFieldsValue({
            ...baseValues,
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
            injectSource: ir.action.source || 'code',
            injectCode: ir.action.code,
            injectSourceUrl: ir.action.sourceUrl || '',
            injectPosition: ir.action.position,
          });
          break;
        }
        case 'delay': {
          const dr = rule as V5.DelayRule;
          form.setFieldsValue({ ...baseValues, delayMs: dr.action.delayMs });
          break;
        }
        case 'body': {
          const br = rule as V5.BodyRule;
          form.setFieldsValue({
            ...baseValues,
            bodyModType: br.action.bodyType || 'static',
            bodyStaticContent: br.action.bodyType === 'dynamic' ? '' : br.action.body,
            bodyDynamicContent: br.action.bodyType === 'dynamic' ? br.action.body : '',
            bodyResourceType: br.action.resourceType || 'rest',
            bodyGraphqlKey: br.action.graphqlFilter?.key || '',
            bodyGraphqlOperator: br.action.graphqlFilter?.operator || 'Equals',
            bodyGraphqlValue: br.action.graphqlFilter?.value || '',
          });
          break;
        }
        case 'mock': {
          const mr = rule as V5.MockRule;
          form.setFieldsValue({
            ...baseValues,
            mockStatusCode: mr.action.statusCode || undefined,
            mockContentType: mr.action.contentType,
            mockStaticBody: mr.action.bodyType === 'dynamic' ? '' : mr.action.responseBody,
            mockDynamicBody: mr.action.bodyType === 'dynamic' ? mr.action.responseBody : '',
            mockBodyType: mr.action.bodyType || 'static',
          });
          break;
        }
      }
    } else if (mode === 'create' && ruleType) {
      initializedRef.current = true;
      form.setFieldsValue({
        ruleType,
        conditions: [],
        requestHeaders: [{ operation: 'override', headerName: '', value: '' }],
        responseHeaders: [],
        redirectTo: '',
        injectType: 'script',
        injectSource: 'code',
        injectCode: '',
        injectSourceUrl: '',
        injectPosition: 'body-end',
        queryParams: [{ param: '', value: '', operation: 'add' }],
        mockBodyType: 'static',
        bodyModType: 'static',
        bodyResourceType: 'rest',
        bodyGraphqlOperator: 'Equals',
      });
    }
  }, [mode, ruleType, ruleUid, rules, form]);

  // Note: initialTemplateKey is handled at the data level — openCreateTab in App.tsx
  // creates the rule with template values baked in. No form-level template application needed.

  const handleValuesChange = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      onDirtyChange?.(true);
    }
  }, [onDirtyChange]);

  // ── Build rule: merges form content with externally-owned name/enabled ──

  const buildRule = useCallback(
    (formValues: Record<string, unknown>): Omit<V5.Rule, 'uid' | 'path'> | null => {
      const conditions = Array.isArray(formValues.conditions) ? (formValues.conditions as V5.RuleCondition[]) : [];
      const base = { name: ruleName, enabled: isEnabled, conditions };

      switch (formValues.ruleType) {
        case 'header':
          return {
            ...base,
            type: 'header',
            action: {
              requestHeaders: (formValues.requestHeaders as V5.HeaderModification[]) ?? [],
              responseHeaders: (formValues.responseHeaders as V5.HeaderModification[]) ?? [],
            },
          } as Omit<V5.HeaderRule, 'uid' | 'path'>;
        case 'block':
          return { ...base, type: 'block', action: { statusCode: 403 } } as Omit<V5.BlockRule, 'uid' | 'path'>;
        case 'redirect':
          return {
            ...base,
            type: 'redirect',
            action: {
              matchPattern: '',
              redirectTo: (formValues.redirectTo as string) ?? '',
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
              source: ((formValues.injectSource as string) || 'code') as V5.InjectSource,
              code: (formValues.injectCode as string) ?? '',
              sourceUrl: (formValues.injectSourceUrl as string) || undefined,
              position: formValues.injectPosition as V5.InjectAction['position'],
            },
          } as Omit<V5.InjectRule, 'uid' | 'path'>;
        case 'delay':
          return {
            ...base,
            type: 'delay',
            action: { delayMs: (formValues.delayMs as number) || 0 },
          } as Omit<V5.DelayRule, 'uid' | 'path'>;
        case 'body':
          return {
            ...base,
            type: 'body',
            action: {
              bodyType: ((formValues.bodyModType as string) ?? 'static') as V5.BodyModType,
              body:
                formValues.bodyModType === 'dynamic'
                  ? ((formValues.bodyDynamicContent as string) ?? '')
                  : ((formValues.bodyStaticContent as string) ?? ''),
              resourceType: ((formValues.bodyResourceType as string) ?? 'rest') as V5.BodyResourceType,
              graphqlFilter:
                formValues.bodyResourceType === 'graphql' && (formValues.bodyGraphqlKey as string)?.trim()
                  ? {
                      key: (formValues.bodyGraphqlKey as string).trim(),
                      operator: ((formValues.bodyGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                      value: (formValues.bodyGraphqlValue as string) || '',
                    }
                  : undefined,
            },
          } as Omit<V5.BodyRule, 'uid' | 'path'>;
        case 'mock':
          return {
            ...base,
            type: 'mock',
            action: {
              statusCode: (formValues.mockStatusCode as number) || 0,
              responseBody:
                formValues.mockBodyType === 'dynamic'
                  ? ((formValues.mockDynamicBody as string) ?? '')
                  : ((formValues.mockStaticBody as string) ?? ''),
              contentType: (formValues.mockContentType as string) ?? 'application/json',
              responseHeaders: {},
              bodyType: ((formValues.mockBodyType as string) ?? 'static') as V5.MockBodyType,
            },
          } as Omit<V5.MockRule, 'uid' | 'path'>;
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
        {/* Hidden: rule type (set at creation, can't change) */}
        <Form.Item name="ruleType" hidden>
          <input type="hidden" />
        </Form.Item>

        {/* ── Templates ── */}
        {(builtinTemplates.length > 0 || filteredUserTemplates.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 4,
                padding: 3,
                background: token.colorFillQuaternary,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              {/* Blank + built-in templates */}
              {[
                { key: 'empty', icon: '', name: 'Blank', source: 'builtin' as const },
                ...builtinTemplates.map((t) => ({ key: t.key, icon: t.icon, name: t.name, source: 'builtin' as const })),
              ].map((t) => (
                <div
                  key={t.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => applyTemplate(t.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyTemplate(t.key); }}
                  style={{
                    padding: '5px 14px',
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                    background: selectedTemplate === t.key ? token.colorBgContainer : 'transparent',
                    boxShadow: selectedTemplate === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    color: selectedTemplate === t.key ? token.colorText : token.colorTextSecondary,
                  }}
                >
                  {t.icon ? `${t.icon} ${t.name}` : t.name}
                </div>
              ))}

              {/* Separator + user templates */}
              {filteredUserTemplates.length > 0 && (
                <>
                  <div style={{ width: 1, height: 20, background: token.colorBorderSecondary, margin: '0 2px' }} />
                  {filteredUserTemplates.map((t) => (
                    <div
                      key={t.uid}
                      role="button"
                      tabIndex={0}
                      onClick={() => applyTemplate(t.uid)}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyTemplate(t.uid); }}
                      style={{
                        padding: '5px 14px',
                        fontSize: 13,
                        fontWeight: 500,
                        borderRadius: 6,
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                        background: selectedTemplate === t.uid ? token.colorBgContainer : 'transparent',
                        boxShadow: selectedTemplate === t.uid ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        color: selectedTemplate === t.uid ? token.colorText : token.colorTextSecondary,
                      }}
                    >
                      {t.icon ? `${t.icon} ${t.name}` : t.name}
                    </div>
                  ))}
                </>
              )}

              {/* Save as Template button */}
              <div style={{ width: 1, height: 20, background: token.colorBorderSecondary, margin: '0 2px' }} />
              <Tooltip title="Save current configuration as a reusable template">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSaveAsTemplateOpen(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSaveAsTemplateOpen(true); }}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    color: token.colorTextTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PlusOutlined style={{ fontSize: 10 }} /> Save as Template
                </div>
              </Tooltip>
            </div>

            {/* Description for selected template */}
            {selectedTemplate !== 'empty' &&
              (() => {
                const bt = builtinTemplates.find((t) => t.key === selectedTemplate);
                if (bt) {
                  return (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
                      {bt.description.split('\n')[0]}
                    </div>
                  );
                }
                const ut = filteredUserTemplates.find((t) => t.uid === selectedTemplate);
                if (ut?.description) {
                  return (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
                      {ut.description.split('\n')[0]}
                    </div>
                  );
                }
                return null;
              })()}
          </div>
        )}

        {/* ── Title + Enabled ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Text strong style={{ fontSize: 15 }}>
            {isEdit ? 'Edit' : 'Add'} {RULE_TYPE_TITLE[selectedType ?? 'header'] ?? 'Rule'}
          </Text>
          <Switch
            size="small"
            checked={isEnabled}
            onChange={handleToggleEnabled}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
          />
        </div>

        {/* ── Per-type fields ── */}
        {selectedType === 'header' && <HeaderRuleFields activeTab={headerActiveTab} onTabChange={setHeaderActiveTab} />}
        {selectedType === 'block' && <BlockRuleFields />}
        {selectedType === 'redirect' && <RedirectRuleFields />}
        {selectedType === 'query-param' && <QueryParamRuleFields />}
        {selectedType === 'inject' && <InjectRuleFields />}
        {selectedType === 'delay' && <DelayRuleFields />}
        {selectedType === 'body' && <BodyRuleFields />}
        {selectedType === 'mock' && <MockRuleFields />}

        {/* ── Conditions section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Text strong style={{ fontSize: 13 }}>
              Conditions
            </Text>
            <InfoCircleOutlined
              style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
              onClick={() => openDocs('conditions')}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
            All conditions must match for this rule to fire (AND logic). Add at least one condition.
          </div>
          <Form.Item name="conditions" style={{ marginBottom: 0 }}>
            <ConditionEditor />
          </Form.Item>
        </div>
      </Form>

      <SaveAsTemplateModal
        open={saveAsTemplateOpen}
        ruleType={selectedType ?? 'header'}
        conditions={form.getFieldValue('conditions') ?? []}
        formValues={(() => {
          if (!saveAsTemplateOpen) return {};
          const all = form.getFieldsValue();
          const metaKeys = new Set(['ruleType', 'conditions']);
          const fv: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(all)) {
            if (!metaKeys.has(k)) fv[k] = v;
          }
          return fv;
        })()}
        onCancel={() => setSaveAsTemplateOpen(false)}
      />
    </div>
  );
};

export default RuleEditor;
