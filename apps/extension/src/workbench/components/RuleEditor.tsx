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

import {
  DownOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOpenTwoTone,
  FolderOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useAwareness } from '@hooks/useAwareness';
import { useRules } from '@hooks/useRules';
import { useRuleMutator } from '@hooks/useRuleMutator';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MenuProps } from 'antd';
import { Alert, App, Button, Dropdown, Form, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PresenceBadge } from '@/shared/awareness';
import { mapAntdIdToFieldPath } from './rule-fields/field-path-map';
import { useRuleConflicts } from './rule-fields/use-rule-conflicts';
import { buildDraftConditions } from '../draft-conditions';
import { useInspectorNav } from '../hooks/useInspectorNav';
import { formatString } from '../languages/prettier';
import type { LanguageId } from '../languages/registry';
import { SYSTEM_TEMPLATE_TREE_BY_TYPE, type SystemTemplateNode, TEMPLATES_BY_TYPE } from '../rule-templates';
import { useSettingValue } from '../settings/hooks';
import { get as getSetting } from '../settings/store';
import ConditionEditor from './ConditionEditor';
import EditorHeader from './EditorHeader';
import { ActionValueBanner } from './rule-fields/ActionValueBanner';
import BlockRuleFields from './rule-fields/BlockRuleFields';
import BodyRuleFields, { BODY_DYNAMIC_TEMPLATE } from './rule-fields/BodyRuleFields';
import DelayRuleFields from './rule-fields/DelayRuleFields';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields, { maybePrefillInjectCode } from './rule-fields/InjectRuleFields';
import MockRuleFields, { MOCK_DYNAMIC_TEMPLATE } from './rule-fields/MockRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';
import SaveAsTemplateModal from './SaveAsTemplateModal';
import { buildRuleIcon } from './shared/rule-icon';
import { renderTwoToneIcon } from './TwoToneIconPicker';
import { SuggestionContextProvider } from './template-input';

const { Text } = Typography;

