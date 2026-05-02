/**
 * RuleEditor — single-mode (edit) editor bound to a real entity.
 *
 * Every "create rule" gesture in the product mints a real entity at click
 * time (via `openCreateTab` → `applyRuleCreate`); this editor only ever
 * sees a persisted rule. The `published` flag on the rule distinguishes
 * "still drafting" from "live" — the Save button is the publication gate
 * (see `memory/project_publication_gate_decision.md`).
 *
 * Ownership model:
 *   - **Form** owns content fields (domains, per-type fields).
 *   - **Rule store** (via mutator) owns `enabled` and `name`.
 *   - **`templateKey` / `initialDraft` props** pre-fill the form on mount
 *     for unpublished rules — uncommitted overlay until Save.
 *
 * Toggling enabled from the sidebar reflects immediately; breadcrumb
 * renames are never overwritten by a stale form value on save.
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
import { useRuleMutator } from '@hooks/useRuleMutator';
import { useRules } from '@hooks/useRules';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import type { MenuProps } from 'antd';
import { Alert, App, Button, Dropdown, Form, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PresenceBadge, useLocalInstanceId, useSurfaceIdentity } from '@/shared/awareness';
import { applyRuleCreate, applyRulePublish } from '@/shared/sync/rule-write-client';
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
import { mapAntdIdToFieldPath } from './rule-fields/field-path-map';
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields, { maybePrefillInjectCode } from './rule-fields/InjectRuleFields';
import MockRuleFields, { MOCK_DYNAMIC_TEMPLATE } from './rule-fields/MockRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';
import { useRuleConflicts } from './rule-fields/use-rule-conflicts';
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
  ruleUid: string;
  tabId: string;
  /** Template to pre-apply on first mount (form-only overlay; commits
   *  with the rest of the form on Save). Honored only for unpublished
   *  rules — published rules ignore the prop. */
  initialTemplateKey?: string;
  /** Pre-filled rule draft supplied by an external caller (inspector
   *  panel "override this header" CTA, future import/paste flows).
   *  Same semantics as `initialTemplateKey` — first-mount form overlay
   *  on unpublished rules only. */
  initialDraft?: V5.RuleDraft;
  onSaved: (uid: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (saveFn: () => void) => void;
  registerSaveAsTemplateRef?: (fn: () => void) => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
  ruleUid,
  tabId: _tabId,
  initialTemplateKey,
  initialDraft,
  onSaved,
  onDirtyChange,
  registerSaveRef,
  registerSaveAsTemplateRef,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { openDocs } = useInspectorNav();
  const { rules, activeWorkspaceId, localCollections, templates: userTemplates, templateCollectionTrees } = useRules();
  const mutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const identity = useSurfaceIdentity();
  const localInstanceId = useLocalInstanceId();
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

  /** Live rule from context — always current. */
  const liveRule = useMemo(() => rules.find((r) => r.uid === ruleUid), [ruleUid, rules]);

  /** Whether the rule is published (live to DNR / runners). Drafts are
   *  unpublished; Save flips `published: true`. */
  const isPublished = liveRule?.published === true;

  // Phase A A5 — deletion handling.
  //
  // When the live rule disappears (delete tombstone landed from another
  // surface), capture the last-known shape so the read-only "deleted
  // by …" view can render and the Undelete button can re-emit a
  // `create(...)` with a fresh id (§7.2 — re-creation MUST use a fresh
  // id; there's no HLC escape hatch). The open tab hands off to the
  // freshly-created rule via `onSaved(newUid)`.
  const lastSeenRuleRef = useRef<V5.Rule | null>(null);
  useEffect(() => {
    if (liveRule) {
      lastSeenRuleRef.current = liveRule;
    }
  }, [liveRule]);
  const isDeletedRemotely = initializedRef.current && !liveRule && lastSeenRuleRef.current !== null;

  // Stale-draft tracking is gone — the sync engine
  // (`docs/SYNC_ENGINE_DESIGN.md` §6.2) replaces the version-counter
  // OCC with HLC-stamped per-field LWW + an awareness ribbon. Saves
  // unconditionally apply; concurrent edits from another surface
  // arrive on the broadcast channel and reconcile per-field.

  /** Rule type is immutable for the lifetime of the entity. */
  const selectedType = liveRule?.type as V5.ExtensionRuleType | undefined;

  /** Single source of truth for enabled state. */
  const isEnabled = liveRule?.enabled ?? true;

  /** Single source of truth for name. */
  const ruleName = liveRule?.name ?? 'Rule';

  // ── Awareness publisher (Phase A A2) ─────────────────────────────
  // Workbench publishes entity-level presence so other surfaces (popup,
  // devpanel) can show a badge when this surface has the rule open.
  // Per-field focus tracking lands later — the workbench's antd Form
  // doesn't expose a global focused-path stream, and the dominant
  // collision lane today is devpanel→workbench (one-shot popover edits
  // colliding with a longer-lived editor session). The single dirty
  // marker tells other surfaces this editor has unsaved edits without
  // committing to a per-leaf path catalogue mid-Phase-A.
  const entityFocus = useMemo(() => ({ type: RULE_ENTITY_TYPE, id: ruleUid }), [ruleUid]);
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
    () => (focusedFieldPath ? { type: RULE_ENTITY_TYPE, id: ruleUid, path: focusedFieldPath } : null),
    [ruleUid, focusedFieldPath],
  );

  useAwareness({
    workspaceId: activeWorkspaceId,
    identity,
    entityFocus,
    fieldFocus,
    dirtyFields,
    enabled: true,
  });

  const conflicts = useRuleConflicts({
    liveRule: liveRule ?? null,
    isDirty,
    enabled: true,
  });

  const conflictBridge = useMemo(
    () => ({
      getConflict: conflicts.getConflict,
      onAcceptTheirs: conflicts.acceptTheirs,
      onDismissConflict: conflicts.dismiss,
    }),
    [conflicts.getConflict, conflicts.acceptTheirs, conflicts.dismiss],
  );

  const handleToggleEnabled = useCallback(() => {
    void mutator.toggleRule(ruleUid, !isEnabled);
  }, [ruleUid, isEnabled, mutator]);

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
  //
  // We depend only on `conflicts.setBaseline` (a stable `useCallback(_, [])`)
  // — depending on the whole `conflicts` memo would loop: setBaseline
  // calls `setDismissed(new Set())` which triggers `getConflict` to
  // rebuild → `conflicts` rebuilds → `populateFormFromRule` rebuilds →
  // re-prime effect re-fires → setBaseline → loop.
  const setBaseline = conflicts.setBaseline;
  const populateFormFromRule = useCallback(
    (rule: V5.Rule) => {
      const baseValues = {
        ruleType: rule.type,
        conditions: rule.conditions,
      };
      setBaseline(rule);
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
    [form, setBaseline],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    const rule = rules.find((r) => r.uid === ruleUid);
    if (!rule) return;
    initializedRef.current = true;
    populateFormFromRule(rule);

    // First-mount overlay for unpublished rules created via gestures
    // that pre-fill the form (inspector "override this header" CTA,
    // future import flows). Published rules ignore the overlay — the
    // user already committed prior content.
    //
    // Conditions overlay: `buildDraftConditions` translates the draft's
    // URL into a url-pattern condition with the current draft-url
    // strategy.
    if (rule.published !== true && initialDraft && initialDraft.type === rule.type) {
      const overlay: Record<string, unknown> = {};
      const conditions = buildDraftConditions(initialDraft, draftUrlStrategy);
      if (conditions.length > 0) overlay.conditions = conditions;

      if (initialDraft.type === 'header') {
        // Preserve the draft's direction intent: if the draft targets
        // only response headers, leave requestHeaders empty so the
        // editor's "jump to response tab" heuristic fires. A default
        // placeholder would otherwise defeat it.
        const targetsResponse = !!initialDraft.responseHeaders?.length;
        const targetsRequest = !!initialDraft.requestHeaders?.length;
        if (initialDraft.requestHeaders) overlay.requestHeaders = initialDraft.requestHeaders;
        else if (targetsResponse) overlay.requestHeaders = [];
        if (initialDraft.responseHeaders) overlay.responseHeaders = initialDraft.responseHeaders;
        else if (targetsRequest) overlay.responseHeaders = [];
      } else if (initialDraft.type === 'redirect') {
        if (initialDraft.redirectTo) overlay.redirectTo = initialDraft.redirectTo;
      }
      // Block has no editable action fields.
      // Other rule types extend similarly as inspector CTAs grow.

      if (Object.keys(overlay).length > 0) {
        form.setFieldsValue(overlay);
        notifyDirty(true);
        if (rule.type === 'header') {
          const reqLen = Array.isArray(overlay.requestHeaders)
            ? (overlay.requestHeaders as unknown[]).length
            : ((rule as V5.HeaderRule).action.requestHeaders?.length ?? 0);
          const resLen = Array.isArray(overlay.responseHeaders)
            ? (overlay.responseHeaders as unknown[]).length
            : ((rule as V5.HeaderRule).action.responseHeaders?.length ?? 0);
          setHeaderReqCount(reqLen);
          setHeaderResCount(resLen);
          setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
        }
      }
    }
  }, [ruleUid, rules, form, initialDraft, draftUrlStrategy, populateFormFromRule, notifyDirty]);

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
    if (!liveRule) return;
    if (isDirtyRef.current) return;
    populateFormFromRule(liveRule);
    // liveRuleSignature is the change trigger; the populate runs against
    // the latest liveRule.
  }, [liveRuleSignature, liveRule, populateFormFromRule]);

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
    if (!liveRule) return;
    // Publication-gate short-circuit. Mirrors `EditorHeader`'s Save
    // disabled state: published rule + no uncommitted edits = nothing
    // to do. Without this, Cmd+S keeps firing redundant publish
    // batches even though the visible Save button is greyed out.
    if (liveRule.published === true && !isDirtyRef.current) return;
    const ruleType = liveRule.type;
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
      // Save = commit form values + flip publication gate. Two batches:
      // the content commit fires DNR rebuild via the per-mutator side
      // effects (header/redirect/etc. mutators emit recompile intents
      // when their fields change); the publish call adds an explicit
      // recompile + the `published` field flip. Per-keystroke streaming
      // (§19.1) lands later — when it does, the content-commit step
      // will be a no-op because every keystroke already streamed.
      const updates = rule as Partial<Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>>;
      const updated = await mutator.updateRule(ruleUid, updates);
      if (!updated.ok) {
        if (updated.reason === 'not-found') message.error('Rule was deleted from another tab');
        else message.error(`Failed to update rule${updated.message ? `: ${updated.message}` : ''}`);
        return;
      }
      const published = await applyRulePublish(ruleUid, {
        workspaceId: activeWorkspaceId ?? '',
        surfaceId: 'workbench',
      });
      if (!published.ok) {
        message.error('Rule saved but publication failed');
        return;
      }
      message.success(isPublished ? 'Rule updated' : 'Rule published');
      notifyDirty(false);
      conflicts.clearDismissed();
      onSaved(ruleUid);
    } finally {
      setSaving(false);
    }
  }, [
    form,
    buildRule,
    liveRule,
    ruleUid,
    activeWorkspaceId,
    isPublished,
    message,
    mutator,
    notifyDirty,
    onSaved,
    conflicts,
  ]);

  useEffect(() => {
    registerSaveRef?.(handleSubmit);
  }, [registerSaveRef, handleSubmit]);

  // Phase A A5 — Undelete. The original entity is tombstoned (delete-
  // wins per §7.2); resurrection mints a fresh uid. The open tab swaps
  // its identity to the new uid via `onSaved`, so the editor remounts
  // pointing at the live entity. Re-published immediately so the
  // restored rule lands live again — matching the user's expectation
  // that "Restore" reverses the deletion.
  const handleUndelete = useCallback(async () => {
    const last = lastSeenRuleRef.current;
    if (!last || !activeWorkspaceId) return;
    const collection = localCollections[0];
    const parentPath = collection?.path;
    if (!parentPath) {
      message.error('No collection found');
      return;
    }
    const { uid: _uid, path: _path, schemaVersion: _sv, ...payload } = last;
    void _uid;
    void _path;
    void _sv;
    const opts = { workspaceId: activeWorkspaceId, surfaceId: 'workbench' };
    const created = await applyRuleCreate({ rule: payload, parentPath }, opts);
    if (!created.ok) {
      message.error('Failed to restore rule');
      return;
    }
    if (last.published === true) {
      await applyRulePublish(created.rule.uid, opts);
    }
    lastSeenRuleRef.current = null;
    message.success('Rule restored');
    onSaved(created.rule.uid);
  }, [activeWorkspaceId, localCollections, message, onSaved]);

  const openSaveAsTemplate = useCallback(() => setSaveAsTemplateOpen(true), []);
  useEffect(() => {
    registerSaveAsTemplateRef?.(openSaveAsTemplate);
  }, [registerSaveAsTemplateRef, openSaveAsTemplate]);

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

  // Collection the rule belongs to — used by the resolution banner so
  // collection-scoped `{{collection.X}}` references resolve correctly.
  const bannerCollectionId = useMemo<string | undefined>(() => {
    if (!liveRule) return undefined;
    const match = localCollections.find((c) => liveRule.path.startsWith(`${c.path}/`));
    return match?.uid;
  }, [liveRule, localCollections]);

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
        Edit {RULE_TYPE_TITLE[selectedType ?? 'header'] ?? 'Rule'}
      </Typography.Text>
      <PresenceBadge
        entityType={RULE_ENTITY_TYPE}
        entityId={ruleUid}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
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
        isPublished={isPublished}
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
                      ruleUid={ruleUid}
                      excludeInstanceId={localInstanceId}
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
                    Each row targets one DNR field, so rows combine with <strong>AND</strong> — every row must match. To
                    match any of several values, list them inside one row (the <strong>OR</strong> badge marks rows that
                    accept multiple values; <strong>1 value</strong> rows take a single scalar). Add at least one
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
