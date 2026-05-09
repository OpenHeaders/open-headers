/**
 * TemplateEditor — edit or view a user-defined template.
 *
 * Reuses the same per-rule-type field components as RuleEditor via the
 * shared `ActionPathsProvider` (templates persist action data under
 * `formValues.*` rather than `action.*`). The editor follows the same
 * sync-engine playbook every entity editor uses:
 *
 *   - `useEditorShell` returns branded `headerProps` + `scopeProps`
 *     mounted into `<EditorHeader>` + `<EntityScopeProvider>`; bundles
 *     dirty-publishing into the surface's `<SurfaceAwarenessPublisher>`.
 *   - `useReprime` owns the form-vs-canonical comparison; dirty derives
 *     structurally (no imperative `setIsDirty(true)` flags). `onPrimed`
 *     advances the conflict-tracker baseline via `setBaselineRef`.
 *   - `useTemplateConflicts` + `<EntityConflictBanner>` +
 *     `<EntityConflictDialog>` cover concurrent-edit divergence.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import { canonicalizeTemplate, parseTemplate, serializeTemplate } from '@openheaders/core/codec/yaml';
import { freshDocument } from '@openheaders/core/schemas';
import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Checkbox, Form, Input, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionPathsProvider,
  EntityField,
  EntityScopeProvider,
  PresenceBadge,
  TEMPLATE_ACTION_PATHS,
  useLocalInstanceId,
} from '@/shared/awareness';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  hasDialogOnlyConflict,
  type PathConflict,
  prettyPathMap,
  useAutoMergeForm,
} from '@/shared/conflicts';
import { useEditorShell, useReprime } from '@/shared/editor-shell';
import { stableStringify } from '@/shared/forms';
import ConditionEditor from './ConditionEditor';
import EditorHeader from './EditorHeader';
import { mergeTemplateForSave } from './merge-template-for-save';
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
import { templateResolveAdapter } from './template-conflict-adapter';
import { useTemplateConflicts } from './use-template-conflicts';

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

const META_KEYS = new Set([
  'ruleType',
  'templateName',
  'templateIcon',
  'templateDescription',
  'includeConditions',
  'includeFormValues',
  'conditions',
]);

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [headerActiveTab, setHeaderActiveTab] = useState('request');
  const [headerReqCount, setHeaderReqCount] = useState(0);
  const [headerResCount, setHeaderResCount] = useState(0);

  const liveTemplate = useMemo(() => templates.find((t) => t.uid === templateUid), [templates, templateUid]);
  const selectedType = liveTemplate?.ruleType;

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
        const reqH = t.formValues.requestHeaders as unknown[] | undefined;
        const resH = t.formValues.responseHeaders as unknown[] | undefined;
        const reqLen = reqH?.length ?? 0;
        const resLen = resH?.length ?? 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
      }
    },
    [form],
  );

  const formValues = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const formFingerprint = useMemo(
    () => (formValues ? stableStringify(buildTemplateUpdates(formValues)) : ''),
    [formValues],
  );

  // Conflict-baseline ref pattern (canonical recipe).
  const setBaselineRef = useRef<(t: V5.Template) => void>(() => undefined);
  // Save-time merge baseline: snapshot of the template at the most
  // recent re-prime — feeds `mergeTemplateForSave` so the save batch
  // only carries leaves the user actually edited.
  const baselineTemplateRef = useRef<V5.Template | null>(null);

  const reprime = useReprime<V5.Template>({
    liveEntity: liveTemplate,
    scope: { entityType: TEMPLATE_ENTITY_TYPE, entityId: templateUid },
    enabled: isInitialized && liveTemplate != null,
    formFingerprint,
    signature: (t) =>
      stableStringify({
        name: t.name,
        icon: t.icon,
        description: t.description,
        includes: t.includes,
        conditions: t.includes.conditions ? t.conditions : [],
        formValues: t.includes.formValues ? t.formValues : {},
      }),
    populate: (t) => populateFormFromTemplate(t),
    onPrimed: (t) => {
      setBaselineRef.current(t);
      baselineTemplateRef.current = t;
    },
  });
  const isDirty = reprime.isDirty;

  const conflicts = useTemplateConflicts({
    liveTemplate: liveTemplate ?? null,
    isDirty,
    enabled: true,
  });
  setBaselineRef.current = conflicts.setBaseline;

  // Conflict aggregation. Project current form values into a transient
  // V5.Template-shaped object so the path-keyed projection lines up
  // with baseline.
  const formProjection = useMemo(() => {
    if (!formValues || !liveTemplate) return null;
    const transient: V5.Template = {
      ...liveTemplate,
      ...buildTemplateUpdates(formValues),
    };
    return conflicts.projectEntity(transient);
  }, [formValues, liveTemplate, conflicts]);

  const formSetOrders = useMemo(() => {
    const out = new Map<string, string[]>();
    if (!formValues) return out;
    const collect = (key: string, setPath: string) => {
      const arr = formValues[key] as Array<{ uid?: string }> | undefined;
      if (!Array.isArray(arr)) return;
      const order = arr.map((r) => r?.uid).filter((u): u is string => typeof u === 'string');
      if (order.length > 0) out.set(setPath, order);
    };
    collect('requestHeaders', TEMPLATE_ACTION_PATHS.headerSet('request'));
    collect('responseHeaders', TEMPLATE_ACTION_PATHS.headerSet('response'));
    collect('queryParams', TEMPLATE_ACTION_PATHS.queryParamSet);
    collect('conditions', 'conditions');
    return out;
  }, [formValues]);

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection, formSetOrders) : new Map<string, PathConflict>()),
    [formProjection, formSetOrders, conflicts],
  );

  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  // Per-leaf auto-rebase — see EnvironmentEditor for the discipline.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!liveTemplate) return;
      templateResolveAdapter.applyResolutionToForm(form, liveTemplate, path, { base: '', theirs });
    },
    [form, liveTemplate],
  );
  useAutoMergeForm({ conflicts, formProjection: formProjection ?? undefined, applyToForm: applyAutoMerge });

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!liveTemplate) return;
    for (const [path, conflict] of allConflicts) {
      templateResolveAdapter.applyResolutionToForm(form, liveTemplate, path, conflict);
      conflicts.acceptTheirs(path, conflict.theirs);
    }
  }, [allConflicts, conflicts, form, liveTemplate]);

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      if (!liveTemplate) return;
      for (const [path, choice] of resolutions) {
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        if (choice === 'theirs') {
          templateResolveAdapter.applyResolutionToForm(form, liveTemplate, path, conflict);
          conflicts.acceptTheirs(path, conflict.theirs);
        } else {
          conflicts.dismiss(path);
        }
      }
    },
    [allConflicts, conflicts, form, liveTemplate],
  );

  // Phase 6 commit seam — parses the merge-editor's result YAML back
  // to a Template, populates the form, dismisses every conflict path.
  // Throws on parse failure; the merge modal renders the error inline.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!liveTemplate) return;
      const parsed = parseTemplate(text, { path: liveTemplate.path });
      populateFormFromTemplate(parsed.value);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [liveTemplate, populateFormFromTemplate, allConflicts, conflicts],
  );

  const savedYaml = useMemo(() => {
    if (!isConflictDialogOpen || !liveTemplate) return '';
    try {
      return serializeTemplate(freshDocument(canonicalizeTemplate(liveTemplate)));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveTemplate]);

  // Baseline YAML for the merge-editor preview's Show Base layouts.
  // Captured at dialog-open from the form's baseline-template ref.
  const baseYaml = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineTemplateRef.current;
    if (!baseline) return undefined;
    try {
      return serializeTemplate(freshDocument(canonicalizeTemplate(baseline)));
    } catch {
      return undefined;
    }
  }, [isConflictDialogOpen]);

  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !liveTemplate || !formValues) return '';
    const projected = buildTemplateUpdates(formValues);
    const local = { ...liveTemplate, ...projected } as V5.Template;
    try {
      return serializeTemplate(freshDocument(canonicalizeTemplate(local)));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveTemplate, formValues]);

  const conflictPathLabels = useMemo(
    () =>
      liveTemplate
        ? prettyPathMap(templateResolveAdapter, liveTemplate, allConflicts.keys())
        : new Map<string, string>(),
    [liveTemplate, allConflicts],
  );

  // Init: populate form from the live template once, then let useReprime's
  // auto-rebase advance primedFingerprint + conflict baseline.
  useEffect(() => {
    if (initializedRef.current || !liveTemplate) return;
    initializedRef.current = true;
    populateFormFromTemplate(liveTemplate);
    setIsInitialized(true);
  }, [liveTemplate, populateFormFromTemplate]);

  // ── Save ────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!liveTemplate) return;
    const values = form.getFieldsValue();
    // Save-time per-field merge: rebases the form against the latest
    // canonical so the save batch only carries leaves the user
    // actually edited.
    const updates = mergeTemplateForSave(buildTemplateUpdates(values), baselineTemplateRef.current, liveTemplate);
    const success = await updateTemplate(liveTemplate.uid, updates);
    if (success) {
      message.success('Template saved');
      conflicts.clearDismissed();
      // Dirty derives from form-vs-canonical equality; broadcast echo
      // brings live template in line with form, auto-rebase clears.
    } else {
      message.error('Failed to save template');
    }
  }, [liveTemplate, form, updateTemplate, message, conflicts]);

  const shell = useEditorShell({
    entityType: TEMPLATE_ENTITY_TYPE,
    entityId: templateUid,
    isDirty,
    onSave: handleSave,
    onDirtyChange,
    registerSaveRef,
  });

  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      const reqH = form.getFieldValue('requestHeaders') as unknown[] | undefined;
      const resH = form.getFieldValue('responseHeaders') as unknown[] | undefined;
      setHeaderReqCount(reqH?.length ?? 0);
      setHeaderResCount(resH?.length ?? 0);

      // Dynamic-template prefill — same posture as RuleEditor.
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
    [form],
  );

  const localInstanceId = useLocalInstanceId();

  if (!liveTemplate) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Text type="secondary">Template not found</Text>
      </div>
    );
  }

  const headerTitle = (
    <>
      <Typography.Text strong style={{ fontSize: 13 }}>
        {liveTemplate.name || 'Template'}
      </Typography.Text>
      <PresenceBadge
        entityType={TEMPLATE_ENTITY_TYPE}
        entityId={templateUid}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <ActionPathsProvider value={TEMPLATE_ACTION_PATHS}>
        <div className="rules-rule-editor">
          <EditorHeader title={headerTitle} shell={shell.headerProps} />
          <Form form={form} layout="vertical" onFinish={handleSave} onValuesChange={handleValuesChange} size="small">
            <Form.Item name="ruleType" hidden>
              <input type="hidden" />
            </Form.Item>

            <EntityConflictBanner
              count={allConflicts.size}
              forceVisible={hasDialogOnlyConflict(allConflicts)}
              onReview={() => setConflictDialogOpen(true)}
              onKeepAllMine={handleKeepAllMine}
              onUseAllSaved={handleUseAllSaved}
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end', marginTop: 16 }}>
              <Form.Item name="templateIcon" style={{ marginBottom: 0 }}>
                <TwoToneIconPicker />
              </Form.Item>
              <Form.Item name="templateName" style={{ marginBottom: 0, flex: 1 }}>
                <EntityField path={TEMPLATE_ACTION_PATHS.name}>
                  <Input size="small" placeholder="Template name" />
                </EntityField>
              </Form.Item>
              <Form.Item name="ruleType" style={{ marginBottom: 0, width: 160 }}>
                <Select size="small" options={RULE_TYPE_OPTIONS} disabled />
              </Form.Item>
            </div>

            <Form.Item name="templateDescription" style={{ marginBottom: 16 }}>
              <EntityField path="description">
                <TextArea size="small" placeholder="Description (optional)" autoSize={{ minRows: 1, maxRows: 3 }} />
              </EntityField>
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
            {selectedType && <ActionValueBanner ruleType={selectedType} />}

            {/* ── Conditions ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Text strong style={{ fontSize: 13 }}>
                  Conditions
                </Text>
                <InfoCircleOutlined
                  style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
                />
              </div>
              <Form.Item name="conditions" style={{ marginBottom: 0 }}>
                <ConditionEditor />
              </Form.Item>
            </div>
          </Form>

          <EntityConflictDialog
            open={isConflictDialogOpen}
            savedText={savedYaml}
            mineText={mineText}
            baseText={baseYaml}
            language="yaml"
            onResolveText={handleResolveText}
            onClose={() => setConflictDialogOpen(false)}
          />
        </div>
      </ActionPathsProvider>
    </EntityScopeProvider>
  );
};

export default TemplateEditor;

// ── Pure projection: form values → V5.Template update shape ──────────
//
// Used both at save time and as the dirty-derivation projection. The
// `name`, `icon`, `description`, `includes`, `conditions`, `formValues`
// shape exactly mirrors what `updateTemplate` writes, so dirty
// detection compares like-for-like against the live template.

function buildTemplateUpdates(values: Record<string, unknown>): {
  name: string;
  icon: string;
  description: string;
  includes: { conditions: boolean; formValues: boolean };
  conditions: V5.RuleCondition[];
  formValues: Record<string, unknown>;
} {
  const includeConditions = values.includeConditions !== false;
  const includeFormValues = values.includeFormValues !== false;
  const formValues: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values)) {
    if (!META_KEYS.has(key)) formValues[key] = val;
  }
  return {
    name: (values.templateName as string) ?? '',
    icon: (values.templateIcon as string) ?? '',
    description: (values.templateDescription as string) ?? '',
    includes: { conditions: includeConditions, formValues: includeFormValues },
    conditions: includeConditions ? ((values.conditions as V5.RuleCondition[]) ?? []) : [],
    formValues: includeFormValues ? formValues : {},
  };
}