const RULE_TYPE_TITLE: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  body: 'API Request Body Rule',
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
  /**
   * Pre-filled rule draft supplied by an external caller (e.g. the
   * inspector panel's "override this header" CTA). Populates the form
   * on mount when `mode === 'create'` so the user arrives at a
   * ready-to-save rule — but the rule stays unsaved until they
   * explicitly confirm via the Save modal.
   */
  initialDraft?: V5.RuleDraft;
  onSaved: (uid: string) => void;
  onSaveDraft?: (tabId: string, draftData: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (saveFn: () => void) => void;
  registerSaveAsTemplateRef?: (fn: () => void) => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
  mode,
  ruleType,
  ruleUid,
  tabId,
  draftName,
  initialTemplateKey,
  initialDraft,
  onSaved,
  onSaveDraft,
  onDirtyChange,
  registerSaveRef,
  registerSaveAsTemplateRef,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { openDocs } = useInspectorNav();
  const {
    rules,
    activeWorkspaceId,
    createLocalRule,
    localCollections,
    templates: userTemplates,
    templateCollectionTrees,
  } = useRules();
  const mutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const [form] = Form.useForm();
  const [_saving, setSaving] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const initializedRef = useRef(false);
  const isDirtyRef = useRef(false);
  // Reactive mirror of isDirtyRef so the shared EditorHeader's Save
  // button can toggle disabled/enabled. Updated alongside every
  // `onDirtyChange?.(…)` via the helper below.
  const [isDirty, setIsDirty] = useState(false);
  const notifyDirty = useCallback(
    (dirty: boolean) => {
      isDirtyRef.current = dirty;
      setIsDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  // ── Header state (lifted from HeaderRuleFields for reliable timing) ──
  // useWatch has inherent first-render timing issues — parent owns the truth.
  const [headerActiveTab, setHeaderActiveTab] = useState('request');
  const [headerReqCount, setHeaderReqCount] = useState(0);
  const [headerResCount, setHeaderResCount] = useState(0);

  // URL-derivation strategy for `initialDraft.url` → url-filter condition.
  // Read live so a user who changes the setting mid-session gets the new
  // behavior on next draft open.
  const draftUrlStrategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // ── Enabled state: owned by rule store (edit) or local (create) ──

  const [draftEnabled, setDraftEnabled] = useState(true);

  /** Live rule from context — always current for edit mode. */
  const liveRule = useMemo(
    () => (mode === 'edit' && ruleUid ? rules.find((r) => r.uid === ruleUid) : undefined),
    [mode, ruleUid, rules],
  );

  // Phase A A5 — deletion handling.
  //
  // When the live rule disappears in edit mode (delete tombstone landed
  // from another surface), capture the last-known shape so the
  // read-only "deleted by …" view can render and the Undelete button
  // can re-emit a `create(...)` with a fresh id (§7.2 — re-creation
  // MUST use a fresh id; there's no HLC escape hatch). The open tab
  // hands off to the freshly-created rule via `onSaved(newUid)`.
  const lastSeenRuleRef = useRef<V5.Rule | null>(null);
  useEffect(() => {
    if (mode === 'edit' && liveRule) {
      lastSeenRuleRef.current = liveRule;
    }
  }, [mode, liveRule]);
  const isDeletedRemotely =
    mode === 'edit' && !!ruleUid && initializedRef.current && !liveRule && lastSeenRuleRef.current !== null;

  // Stale-draft tracking is gone — the sync engine
  // (`docs/SYNC_ENGINE_DESIGN.md` §6.2) replaces the version-counter
  // OCC with HLC-stamped per-field LWW + an awareness ribbon. Saves
  // unconditionally apply; concurrent edits from another surface
  // arrive on the broadcast channel and reconcile per-field. Until
  // the awareness ribbon (A1–A6) lands, this editor just commits the
  // user's draft on save and displays whatever liveRule reflects.

  /**
   * Rule type is immutable for a given tab — in create mode it comes from
   * the `ruleType` prop, in edit mode from the live rule. There is no code
   * path that changes `ruleType` inside the form, so this never needs a
   * form subscription and the first render is already correct.
   */
  const selectedType =
    mode === 'edit'
      ? (liveRule?.type as V5.ExtensionRuleType | undefined)
      : (ruleType as V5.ExtensionRuleType | undefined);

  /** Single source of truth for enabled state. */
  const isEnabled = mode === 'edit' ? (liveRule?.enabled ?? true) : draftEnabled;

  /** Single source of truth for name. */
  const ruleName = mode === 'edit' ? (liveRule?.name ?? 'Rule') : (draftName ?? 'Untitled');

  // ── Awareness publisher (Phase A A2) ─────────────────────────────
  // Workbench publishes entity-level presence so other surfaces (popup,
  // devpanel) can show a badge when this surface has the rule open.
  // Per-field focus tracking lands later — the workbench's antd Form
  // doesn't expose a global focused-path stream, and the dominant
  // collision lane today is devpanel→workbench (one-shot popover edits
  // colliding with a longer-lived editor session). The single dirty
  // marker tells other surfaces this editor has unsaved edits without
  // committing to a per-leaf path catalogue mid-Phase-A.
  const entityFocus = useMemo(
    () => (mode === 'edit' && ruleUid ? { type: RULE_ENTITY_TYPE, id: ruleUid } : null),
    [mode, ruleUid],
  );
  const dirtyFields = useMemo<string[]>(() => (isDirty ? ['*'] : []), [isDirty]);

  // Per-field focus path. The DOM target's id (set by antd Form on every
  // bound input) is the load-bearing signal — focus events from inputs
  // bubble through capture so a single listener on the Form root catches
  // every field swap. The map handles header-mod / condition /
  // query-param / mock-header indexed paths plus scalar field ids.
  const [focusedFieldPath, setFocusedFieldPath] = useState<string | null>(null);
  const handleFocusCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const id = target?.getAttribute?.('id') ?? null;
    const path = mapAntdIdToFieldPath(id);
    if (path) setFocusedFieldPath(path);
  }, []);
  const handleBlurCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // relatedTarget is the next focus recipient. If it's another bound
    // input still inside the form, the next focusCapture will replace
    // the path; only clear when focus actually leaves the form.
    const next = e.relatedTarget as HTMLElement | null;
    if (next && e.currentTarget.contains(next)) return;
    setFocusedFieldPath(null);
  }, []);
  const fieldFocus = useMemo(
    () =>
      mode === 'edit' && ruleUid && focusedFieldPath
        ? { type: RULE_ENTITY_TYPE, id: ruleUid, path: focusedFieldPath }
        : null,
    [mode, ruleUid, focusedFieldPath],
  );

  useAwareness({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
    entityFocus,
    fieldFocus,
    dirtyFields,
    enabled: mode === 'edit' && !!ruleUid,
  });

  const conflicts = useRuleConflicts({
    liveRule: liveRule ?? null,
    isDirty,
    enabled: mode === 'edit' && !!ruleUid,
  });

  // Bridge handed to per-type *RuleFields. `undefined` in create mode so
  // chips never render against a draft (no live rule to conflict with).
  const conflictBridge = useMemo(
    () =>
      mode === 'edit'
        ? {
            getConflict: conflicts.getConflict,
            onAcceptTheirs: conflicts.acceptTheirs,
            onDismissConflict: conflicts.dismiss,
          }
        : undefined,
    [mode, conflicts.getConflict, conflicts.acceptTheirs, conflicts.dismiss],
  );

  const handleToggleEnabled = useCallback(() => {
    if (mode === 'edit' && ruleUid) {
      void mutator.toggleRule(ruleUid, !isEnabled);
    } else {
      setDraftEnabled((prev) => !prev);
    }
  }, [mode, ruleUid, isEnabled, mutator]);

  // ── Template selector ─────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateKey ?? 'empty');

  const builtinTemplates = useMemo(() => TEMPLATES_BY_TYPE[selectedType ?? 'header'] ?? [], [selectedType]);
  const systemTemplateTree = useMemo(
    () => SYSTEM_TEMPLATE_TREE_BY_TYPE[selectedType ?? 'header'] ?? [],
    [selectedType],
  );
  const filteredUserTemplates = useMemo(
    () => userTemplates.filter((t) => t.ruleType === (selectedType ?? 'header')),
    [userTemplates, selectedType],
  );

  const applyTemplate = useCallback(
    (key: string) => {
      setSelectedTemplate(key);
      const type = selectedType ?? 'header';

      // Reset form first — clears all Form.List items to zero.
      // Then setFieldsValue only adds items (never needs to clear), so it works
      // correctly for empty arrays and properly notifies useWatch for badge counts.
      form.resetFields();

      // Set header tab + badge counts from known data (avoids useWatch timing issues)
      const updateHeaderState = (fv: Record<string, unknown>) => {
        const reqLen = Array.isArray(fv.requestHeaders) ? (fv.requestHeaders as unknown[]).length : 0;
        const resLen = Array.isArray(fv.responseHeaders) ? (fv.responseHeaders as unknown[]).length : 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
      };

      if (key === 'empty') {
        form.setFieldsValue({ ruleType: type, conditions: [] });
        updateHeaderState({});
        return;
      }

      // Try built-in templates first
      const builtins = TEMPLATES_BY_TYPE[type] ?? [];
      const builtin = builtins.find((t) => t.key === key);
      if (builtin) {
        form.setFieldsValue({ ruleType: type, conditions: builtin.conditions, ...builtin.formValues });
        updateHeaderState(builtin.formValues);
      } else {
        // Try user templates (key is the uid)
        const userTpl = userTemplates.find((t) => t.uid === key);
        if (userTpl) {
          const values: Record<string, unknown> = { ruleType: type };
          if (userTpl.includes.conditions && userTpl.conditions) {
            values.conditions = userTpl.conditions;
          }
          if (userTpl.includes.formValues && userTpl.formValues) {
            Object.assign(values, userTpl.formValues);
          }
          form.setFieldsValue(values);
          updateHeaderState(userTpl.formValues ?? {});
        }
      }

      if (!isDirtyRef.current) notifyDirty(true);
    },
    [selectedType, form, notifyDirty, userTemplates],
  );

  // ── Form initialization (content fields only — no name/enabled) ──

  // Populate form from a persisted rule. Pulled out of the init effect
  // so the live-update path (Phase A A4 — re-prime form on external
  // mutation while the editor is clean) can reuse the same shape.
  const populateFormFromRule = useCallback(
    (rule: V5.Rule) => {
      const baseValues = {
        ruleType: rule.type,
        conditions: rule.conditions,
      };
      conflicts.setBaseline(rule);
      switch (rule.type) {
        case 'header': {
          const hr = rule as V5.HeaderRule;
          const reqH = hr.action.requestHeaders ?? [];
          const resH = hr.action.responseHeaders ?? [];
          form.setFieldsValue({ ...baseValues, requestHeaders: reqH, responseHeaders: resH });
          setHeaderReqCount(reqH.length);
          setHeaderResCount(resH.length);
          setHeaderActiveTab(resH.length > 0 && reqH.length === 0 ? 'response' : 'request');
          break;
        }
        case 'block':
          form.setFieldsValue(baseValues);
          break;
        case 'redirect': {
          const rr = rule as V5.RedirectRule;
          form.setFieldsValue({ ...baseValues, redirectTo: rr.action.redirectTo });
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
            injectBypassCSP: ir.action.bypassCSP ?? false,
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
            mockResourceType: mr.action.resourceType || 'rest',
            mockGraphqlKey: mr.action.graphqlFilter?.key || '',
            mockGraphqlOperator: mr.action.graphqlFilter?.operator || 'Equals',
            mockGraphqlValue: mr.action.graphqlFilter?.value || '',
            mockResponseHeaders: Object.entries(mr.action.responseHeaders ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
          });
          break;
        }
      }
    },
    [form, conflicts],
  );

  useEffect(() => {
    if (initializedRef.current) return;

    if (mode === 'edit' && ruleUid) {
      const rule = rules.find((r) => r.uid === ruleUid);
      if (!rule) return;
      initializedRef.current = true;
      populateFormFromRule(rule);
    } else if (mode === 'create' && ruleType) {
      initializedRef.current = true;

      // Type defaults applied first so every form field has a value.
      // An `initialDraft` (inspector handoff, future import flows) or
      // `initialTemplateKey` (user-picked template) overrides specific
      // fields on top. Precedence: defaults → template → draft.
      const defaults: Record<string, unknown> = {
        ruleType,
        conditions: [],
        requestHeaders: [{ uid: generateUid(), operation: 'override', headerName: '', value: '' }],
        responseHeaders: [],
        redirectTo: '',
        injectType: 'script',
        injectSource: 'code',
        injectCode: '',
        injectSourceUrl: '',
        injectPosition: 'body-end',
        injectBypassCSP: false,
        queryParams: [{ param: '', value: '', operation: 'add' }],
        mockBodyType: 'static',
        mockResourceType: 'rest',
        mockGraphqlOperator: 'Equals',
        mockContentType: 'application/json',
        mockResponseHeaders: [],
        bodyModType: 'static',
        bodyResourceType: 'rest',
        bodyGraphqlOperator: 'Equals',
      };

      // Apply `initialDraft` overlays for rule types the inspector /
      // external callers target today. The conditions seed uses the
      // same `buildDraftConditions` helper that the edit path used
      // before — draft URL → url-pattern condition with the current
      // draft-url strategy.
      if (initialDraft && initialDraft.type === ruleType) {
        const conditions = buildDraftConditions(initialDraft, draftUrlStrategy);
        if (conditions.length > 0) defaults.conditions = conditions;

        if (initialDraft.type === 'header') {
          // Preserve the draft's direction intent: if the draft
          // targets only response headers, leave requestHeaders
          // empty so the editor's "jump to response tab" heuristic
          // fires. The default placeholder would otherwise defeat it.
          const targetsResponse = !!initialDraft.responseHeaders?.length;
          const targetsRequest = !!initialDraft.requestHeaders?.length;
          defaults.requestHeaders =
            initialDraft.requestHeaders ??
            (targetsResponse ? [] : [{ uid: generateUid(), operation: 'override', headerName: '', value: '' }]);
          defaults.responseHeaders = initialDraft.responseHeaders ?? (targetsRequest ? [] : []);
        } else if (initialDraft.type === 'redirect') {
          if (initialDraft.redirectTo) defaults.redirectTo = initialDraft.redirectTo;
        }
        // Block has no editable action fields.
        // Other rule types extend similarly as inspector CTAs grow.
      }

      form.setFieldsValue(defaults);

      // Header-direction badge counts + initial tab follow the same
      // rule as the edit/template paths: if only one direction has
      // entries, select it.
      if (ruleType === 'header') {
        const reqLen = Array.isArray(defaults.requestHeaders) ? (defaults.requestHeaders as unknown[]).length : 0;
        const resLen = Array.isArray(defaults.responseHeaders) ? (defaults.responseHeaders as unknown[]).length : 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
      }
    }
  }, [mode, ruleType, ruleUid, rules, form, initialDraft, draftUrlStrategy, populateFormFromRule]);

  // Phase A A4 — live-update reconciliation.
  //
  // After init, `liveRule` mutates whenever another surface commits a
  // change. The §6.2 killer demo requires those edits to land in this
  // editor without a banner. When the editor has no uncommitted changes
  // (`isDirty === false`), the safe move is to re-prime the form from
  // the new live rule — same shape as the init pass, just with a
  // newer source. When the editor IS dirty, we leave the form alone:
  // the user is mid-edit, and per §6.3 the LWW save resolves the
  // conflict at oracle time. The inline diff chip (focused-field-with-
  // local-uncommitted-text branch) is a follow-up; today the
  // unconditional save semantics keep correctness even without the
  // chip — the user's local HLC > the incoming HLC, so their edit
  // wins on save.
  const liveRuleSignature = useMemo(() => {
    if (!liveRule) return null;
    // Lightweight identity for "did the live rule change". Compares
    // the JSON-serialized rule; cheap relative to the form re-prime
    // which is the work this effect gates.
    return JSON.stringify(liveRule);
  }, [liveRule]);
  useEffect(() => {
    if (!initializedRef.current) return;
    if (mode !== 'edit' || !liveRule) return;
    if (isDirtyRef.current) return;
    populateFormFromRule(liveRule);
    // liveRuleSignature is the change trigger; the populate runs against
    // the latest liveRule.
  }, [liveRuleSignature, mode, liveRule, populateFormFromRule]);

  // Apply initial template after form init (from tab identity, runs once).
  // Must wait for selectedType to resolve — applyTemplate looks up templates by type.
  const templateAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialTemplateKey || templateAppliedRef.current || !initializedRef.current || !selectedType) return;
    templateAppliedRef.current = true;
    applyTemplate(initialTemplateKey);
  }, [initialTemplateKey, applyTemplate, selectedType]);

  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      if (!isDirtyRef.current) notifyDirty(true);
      // Sync header badge counts from live form state during editing
      const reqH = form.getFieldValue('requestHeaders') as unknown[] | undefined;
      const resH = form.getFieldValue('responseHeaders') as unknown[] | undefined;
      setHeaderReqCount(reqH?.length ?? 0);
      setHeaderResCount(resH?.length ?? 0);

      // Prefill the dynamic code template the first time the user flips
      // Body/Mock to Dynamic mode. Lives here — not inside the field
      // components — so the child rule-field components stay pure-render
      // and don't need a parallel Form.useWatch subscription for side
      // effects. `changedValues` tells us exactly which Radio just flipped.
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
    [notifyDirty, form],
  );

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
          return { ...base, type: 'block', action: {} } as Omit<V5.BlockRule, 'uid' | 'path'>;
        case 'redirect':
          return {
            ...base,
            type: 'redirect',
            action: { redirectTo: (formValues.redirectTo as string) ?? '' },
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
              bypassCSP: (formValues.injectBypassCSP as boolean) || false,
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
              // Form.List rows → Record<string, string>. Drops empty
              // names; later occurrences of the same name silently
              // win (matches Object.fromEntries semantics — fine because
              // duplicate response headers are nonsensical).
              responseHeaders: Object.fromEntries(
                ((formValues.mockResponseHeaders as Array<{ name?: string; value?: string }>) ?? [])
                  .filter((h) => h.name?.trim())
                  .map((h) => [h.name!.trim(), h.value ?? '']),
              ),
              bodyType: ((formValues.mockBodyType as string) ?? 'static') as V5.MockBodyType,
              resourceType: ((formValues.mockResourceType as string) ?? 'rest') as V5.BodyResourceType,
              graphqlFilter:
                formValues.mockResourceType === 'graphql' && (formValues.mockGraphqlKey as string)?.trim()
                  ? {
                      key: (formValues.mockGraphqlKey as string).trim(),
                      operator: ((formValues.mockGraphqlOperator as string) || 'Equals') as 'Equals' | 'Contains',
                      value: (formValues.mockGraphqlValue as string) || '',
                    }
                  : undefined,
            },
          } as Omit<V5.MockRule, 'uid' | 'path'>;
        default:
          return null;
      }
    },
    [ruleName, isEnabled],
  );

  const handleSubmit = useCallback(async () => {
    // Format-on-save. For every known code field on the current rule
    // type, resolve its language from a sibling form value and push
    // the formatted string back into the form before we read values.
    // Failures are non-fatal — the user just gets a toast; the raw
    // buffer is preserved so they can fix the parse error and save.
    if (getSetting('editor.formatOnSave')) {
      const pre = form.getFieldsValue();
      const targets: Array<{ field: string; language: LanguageId }> = [];
      if (ruleType === 'inject') {
        targets.push({ field: 'injectCode', language: pre.injectType === 'css' ? 'css' : 'javascript' });
      } else if (ruleType === 'mock') {
        if (pre.mockBodyType === 'dynamic') {
          targets.push({ field: 'mockDynamicBody', language: 'javascript' });
        } else {
          targets.push({ field: 'mockStaticBody', language: 'json' });
        }
      } else if (ruleType === 'body') {
        if (pre.bodyModType === 'dynamic') {
          targets.push({ field: 'bodyDynamicContent', language: 'javascript' });
        } else {
          targets.push({ field: 'bodyStaticContent', language: 'json' });
        }
      }
      for (const { field, language } of targets) {
        const current = pre[field];
        if (typeof current !== 'string' || current.length === 0) continue;
        try {
          const formatted = await formatString(current, language);
          if (formatted !== current) form.setFieldValue(field, formatted);
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Unknown error';
          message.warning(`Format on save skipped: ${reason}`);
        }
      }
    }

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
          notifyDirty(false);
          onSaved(created.uid);
        } else {
          message.error('Failed to create rule');
        }
      } else if (ruleUid) {
        const updates = rule as Partial<Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>>;
        const result = await mutator.updateRule(ruleUid, updates);
        if (result.ok) {
          message.success('Rule updated');
          notifyDirty(false);
          conflicts.clearDismissed();
          onSaved(ruleUid);
        } else if (result.reason === 'not-found') {
          message.error('Rule was deleted from another tab');
        } else {
          message.error(`Failed to update rule${result.message ? `: ${result.message}` : ''}`);
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
    ruleType,
    tabId,
    createLocalRule,
    localCollections,
    message,
    mutator,
    notifyDirty,
    onSaved,
    onSaveDraft,
    conflicts,
  ]);

  useEffect(() => {
    registerSaveRef?.(handleSubmit);
  }, [registerSaveRef, handleSubmit]);

  // Phase A A5 — Undelete. The original entity is tombstoned (delete-
  // wins per §7.2); resurrection mints a fresh uid. The open tab swaps
  // its identity to the new uid via `onSaved`, so the editor remounts
  // pointing at the live entity.
  const handleUndelete = useCallback(async () => {
    const last = lastSeenRuleRef.current;
    if (!last) return;
    const { uid: _uid, path: _path, ...payload } = last;
    void _uid;
    void _path;
    const created = await createLocalRule(payload, localCollections[0]?.uid);
    if (created) {
      lastSeenRuleRef.current = null;
      message.success('Rule restored');
      onSaved(created.uid);
    } else {
      message.error('Failed to restore rule');
    }
  }, [createLocalRule, localCollections, message, onSaved]);

  const openSaveAsTemplate = useCallback(() => setSaveAsTemplateOpen(true), []);
  useEffect(() => {
    registerSaveAsTemplateRef?.(openSaveAsTemplate);
  }, [registerSaveAsTemplateRef, openSaveAsTemplate]);

  const isEdit = mode === 'edit';

  // ── Template selector menus ───────────────────────────────────
  // System Templates + User Templates render as hierarchical dropdowns:
  //   Collection/Root → Folder → Template leaf. For system templates the
  //   tree comes from SYSTEM_TEMPLATE_TREE_BY_TYPE; for user templates it
  //   comes from templateCollectionTrees filtered by the current rule type.

  const buildSystemMenuItems = useCallback(
    (nodes: SystemTemplateNode[]): NonNullable<MenuProps['items']> => {
      return nodes.map((node) => {
        if (node.kind === 'folder') {
          return {
            key: `sys-folder:${node.name}`,
            label: node.name,
            icon: <FolderOutlined />,
            children: buildSystemMenuItems(node.children),
          };
        }
        const tpl = node.template;
        return {
          key: `sys:${tpl.key}`,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>{tpl.icon}</span>
              <span>{tpl.name}</span>
            </span>
          ),
          onClick: () => applyTemplate(tpl.key),
        };
      });
    },
    [applyTemplate],
  );

  const systemMenuItems = useMemo(
    () => buildSystemMenuItems(systemTemplateTree),
    [systemTemplateTree, buildSystemMenuItems],
  );

  const buildUserMenuItems = useCallback(
    (nodes: V5.TreeNode[], ruleType: string): NonNullable<MenuProps['items']> => {
      const items: NonNullable<MenuProps['items']> = [];
      for (const node of nodes) {
        if (node.type === 'folder') {
          const childItems = buildUserMenuItems(node.children, ruleType);
          if (childItems.length > 0) {
            items.push({
              key: `usr-folder:${node.uid}`,
              label: node.name,
              icon: <FolderOutlined />,
              children: childItems,
            });
          }
        } else if (node.type === 'template' && node.ruleType === ruleType) {
          items.push({
            key: `usr:${node.uid}`,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {renderTwoToneIcon(node.icon, { fontSize: 14 })}
                <span>{node.name}</span>
              </span>
            ),
            onClick: () => applyTemplate(node.uid),
          });
        }
      }
      return items;
    },
    [applyTemplate],
  );

  const userMenuItems = useMemo(() => {
    const type = selectedType ?? 'header';
    const items: NonNullable<MenuProps['items']> = [];
    for (const col of templateCollectionTrees) {
      const childItems = buildUserMenuItems(col.tree, type);
      if (childItems.length === 0) continue;
      items.push({
        key: `usr-col:${col.uid}`,
        label: col.name,
        icon: <FolderOpenOutlined />,
        children: childItems,
      });
    }
    return items;
  }, [templateCollectionTrees, selectedType, buildUserMenuItems]);

  // Which source the current selection belongs to — drives active button state.
  const activeSystemTemplate = useMemo(
    () => (selectedTemplate === 'empty' ? undefined : builtinTemplates.find((t) => t.key === selectedTemplate)),
    [selectedTemplate, builtinTemplates],
  );
  const activeUserTemplate = useMemo(
    () => (selectedTemplate === 'empty' ? undefined : filteredUserTemplates.find((t) => t.uid === selectedTemplate)),
    [selectedTemplate, filteredUserTemplates],
  );
  const activeSource: 'blank' | 'system' | 'user' = activeSystemTemplate
    ? 'system'
    : activeUserTemplate
      ? 'user'
      : 'blank';

  const selectedDescription = useMemo(() => {
    if (activeSystemTemplate) return activeSystemTemplate.description.split('\n')[0];
    if (activeUserTemplate?.description) return activeUserTemplate.description.split('\n')[0];
    return null;
  }, [activeSystemTemplate, activeUserTemplate]);

  // Collection a persisted rule belongs to — used by the resolution
  // banner so collection-scoped `{{collection.X}}` references resolve
  // correctly. Drafts (create mode) haven't been slotted yet, so
  // collectionId is undefined and collection scope is unavailable.
  const bannerCollectionId = useMemo<string | undefined>(() => {
    if (mode !== 'edit' || !ruleUid) return undefined;
    const rule = rules.find((r) => r.uid === ruleUid);
    if (!rule) return undefined;
    const match = localCollections.find((c) => rule.path.startsWith(`${c.path}/`));
    return match?.uid;
  }, [mode, ruleUid, rules, localCollections]);

  const headerTitle = (
    <>
      {buildRuleIcon({
        ruleType: selectedType ?? 'header',
        rule: liveRule,
        isActive: isEnabled,
        compactArrow: true,
        size: 14,
      })}
      <Typography.Text strong style={{ fontSize: 13 }}>
        {isEdit ? 'Edit' : 'Add'} {RULE_TYPE_TITLE[selectedType ?? 'header'] ?? 'Rule'}
      </Typography.Text>
      {isEdit && ruleUid && (
        <PresenceBadge
          entityType={RULE_ENTITY_TYPE}
          entityId={ruleUid}
          excludeSurfaceId="workbench"
          style={{ marginLeft: 6 }}
        />
      )}
    </>
  );
  const headerActions = (
    <Switch
      size="small"
      checked={isEnabled}
      onChange={handleToggleEnabled}
      checkedChildren="Enabled"
      unCheckedChildren="Disabled"
    />
  );
  const overflowItems = [
    {
      key: 'save-as-template',
      icon: <FileOutlined />,
      label: 'Save as Template',
      onClick: openSaveAsTemplate,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader
        title={headerTitle}
        actions={headerActions}
        isDirty={isDirty}
        onSave={() => void handleSubmit()}
        overflowItems={overflowItems}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isDeletedRemotely && (
          <Alert
            type="warning"
            showIcon
            style={{ margin: 12, fontSize: 12 }}
            message="This rule was deleted from another surface."
            description="Restore creates a fresh copy with a new id (the original tombstone is permanent — see sync engine spec §7.2)."
            action={
              <Button size="small" type="primary" onClick={() => void handleUndelete()}>
                Restore
              </Button>
            }
          />
        )}
        <div
          className="rules-rule-editor"
          style={isDeletedRemotely ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
          onFocusCapture={handleFocusCapture}
          onBlurCapture={handleBlurCapture}
        >
          <SuggestionContextProvider value={{ collectionId: bannerCollectionId }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={handleValuesChange}
              size="small"
            >
              {/* Hidden: rule type (set at creation, can't change) */}
              <Form.Item name="ruleType" hidden>
                <input type="hidden" />
              </Form.Item>

              {/* Unresolved-variable feedback lives in the inline mirror
               *  (red-dashed `{{ref}}` at the source) + the Variables
               *  panel's "Resolution issues" section, both of which show
               *  the same state without reflowing the editor on every
               *  keystroke. An always-on banner here duplicated that
               *  information and nudged scroll as counts changed. */}
              {/* ── Templates ── */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Button
                    size="small"
                    type={activeSource === 'blank' ? 'primary' : 'default'}
                    icon={<FileOutlined />}
                    onClick={() => applyTemplate('empty')}
                  >
                    Blank
                  </Button>

                  <Dropdown
                    menu={{ items: systemMenuItems }}
                    trigger={['click']}
                    disabled={systemMenuItems.length === 0}
                  >
                    <Button size="small" type={activeSource === 'system' ? 'primary' : 'default'}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <FolderOpenOutlined style={{ fontSize: 13 }} />
                        <span>System Templates</span>
                        {activeSystemTemplate && (
                          <span
                            style={{
                              fontWeight: 400,
                              opacity: 0.85,
                            }}
                          >
                            : {activeSystemTemplate.icon} {activeSystemTemplate.name}
                          </span>
                        )}
                        <DownOutlined style={{ fontSize: 9 }} />
                      </span>
                    </Button>
                  </Dropdown>

                  <Tooltip
                    title={
                      userMenuItems.length === 0
                        ? 'No user templates yet for this rule type — save one first'
                        : undefined
                    }
                  >
                    <Dropdown menu={{ items: userMenuItems }} trigger={['click']} disabled={userMenuItems.length === 0}>
                      <Button size="small" type={activeSource === 'user' ? 'primary' : 'default'}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <FolderOpenTwoTone style={{ fontSize: 13 }} />
                          <span>User Templates</span>
                          {activeUserTemplate && (
                            <span style={{ fontWeight: 400, opacity: 0.85, display: 'inline-flex', gap: 4 }}>
                              :{renderTwoToneIcon(activeUserTemplate.icon, { fontSize: 12 })}
                              {activeUserTemplate.name}
                            </span>
                          )}
                          <DownOutlined style={{ fontSize: 9 }} />
                        </span>
                      </Button>
                    </Dropdown>
                  </Tooltip>
                </div>

                {selectedDescription && (
                  <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary }}>
                    {selectedDescription}
                  </div>
                )}
              </div>

              {/* ── Two-column grid: fields left, conditions right (on wide screens) ── */}
              <div className="rules-rule-editor-columns">
                {/* ── Per-type fields ── */}
                <div>
                  {selectedType === 'header' && (
                    <HeaderRuleFields
                      activeTab={headerActiveTab}
                      onTabChange={setHeaderActiveTab}
                      reqCount={headerReqCount}
                      resCount={headerResCount}
                      ruleUid={mode === 'edit' ? ruleUid : undefined}
                      surfaceId="workbench"
                      getConflict={conflicts.getConflict}
                      onAcceptTheirs={conflicts.acceptTheirs}
                      onDismissConflict={conflicts.dismiss}
                    />
                  )}
                  {selectedType === 'block' && <BlockRuleFields />}
                  {selectedType === 'redirect' && <RedirectRuleFields conflicts={conflictBridge} />}
                  {selectedType === 'query-param' && <QueryParamRuleFields />}
                  {selectedType === 'inject' && <InjectRuleFields conflicts={conflictBridge} />}
                  {selectedType === 'delay' && <DelayRuleFields conflicts={conflictBridge} />}
                  {selectedType === 'body' && <BodyRuleFields conflicts={conflictBridge} />}
                  {selectedType === 'mock' && <MockRuleFields conflicts={conflictBridge} />}
                  {/* Single-mount inline action validation. The validator
                      lives in core; new rule types pick the banner up
                      automatically when their case is added there. */}
                  {selectedType && <ActionValueBanner ruleType={selectedType} />}
                </div>

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
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ant-color-text-secondary)',
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    Each row targets one DNR field, so rows combine with <strong>AND</strong> — every row must match.
                    To match any of several values, list them inside one row (the <strong>OR</strong> badge marks rows
                    that accept multiple values; <strong>1 value</strong> rows take a single scalar). Add at least one
                    condition.
                  </div>
                  <Form.Item name="conditions" style={{ marginBottom: 0 }}>
                    <ConditionEditor />
                  </Form.Item>
                </div>
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
          </SuggestionContextProvider>
        </div>
      </div>
    </div>
  );
};

export default RuleEditor;
