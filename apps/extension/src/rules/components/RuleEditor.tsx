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

import { InfoCircleOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { runtime } from '@utils/browser-api';
import { App, Form, Popover, Switch, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import ConditionEditor from './ConditionEditor';
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
  const { token } = theme.useToken();
  const { rules, createLocalRule, updateLocalRule, localCollections } = useRules();
  const [form] = Form.useForm();
  const [_saving, setSaving] = useState(false);
  const selectedType = Form.useWatch('ruleType', form) as V5.ExtensionRuleType | undefined;
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

  // ── Template selector ─────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<string>('empty');

  const templates = useMemo(() => TEMPLATES_BY_TYPE[selectedType ?? 'header'] ?? [], [selectedType]);

  const applyTemplate = useCallback(
    (key: string) => {
      setSelectedTemplate(key);
      if (key === 'empty') {
        form.resetFields();
        form.setFieldsValue({ ruleType: selectedType, conditions: [] });
        return;
      }
      const type = selectedType ?? 'header';
      const templates = TEMPLATES_BY_TYPE[type] ?? [];
      const template = templates.find((t) => t.key === key);
      if (!template) return;
      form.setFieldsValue({
        conditions: template.conditions,
        ...template.formValues,
      });
      if (!isDirtyRef.current) {
        isDirtyRef.current = true;
        onDirtyChange?.(true);
      }
    },
    [selectedType, form, onDirtyChange],
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
          form.setFieldsValue({
            ...baseValues,
            requestHeaders: hr.action.requestHeaders ?? [],
            responseHeaders: hr.action.responseHeaders ?? [],
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
        {templates.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 4,
                padding: 3,
                background: token.colorFillQuaternary,
                borderRadius: 8,
              }}
            >
              {[
                { key: 'empty', icon: '', name: 'Blank' },
                ...templates.map((t) => ({ key: t.key, icon: t.icon, name: t.name })),
              ].map((t) => (
                <div
                  key={t.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => applyTemplate(t.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyTemplate(t.key);
                  }}
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
            </div>
            {selectedTemplate !== 'empty' &&
              (() => {
                const t = templates.find((t) => t.key === selectedTemplate);
                if (!t) return null;
                const firstLine = t.description.split('\n')[0];
                return (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>{firstLine}</div>
                );
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
        {selectedType === 'header' && <HeaderRuleFields />}
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
            <Popover
              placement="rightTop"
              trigger="click"
              content={
                <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 700 }}>
                  <div style={{ marginBottom: 10, color: 'var(--ant-color-text-secondary)' }}>
                    All conditions must match (AND logic). Each maps directly to a Chrome DNR field.
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>URL Pattern</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Wildcard pattern on the full URL. <code>*</code> matches anything.
                          <br />
                          <span style={{ color: 'var(--ant-color-success)' }}>Matches:</span>{' '}
                          <code>*://api.openheaders.io/*</code> hits <code>https://api.openheaders.io/v2/users</code>
                          <br />
                          <span style={{ color: 'var(--ant-color-error)' }}>No match:</span>{' '}
                          <code>https://other-site.com/api</code>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>URL Regex</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          RE2 regular expression on the full URL. For complex matching.
                          <br />
                          <span style={{ color: 'var(--ant-color-success)' }}>Matches:</span>{' '}
                          <code>{'^https://api\\.openheaders\\.io/v[0-9]+'}</code> hits{' '}
                          <code>https://api.openheaders.io/v2</code>
                          <br />
                          <span style={{ color: 'var(--ant-color-error)' }}>No match:</span>{' '}
                          <code>https://api.openheaders.io/latest</code>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Request Domains</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Domain + all subdomains automatically.
                          <br />
                          <span style={{ color: 'var(--ant-color-success)' }}>Matches:</span>{' '}
                          <code>openheaders.io</code> hits <code>openheaders.io</code>, <code>api.openheaders.io</code>,{' '}
                          <code>cdn.openheaders.io</code>
                          <br />
                          <span style={{ color: 'var(--ant-color-error)' }}>No match:</span>{' '}
                          <code>not-openheaders.io</code>, <code>openheaders.com</code>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Exclude Domains</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Skip these domains even if other conditions match.
                          <br />
                          Example: match <code>openheaders.io</code> but exclude <code>staging.openheaders.io</code>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Initiator Domains</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Only match requests made FROM pages on this domain.
                          <br />
                          Example: <code>portal.openheaders.io</code> — rule only fires when the user is on the portal
                          page
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Methods</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Only match specific HTTP methods. Example: select GET + POST to ignore PUT/DELETE
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Resource Types</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Only match specific resource types. Example: select <code>xhr</code> to only affect API calls,
                          not page loads
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Domain Type</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          First-party (same site) or third-party (cross-site) requests. Useful for blocking trackers
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 12px 4px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <Text strong>Headers</Text>
                        </td>
                        <td style={{ padding: '4px 0' }}>
                          Match requests/responses that have a specific header with an exact value. Chrome 128+ only.
                          <br />
                          Example: Request Header <code>Authorization</code> = <code>Bearer test-token</code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
            >
              <InfoCircleOutlined
                style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
              />
            </Popover>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
            All conditions must match for this rule to fire (AND logic). Add at least one condition.
          </div>
          <Form.Item name="conditions" style={{ marginBottom: 0 }}>
            <ConditionEditor />
          </Form.Item>
        </div>
      </Form>
    </div>
  );
};

export default RuleEditor;
