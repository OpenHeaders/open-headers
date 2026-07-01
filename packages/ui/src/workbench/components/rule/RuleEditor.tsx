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
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { canonicalizeRule, parseRule, serializeRule } from '@openheaders/core/codec/yaml';
import { freshDocument } from '@openheaders/core/schemas';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { AuthRule, DelayRule, ExtensionRuleType, HeaderRule, InjectRule, QueryParamRule, RedirectRule, RequestBodyRule, ResponseRule, Rule, RuleDraft, SseRule, TreeNode, WsRule } from '@openheaders/core/types';
import { isRuleComplete } from '@openheaders/core/utils';
import type { MenuProps } from 'antd';
import { Alert, App, Button, Dropdown, Form, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionPathsProvider,
  EntityScopeProvider,
  PresenceBadge,
  RULE_ACTION_PATHS,
  useLocalInstanceId,
} from '@openheaders/ui/shared/awareness';
import type { ConflictResolution } from '@openheaders/ui/shared/conflicts';
import {
  EntityConflictBanner,
  EntityConflictDialog,
  hasDialogOnlyConflict,
  useAutoMergeForm,
} from '@openheaders/ui/shared/conflicts';
import { ConflictsProvider, type FieldConflictsApi } from '@openheaders/ui/shared/conflicts/Field';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { applyRuleCreate, applyRulePublish } from '@openheaders/ui/shared/sync/rule-write-client';
import {
  applyQueryParamDraftOverlay,
  applyRequestBodyDraftOverlay,
  applyResponseDraftOverlay,
  buildDraftConditions,
  buildDraftHeaders,
} from '../../draft-conditions';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import type { RuleDraftData } from '../../hooks/useSaveRuleFlow';
import { formatString } from '../../languages/prettier';
import type { LanguageId } from '../../languages/registry';
import { SYSTEM_TEMPLATE_TREE_BY_TYPE, type SystemTemplateNode, TEMPLATES_BY_TYPE } from '../../rule-templates';
import { useSettingValue } from '../../settings/hooks';
import { get as getSetting } from '../../settings/store';
import ConditionEditor from './ConditionEditor';
import EditorHeader from '../shell/EditorHeader';
import { ActionValueBanner } from '../rule-fields/ActionValueBanner';
import AuthRuleFields from '../rule-fields/AuthRuleFields';
import BlockRuleFields from '../rule-fields/BlockRuleFields';
import RequestBodyRuleFields, { REQUEST_BODY_DYNAMIC_TEMPLATE } from '../rule-fields/RequestBodyRuleFields';
import DelayRuleFields from '../rule-fields/DelayRuleFields';
import HeaderRuleFields from '../rule-fields/HeaderRuleFields';
import InjectRuleFields, { maybePrefillInjectCode } from '../rule-fields/InjectRuleFields';
import { SseRuleFields, WsRuleFields } from '../rule-fields/MessageRuleFields';
import ResponseRuleFields, { RESPONSE_BUILD_TEMPLATE, RESPONSE_MODIFY_TEMPLATE } from '../rule-fields/ResponseRuleFields';
import { buildRule } from '../rule-fields/build-rule';
import { mergeRuleForSave } from '../rule-fields/merge-rule-for-save';
import { prettyRulePathMap } from '../rule-fields/pretty-path';
import QueryParamRuleFields from '../rule-fields/QueryParamRuleFields';
import RedirectRuleFields from '../rule-fields/RedirectRuleFields';
import { applyResolutionToForm, applyResolutionToRule } from '../rule-fields/rule-form-resolver';
import type { PathConflict } from '../rule-fields/use-rule-conflicts';
import { useRuleConflicts } from '../rule-fields/use-rule-conflicts';
import SaveAsTemplateModal from '../save/SaveAsTemplateModal';
import { buildRuleIcon } from '../shared/rule-icon';
import { renderTwoToneIcon } from '../shared/TwoToneIconPicker';
import { SuggestionContextProvider } from '../template-input';

const { Text } = Typography;

const RULE_TYPE_TITLE: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  'request-body': 'API Request Body Rule',
  delay: 'Delay Rule',
  response: 'API Response Rule',
  ws: 'WebSocket Rule',
  sse: 'SSE Rule',
};

interface RuleEditorProps {
  /**
   * `'edit'` — bound to a persisted rule by `ruleUid`.
   * `'rule-create'` — unsaved draft tab; nothing is persisted until the
   * user clicks Save and picks a destination via SaveToCollectionModal.
   * Mirrors RequestEditor's create vs edit modes.
   */
  mode?: 'edit' | 'rule-create';
  ruleUid?: string;
  tabId?: string;
  /** Rule type for create mode (rules are immutable post-mint, so this
   *  is required when no `ruleUid` is supplied). */
  seedRuleType?: ExtensionRuleType;
  /** Display name pre-applied in create mode (drives breadcrumbs +
   *  the persisted name when Save lands). */
  seedDraftName?: string;
  /** Hands the form values to the SaveRuleFlow modal; required in
   *  create mode. */
  onSaveDraft?: (data: RuleDraftData) => void;
  /** Pinned destination from the create gesture (sidebar Add Rule
   *  inside a folder). When set, the inline {{collection.X}} resolver
   *  scope mirrors the destination collection. */
  preferredCollectionId?: string;
  preferredFolderPath?: string;
  /** Template to pre-apply on first mount (form-only overlay; commits
   *  with the rest of the form on Save). Honored only for unpublished
   *  rules — published rules ignore the prop. */
  initialTemplateKey?: string;
  /** Pre-filled rule draft supplied by an external caller (inspector
   *  panel "override this header" CTA, future import/paste flows).
   *  Same semantics as `initialTemplateKey` — first-mount form overlay
   *  on unpublished rules only. */
  initialDraft?: RuleDraft;
  /** Full-fidelity create-mode seed from "Duplicate Tab" — the source
   *  rule's content (conditions + per-type action) minus identity. The
   *  form is hydrated from it on first mount, then behaves like any
   *  other scratch draft. Honored in create mode only. */
  seedRuleContent?: Omit<Rule, 'uid' | 'path'>;
  onSaved?: (uid: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (saveFn: () => void) => void;
  registerSaveAsTemplateRef?: (fn: () => void) => void;
  /** Publishes a snapshot fn that projects the live form into content-
   *  only rule data (minus identity) — read by "Duplicate Tab" to seed
   *  a fresh scratch. Works in both edit and create modes. */
  registerDuplicateRef?: (fn: () => Omit<Rule, 'uid' | 'path'> | null) => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
  mode = 'edit',
  ruleUid,
  tabId: _tabId,
  seedRuleType,
  seedDraftName,
  onSaveDraft,
  preferredCollectionId,
  preferredFolderPath: _preferredFolderPath,
  initialTemplateKey,
  initialDraft,
  seedRuleContent,
  onSaved,
  onDirtyChange,
  registerSaveRef,
  registerSaveAsTemplateRef,
  registerDuplicateRef,
}) => {
  const isCreateMode = mode === 'rule-create';
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { openDocs } = useInspectorNav();
  const { rules, activeWorkspaceId, localCollections, templates: userTemplates, templateCollectionTrees } = useRules();
  const mutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const localInstanceId = useLocalInstanceId();
  const [form] = Form.useForm();
  const [_saving, setSaving] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  // ── Header state (lifted from HeaderRuleFields for reliable timing) ──
  // useWatch has inherent first-render timing issues — parent owns the truth.
  const [headerActiveTab, setHeaderActiveTab] = useState('request');
  const [headerReqCount, setHeaderReqCount] = useState(0);
  const [headerResCount, setHeaderResCount] = useState(0);
  // Once the user explicitly clicks Request/Response, their choice is
  // sticky — incoming live-update re-primes never override it. Without
  // this, a broadcast-driven re-prime (clean editor, peer commits an
  // unrelated mutation) would snap back to the auto-default tab.
  const userPickedHeaderTabRef = useRef(false);
  const handleHeaderTabChange = useCallback((tab: string) => {
    userPickedHeaderTabRef.current = true;
    setHeaderActiveTab(tab);
  }, []);
  const setDefaultHeaderTab = useCallback((reqLen: number, resLen: number) => {
    if (userPickedHeaderTabRef.current) return;
    setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
  }, []);

  // URL-derivation strategy for `initialDraft.url` → url-filter condition.
  // Read live so a user who changes the setting mid-session gets the new
  // behavior on next draft open.
  const draftUrlStrategy = useSettingValue('rulesEngine.draftUrlStrategy');

  /** Live rule from context — null in create mode (no entity yet) or
   *  when the rule has been tombstoned by another surface. */
  const liveRule = useMemo(() => (ruleUid ? rules.find((r) => r.uid === ruleUid) : undefined), [ruleUid, rules]);

  /** Whether the rule is published (live to DNR / runners). Create-mode
   *  drafts are always unpublished; in edit mode, Save flips
   *  `published: true`. */
  const isPublished = isCreateMode ? false : liveRule?.published === true;

  // Phase A A5 — deletion handling.
  //
  // When the live rule disappears (delete tombstone landed from another
  // surface), capture the last-known shape so the read-only "deleted
  // by …" view can render and the Undelete button can re-emit a
  // `create(...)` with a fresh id (§7.2 — re-creation MUST use a fresh
  // id; there's no HLC escape hatch). The open tab hands off to the
  // freshly-created rule via `onSaved(newUid)`.
  const lastSeenRuleRef = useRef<Rule | null>(null);
  useEffect(() => {
    if (liveRule) {
      lastSeenRuleRef.current = liveRule;
    }
  }, [liveRule]);
  const isDeletedRemotely = !liveRule && lastSeenRuleRef.current !== null;

  // Stale-draft tracking is gone — the sync engine replaces the
  // version-counter OCC with HLC-stamped per-field LWW + an
  // awareness ribbon. Saves
  // unconditionally apply; concurrent edits from another surface
  // arrive on the broadcast channel and reconcile per-field.

  /** Rule type is immutable for the lifetime of the entity. In create
   *  mode it comes from the seed prop (the picker that opened the
   *  draft tab pinned the type). */
  const selectedType = (liveRule?.type ?? seedRuleType) as ExtensionRuleType | undefined;

  /** Single source of truth for enabled state. New drafts default to
   *  enabled; the toggle only takes effect after Save mints the entity. */
  const isEnabled = liveRule?.enabled ?? true;

  /** Single source of truth for name. */
  const ruleName = liveRule?.name ?? seedDraftName ?? 'Rule';

  // ── Form fingerprint inputs to `useReprime` ──────────────────────
  // Dirty + auto-rebase + comparison shape are owned by the shell
  // hook; the editor only supplies the form's canonical-shape
  // projection plus a matching `signature` over the live entity.
  const formValues = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const formFingerprint = useMemo(
    () => (formValues ? stableStringify(buildRule(formValues, ruleName, isEnabled)) : ''),
    [formValues, ruleName, isEnabled],
  );
  const canonicalProjection = useCallback(
    (rule: Rule) =>
      stableStringify({
        name: rule.name,
        enabled: rule.enabled,
        conditions: rule.conditions,
        type: rule.type,
        action: (rule as { action?: unknown }).action ?? null,
      }),
    [],
  );

  // Refs threaded into `useReprime`'s `onPrimed` so the conflict
  // tracker (defined below — needs `isDirty` from reprime) can wire
  // its baseline setter without a forward declaration, and so the
  // first-mount overlay / template-apply runs once across the
  // populate + auto-rebase lifecycle.
  const setBaselineRef = useRef<(r: Rule) => void>(() => undefined);
  const overlayAppliedRef = useRef(false);
  // Snapshot of the rule the form was last seeded from. Drives the
  // per-field save merge: Save broadcasts only leaves that diverge from
  // baseline so a peer's concurrent commit on a different leaf survives.
  // Advances in lockstep with the conflict tracker baseline (both wired
  // through `onPrimed`).
  const baselineRuleRef = useRef<Rule | null>(null);

  // Populate the form from a persisted rule. `useReprime` calls this
  // on initial seed and broadcast catch-up; conflict-tracker baseline
  // advancement happens in `onPrimed`, not here.
  const populateFormFromRule = useCallback(
    (rule: Omit<Rule, 'uid' | 'path'>) => {
      const baseValues = {
        ruleType: rule.type,
        conditions: rule.conditions,
      };
      switch (rule.type) {
        case 'header': {
          const hr = rule as HeaderRule;
          const reqH = hr.action.requestHeaders ?? [];
          const resH = hr.action.responseHeaders ?? [];
          form.setFieldsValue({ ...baseValues, requestHeaders: reqH, responseHeaders: resH });
          setHeaderReqCount(reqH.length);
          setHeaderResCount(resH.length);
          setDefaultHeaderTab(reqH.length, resH.length);
          break;
        }
        case 'block':
          form.setFieldsValue(baseValues);
          break;
        case 'redirect': {
          const rr = rule as RedirectRule;
          form.setFieldsValue({ ...baseValues, redirectTo: rr.action.redirectTo });
          break;
        }
        case 'query-param': {
          const qr = rule as QueryParamRule;
          form.setFieldsValue({
            ...baseValues,
            queryParams: qr.action.params.map((p) => ({
              uid: p.uid,
              param: p.param,
              value: p.value ?? '',
              operation: p.operation,
            })),
          });
          break;
        }
        case 'inject': {
          const ir = rule as InjectRule;
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
          const dr = rule as DelayRule;
          form.setFieldsValue({ ...baseValues, delayMs: dr.action.delayMs });
          break;
        }
        case 'request-body': {
          const br = rule as RequestBodyRule;
          form.setFieldsValue({
            ...baseValues,
            requestBodyType: br.action.bodyType || 'static',
            requestStaticBody: br.action.bodyType === 'dynamic' ? '' : br.action.requestBody,
            requestDynamicBody: br.action.bodyType === 'dynamic' ? br.action.requestBody : '',
            requestResourceType: br.action.resourceType || 'rest',
            requestGraphqlKey: br.action.graphqlFilter?.key || '',
            requestGraphqlOperator: br.action.graphqlFilter?.operator || 'Equals',
            requestGraphqlValue: br.action.graphqlFilter?.value || '',
          });
          break;
        }
        case 'response': {
          const rr2 = rule as ResponseRule;
          form.setFieldsValue({
            ...baseValues,
            responseSource: rr2.action.responseSource || 'mock',
            responseStatusCode: rr2.action.statusCode || undefined,
            responseContentType: rr2.action.contentType,
            responseStaticBody: rr2.action.bodyType === 'dynamic' ? '' : rr2.action.responseBody,
            responseDynamicBody: rr2.action.bodyType === 'dynamic' ? rr2.action.responseBody : '',
            responseBodyType: rr2.action.bodyType || 'static',
            responseResourceType: rr2.action.resourceType || 'rest',
            responseGraphqlKey: rr2.action.graphqlFilter?.key || '',
            responseGraphqlOperator: rr2.action.graphqlFilter?.operator || 'Equals',
            responseGraphqlValue: rr2.action.graphqlFilter?.value || '',
            responseHeaderRows: Object.entries(rr2.action.responseHeaders ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
          });
          break;
        }
        case 'ws': {
          const wr = rule as WsRule;
          form.setFieldsValue({
            ...baseValues,
            wsOperation: wr.action.operation,
            wsDirection: wr.action.direction,
            wsFilterType: wr.action.messageFilter?.matchType ?? 'none',
            wsFilterValue: wr.action.messageFilter?.value ?? '',
            wsPayload: wr.action.payload ?? '',
            wsInjectTrigger: wr.action.injectTrigger ?? 'open',
          });
          break;
        }
        case 'sse': {
          const sr = rule as SseRule;
          form.setFieldsValue({
            ...baseValues,
            sseOperation: sr.action.operation,
            sseEventName: sr.action.eventName ?? '',
            sseFilterType: sr.action.messageFilter?.matchType ?? 'none',
            sseFilterValue: sr.action.messageFilter?.value ?? '',
            ssePayload: sr.action.payload ?? '',
            sseInjectTrigger: sr.action.injectTrigger ?? 'open',
          });
          break;
        }
        case 'auth': {
          const ar = rule as AuthRule;
          form.setFieldsValue({
            ...baseValues,
            authUsername: ar.action.username,
            authPassword: ar.action.password,
          });
          break;
        }
      }
    },
    [form, setDefaultHeaderTab],
  );

  // Reprime owns dirty derivation, comparison shape (BC1), populate
  // gating, and auto-rebase. `onPrimed` runs after every populate /
  // auto-rebase: advances the conflict tracker baseline (via ref so
  // the tracker, defined below, can wire its setter without a forward
  // reference), and on the first invocation applies the inspector-CTA
  // `initialDraft` overlay or `initialTemplateKey` template.
  const reprime = useReprime<Rule>({
    liveEntity: liveRule,
    scope: { entityType: RULE_ENTITY_TYPE, entityId: ruleUid ?? '' },
    enabled: !isCreateMode && liveRule != null,
    formFingerprint,
    signature: canonicalProjection,
    populate: populateFormFromRule,
    onPrimed: (rule) => {
      setBaselineRef.current(rule);
      baselineRuleRef.current = rule;
      if (overlayAppliedRef.current) return;
      overlayAppliedRef.current = true;

      if (initialTemplateKey) {
        applyTemplate(initialTemplateKey);
        return;
      }

      if (rule.published === true || !initialDraft || initialDraft.type !== rule.type) return;

      const overlay: Record<string, unknown> = {};
      const conditions = buildDraftConditions(initialDraft, draftUrlStrategy);
      if (conditions.length > 0) overlay.conditions = conditions;

      if (initialDraft.type === 'header') {
        // Preserve the draft's direction intent: if the draft targets
        // only response headers, leave requestHeaders empty so the
        // editor's "jump to response tab" heuristic fires.
        const targetsResponse = !!initialDraft.responseHeaders?.length;
        const targetsRequest = !!initialDraft.requestHeaders?.length;
        if (initialDraft.requestHeaders) overlay.requestHeaders = buildDraftHeaders(initialDraft.requestHeaders);
        else if (targetsResponse) overlay.requestHeaders = [];
        if (initialDraft.responseHeaders) overlay.responseHeaders = buildDraftHeaders(initialDraft.responseHeaders);
        else if (targetsRequest) overlay.responseHeaders = [];
      } else if (initialDraft.type === 'redirect') {
        if (initialDraft.redirectTo) overlay.redirectTo = initialDraft.redirectTo;
      } else if (initialDraft.type === 'response') {
        applyResponseDraftOverlay(overlay, initialDraft);
      } else if (initialDraft.type === 'request-body') {
        applyRequestBodyDraftOverlay(overlay, initialDraft);
      } else if (initialDraft.type === 'query-param') {
        applyQueryParamDraftOverlay(overlay, initialDraft);
      }

      if (Object.keys(overlay).length > 0) {
        form.setFieldsValue(overlay);
        if (rule.type === 'header') {
          const reqLen = Array.isArray(overlay.requestHeaders)
            ? (overlay.requestHeaders as unknown[]).length
            : ((rule as HeaderRule).action.requestHeaders?.length ?? 0);
          const resLen = Array.isArray(overlay.responseHeaders)
            ? (overlay.responseHeaders as unknown[]).length
            : ((rule as HeaderRule).action.responseHeaders?.length ?? 0);
          setHeaderReqCount(reqLen);
          setHeaderResCount(resLen);
          setDefaultHeaderTab(reqLen, resLen);
        }
      }
    },
  });
  // Create mode: the editor is dirty from the moment it opens — there's
  // no canonical entity to compare against. Edit mode: derive dirty from
  // form-vs-canonical equality (BC1 by construction in `useReprime`).
  const isDirty = isCreateMode ? true : reprime.isDirty;

  const conflicts = useRuleConflicts({
    liveRule: liveRule ?? null,
    isDirty,
    enabled: !isCreateMode,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const conflictBridge = useMemo(
    () => ({
      getConflict: conflicts.getConflict,
      getSetConflict: conflicts.getSetConflict,
      onAcceptTheirs: conflicts.acceptTheirs,
      onDismissConflict: conflicts.dismiss,
    }),
    [conflicts.getConflict, conflicts.getSetConflict, conflicts.acceptTheirs, conflicts.dismiss],
  );

  // Field-tree conflicts API exposed to per-type rule-fields/* via
  // context. `<ScalarConflictChip>` + `<FieldConflictChip>` +
  // `<SetRowChip>` all subscribe through the provider so the per-type
  // editors stop prop-drilling the conflict bridge through every leaf.
  const fieldConflictsApi = useMemo<FieldConflictsApi>(
    () => ({
      getConflict: conflicts.getConflict,
      getSetConflict: conflicts.getSetConflict,
      acceptTheirs: conflicts.acceptTheirs,
      dismiss: conflicts.dismiss,
    }),
    [conflicts.getConflict, conflicts.getSetConflict, conflicts.acceptTheirs, conflicts.dismiss],
  );

  // Entity-level conflict aggregation. The banner + diff dialog read
  // through the same `getAllConflicts` projection — same source of
  // truth as the per-field chips, so any resolution path keeps all
  // three surfaces in sync.
  const formProjection = useMemo(() => {
    if (!formValues) return null;
    const built = buildRule(formValues, ruleName, isEnabled);
    if (!built || !liveRule) return null;
    // `extractBaseline` keys by `uid` and reads from a full Rule
    // shape — splice the live rule's uid + path onto the built form
    // projection so the path-keyed projection lines up with baseline.
    return conflicts.projectRule({ ...built, uid: liveRule.uid, path: liveRule.path } as Rule);
  }, [formValues, ruleName, isEnabled, liveRule, conflicts]);

  // Form-side ordered uid arrays per set-modeled path. The conflict
  // tracker uses these for `set-reorder` detection — order is lost
  // when the form gets projected to a path map.
  const formSetOrders = useMemo(() => {
    const out = new Map<string, string[]>();
    if (!formValues) return out;
    const collect = (key: string, setPath: string) => {
      const arr = formValues[key] as Array<{ uid?: string }> | undefined;
      if (!Array.isArray(arr)) return;
      const order = arr.map((r) => r?.uid).filter((u): u is string => typeof u === 'string');
      if (order.length > 0) out.set(setPath, order);
    };
    collect('requestHeaders', 'action.requestHeaders');
    collect('responseHeaders', 'action.responseHeaders');
    collect('params', 'action.params');
    collect('queryParams', 'action.params');
    collect('conditions', 'conditions');
    return out;
  }, [formValues]);

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection, formSetOrders) : new Map<string, PathConflict>()),
    [formProjection, formSetOrders, conflicts],
  );

  // Dialog-only conflicts (no inline anchor: set-reorder, set-add,
  // union-swap) need the banner to stay visible even at count 1 so
  // the user can open the dialog. Set-remove + leaf both have inline
  // chips and let the banner hide at count 1.
  const dialogOnlyConflict = useMemo(() => hasDialogOnlyConflict(allConflicts), [allConflicts]);

  // Per-leaf auto-rebase via the shared `useAutoMergeForm` — when a peer
  // commits to a leaf the user hasn't touched in this tab, silently catch
  // the form up even when other leaves are dirty. Whole-form reprime gates
  // on every leaf clean and stops working the moment one leaf is dirty;
  // this complements it for the partial-dirty case (§6.2 killer demo).
  // Real conflicts (same leaf edited in both tabs) are filtered out by
  // `getAutoMergeable`'s form !== baseline guard and continue surfacing as
  // chips.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!liveRule) return;
      applyResolutionToForm(form, liveRule, path, { base: '', theirs });
    },
    [form, liveRule],
  );
  // Silent reorder rebase: peer reordered a uid-keyed set whose order
  // I haven't touched. uids carry per-row identity through the move,
  // so my in-flight per-leaf edits on rows that just shifted keep their
  // values + Form.List `field.key` keeps the DOM (and the cursor) in
  // place. Falls back to the dialog's `set-reorder` row when my form
  // ALSO diverged from baseline — only the untouched-side case auto-
  // applies.
  const applyAutoMergeReorder = useCallback(
    (setPath: string, savedOrder: readonly string[]) => {
      const formName =
        setPath === 'action.requestHeaders'
          ? 'requestHeaders'
          : setPath === 'action.responseHeaders'
            ? 'responseHeaders'
            : setPath === 'action.params'
              ? 'queryParams'
              : setPath === 'conditions'
                ? 'conditions'
                : null;
      if (!formName) return;
      const current = (form.getFieldValue(formName) as { uid?: string }[] | undefined) ?? [];
      if (current.length === 0) return;
      const byUid = new Map<string, { uid?: string }>();
      for (const row of current) if (row?.uid) byUid.set(row.uid, row);
      const next: { uid?: string }[] = [];
      for (const uid of savedOrder) {
        const row = byUid.get(uid);
        if (row) {
          next.push(row);
          byUid.delete(uid);
        }
      }
      // Locally-added rows (not in saved order) keep their relative
      // order and append to the tail — same convention as the manual
      // "Use saved order" path.
      for (const row of current) if (row?.uid && byUid.has(row.uid)) next.push(row);
      form.setFieldValue(formName, next);
    },
    [form],
  );
  useAutoMergeForm({
    conflicts,
    formProjection,
    formSetOrders,
    applyToForm: applyAutoMerge,
    applyToFormReorder: applyAutoMergeReorder,
  });

  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) {
      conflicts.dismiss(path);
    }
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!liveRule) return;
    for (const [path, conflict] of allConflicts) {
      applyResolutionToForm(form, liveRule, path, conflict);
      conflicts.acceptTheirs(path, conflict.theirs);
    }
  }, [allConflicts, conflicts, form, liveRule]);

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      if (!liveRule) return;
      for (const [path, choice] of resolutions) {
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        if (choice === 'theirs') {
          applyResolutionToForm(form, liveRule, path, conflict);
          conflicts.acceptTheirs(path, conflict.theirs);
        } else {
          conflicts.dismiss(path);
        }
      }
    },
    [allConflicts, conflicts, form, liveRule],
  );

  // Phase 6 commit seam for the merge-editor surface. The user has
  // edited the result text directly; parse it back to a Rule, populate
  // the form, and dismiss every conflict path so chips disappear. The
  // next Save broadcasts diverged leaves; reprime then rebases the
  // tracker baseline cleanly. Throws on parse failure — the merge
  // modal renders the error inline and stays open.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!liveRule) return;
      const parsed = parseRule(text, { path: liveRule.path });
      populateFormFromRule(parsed.value);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [liveRule, populateFormFromRule, allConflicts, conflicts],
  );

  // Diff dialog payloads. Saved (left pane) is the canonical rule
  // serialized via the YAML codec — same shape teammates see in `git
  // diff` / PR review (Phase D forward). Local (right pane) is built
  // from the form values with the user's pending per-row picks applied,
  // so the diff updates as soon as the user clicks "Use saved" /
  // "Keep mine" — same model IDE merge tools use.
  const savedYaml = useMemo(() => {
    if (!isConflictDialogOpen || !liveRule) return '';
    try {
      return serializeRule(freshDocument(canonicalizeRule(liveRule)));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRule]);

  // Baseline YAML feeds the merge-editor preview's Show Base layouts.
  // Computed at dialog-open from the per-tab baseline rule so the
  // common ancestor is the rule as it was when the form last seeded
  // (matches the conflict tracker's baseline notion).
  const baseYaml = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineRuleRef.current;
    if (!baseline) return undefined;
    try {
      return serializeRule(freshDocument(canonicalizeRule(baseline)));
    } catch {
      return undefined;
    }
    // baselineRuleRef is a ref; deliberately stale-on-purpose so the
    // value is captured when the dialog opens and stays stable while
    // it is open.
  }, [isConflictDialogOpen]);

  // Local projection serialized for the merge editor's mine pane.
  // Splices entity-managed metadata (schemaVersion, published) from
  // the live rule — `buildRule` only knows form-owned fields.
  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !liveRule || !formValues) return '';
    const localBuilt = buildRule(formValues, ruleName, isEnabled);
    if (!localBuilt) return '';
    const localRule = {
      ...localBuilt,
      uid: liveRule.uid,
      path: liveRule.path,
      schemaVersion: liveRule.schemaVersion,
      published: liveRule.published,
    } as Rule;
    try {
      return serializeRule(freshDocument(canonicalizeRule(localRule)));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRule, formValues, ruleName, isEnabled]);

  const conflictPathLabels = useMemo(
    () => (liveRule ? prettyRulePathMap(liveRule, allConflicts.keys()) : new Map<string, string>()),
    [liveRule, allConflicts],
  );

  const handleToggleEnabled = useCallback(() => {
    if (!ruleUid) return;
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
        setDefaultHeaderTab(reqLen, resLen);
      };

      if (key === 'empty') {
        form.setFieldsValue({ ruleType: type, conditions: [] });
        updateHeaderState({});
        return;
      }

      const builtins = TEMPLATES_BY_TYPE[type] ?? [];
      const builtin = builtins.find((t) => t.key === key);
      if (builtin) {
        form.setFieldsValue({ ruleType: type, conditions: builtin.conditions, ...builtin.formValues });
        updateHeaderState(builtin.formValues);
      } else {
        // User templates (key is the uid)
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
    },
    [selectedType, form, userTemplates, setDefaultHeaderTab],
  );

  // Create-mode bootstrap. `useReprime` stays disabled (no liveRule),
  // so its `onPrimed` overlay path never fires — instead we seed the
  // form here from `seedRuleType` and run the same template / draft
  // overlay logic that edit mode runs in `onPrimed`. Gated by
  // `overlayAppliedRef` so subsequent renders don't re-stomp the form.
  useEffect(() => {
    if (!isCreateMode || overlayAppliedRef.current) return;
    overlayAppliedRef.current = true;
    const type = (seedRuleType ?? 'header') as ExtensionRuleType;
    form.setFieldsValue({ ruleType: type, conditions: [] });

    // "Duplicate Tab" seed wins over template / inspector-draft overlays
    // — it carries the full source rule, so we replay its whole shape
    // through the same populate path edit mode uses.
    if (seedRuleContent) {
      populateFormFromRule(seedRuleContent);
      return;
    }

    if (initialTemplateKey) {
      applyTemplate(initialTemplateKey);
      return;
    }

    if (!initialDraft || initialDraft.type !== type) return;

    const overlay: Record<string, unknown> = {};
    const conditions = buildDraftConditions(initialDraft, draftUrlStrategy);
    if (conditions.length > 0) overlay.conditions = conditions;

    if (initialDraft.type === 'header') {
      const targetsResponse = !!initialDraft.responseHeaders?.length;
      const targetsRequest = !!initialDraft.requestHeaders?.length;
      if (initialDraft.requestHeaders) overlay.requestHeaders = buildDraftHeaders(initialDraft.requestHeaders);
      else if (targetsResponse) overlay.requestHeaders = [];
      if (initialDraft.responseHeaders) overlay.responseHeaders = buildDraftHeaders(initialDraft.responseHeaders);
      else if (targetsRequest) overlay.responseHeaders = [];
    } else if (initialDraft.type === 'redirect') {
      if (initialDraft.redirectTo) overlay.redirectTo = initialDraft.redirectTo;
    } else if (initialDraft.type === 'response') {
      applyResponseDraftOverlay(overlay, initialDraft);
    } else if (initialDraft.type === 'request-body') {
      applyRequestBodyDraftOverlay(overlay, initialDraft);
    } else if (initialDraft.type === 'query-param') {
      applyQueryParamDraftOverlay(overlay, initialDraft);
    }

    if (Object.keys(overlay).length > 0) {
      form.setFieldsValue(overlay);
      if (type === 'header') {
        const reqLen = Array.isArray(overlay.requestHeaders) ? (overlay.requestHeaders as unknown[]).length : 0;
        const resLen = Array.isArray(overlay.responseHeaders) ? (overlay.responseHeaders as unknown[]).length : 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setDefaultHeaderTab(reqLen, resLen);
      }
    }
  }, [
    isCreateMode,
    seedRuleType,
    seedRuleContent,
    initialTemplateKey,
    initialDraft,
    draftUrlStrategy,
    form,
    applyTemplate,
    populateFormFromRule,
    setDefaultHeaderTab,
  ]);

  // ── Duplicate snapshot ─────────────────────────────────────────
  // Publish a fn that projects the LIVE form (incl. uncommitted edits)
  // into content-only rule data so "Duplicate Tab" can seed a fresh
  // scratch. name/enabled ride refs so the published closure stays
  // stable while always reading current values.
  const ruleNameRef = useRef(ruleName);
  ruleNameRef.current = ruleName;
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;
  useEffect(() => {
    registerDuplicateRef?.(() => buildRule(form.getFieldsValue(), ruleNameRef.current, isEnabledRef.current));
  }, [registerDuplicateRef, form]);

  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      // Sync header badge counts from live form state during editing.
      // Dirty derivation lives below — driven by `Form.useWatch` against
      // the canonical `liveRule`, so revert / take-theirs auto-clear
      // dirty without any imperative bookkeeping here.
      const reqH = form.getFieldValue('requestHeaders') as unknown[] | undefined;
      const resH = form.getFieldValue('responseHeaders') as unknown[] | undefined;
      setHeaderReqCount(reqH?.length ?? 0);
      setHeaderResCount(resH?.length ?? 0);

      // Prefill the dynamic code template the first time the user flips
      // Body/Mock to Dynamic mode. Lives here — not inside the field
      // components — so the child rule-field components stay pure-render
      // and don't need a parallel Form.useWatch subscription for side
      // effects. `changedValues` tells us exactly which Radio just flipped.
      if (changedValues.requestBodyType === 'dynamic') {
        const dyn = form.getFieldValue('requestDynamicBody') as string | undefined;
        if (!dyn?.trim()) form.setFieldValue('requestDynamicBody', REQUEST_BODY_DYNAMIC_TEMPLATE);
      }
      // Response rules carry two dynamic contracts: mock source builds a
      // synthetic body via buildResponse(), network source transforms the
      // real reply via modifyResponse(). Prefill the matching starter when
      // the user flips to Dynamic, and swap it when they flip source — but
      // only while the buffer is still the untouched opposite starter so a
      // hand-written function is never clobbered.
      if (changedValues.responseBodyType === 'dynamic' || 'responseSource' in changedValues) {
        if (form.getFieldValue('responseBodyType') === 'dynamic') {
          const isNetwork = form.getFieldValue('responseSource') === 'network';
          const desired = isNetwork ? RESPONSE_MODIFY_TEMPLATE : RESPONSE_BUILD_TEMPLATE;
          const other = isNetwork ? RESPONSE_BUILD_TEMPLATE : RESPONSE_MODIFY_TEMPLATE;
          const cur = (form.getFieldValue('responseDynamicBody') as string | undefined) ?? '';
          if (!cur.trim() || cur === other) form.setFieldValue('responseDynamicBody', desired);
        }
      }
      if ('injectType' in changedValues) {
        maybePrefillInjectCode(form, changedValues.injectType);
      }
    },
    [form],
  );

  // `buildRule` is a pure helper in the sibling `build-rule` module.
  // Closures over `ruleName` / `isEnabled` are explicit function
  // arguments — keeps it usable BOTH as the save-time projection AND
  // the dirty-derivation projection without React hook-order
  // constraints.

  const handleSubmit = useCallback(async () => {
    // Create mode: hand the form values to the SaveRuleFlow modal,
    // which fast-paths to a preferred destination or asks the user
    // to pick one. The modal's confirm path mints the entity and
    // replaces this draft tab with an `edit` tab pointed at the
    // newly-minted uid.
    if (isCreateMode) {
      const values = form.getFieldsValue();
      const built = buildRule(values, ruleName, isEnabled);
      if (!built) {
        message.error('Unknown rule type');
        return;
      }
      onSaveDraft?.(built as RuleDraftData);
      return;
    }
    if (!liveRule || !ruleUid) return;
    // Publication-gate short-circuit. Mirrors `EditorHeader`'s Save
    // disabled state: published rule + no uncommitted edits = nothing
    // to do. Without this, Cmd+S keeps firing redundant publish
    // batches even though the visible Save button is greyed out.
    if (liveRule.published === true && !isDirty) return;
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
      } else if (ruleType === 'response') {
        if (pre.responseBodyType === 'dynamic') {
          targets.push({ field: 'responseDynamicBody', language: 'javascript' });
        } else {
          targets.push({ field: 'responseStaticBody', language: 'json' });
        }
      } else if (ruleType === 'request-body') {
        if (pre.requestBodyType === 'dynamic') {
          targets.push({ field: 'requestDynamicBody', language: 'javascript' });
        } else {
          targets.push({ field: 'requestStaticBody', language: 'json' });
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
      const rule = buildRule(values, ruleName, isEnabled);
      if (!rule) {
        message.error('Unknown rule type');
        return;
      }
      // Save = the only broadcast point (rules intercept live HTTP traffic;
      // per-keystroke streaming would leak half-typed values into the
      // network path). Rebase the form against the latest canonical at
      // field granularity so the batch carries only leaves the user
      // actually edited — without this, untouched leaves travel as setField
      // writes and silently overwrite a peer's concurrent edit on the same
      // leaf via per-itemId / per-leaf LWW.
      const merged = mergeRuleForSave(rule, baselineRuleRef.current, liveRule);
      // Two batches: the content commit fires DNR rebuild via the per-mutator
      // side effects (header/redirect/etc. mutators emit recompile intents
      // when their fields change); the publish call adds an explicit
      // recompile + the `published` field flip.
      const updates = merged as Partial<Omit<Rule, 'uid' | 'path' | 'schemaVersion'>>;
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
      // Dirty derives from form vs canonical equality; once the
      // commit broadcast lands and the mirror updates `liveRule` to
      // match the form's values, the next render reports dirty=false
      // automatically. No explicit reset needed.
      conflicts.clearDismissed();
      onSaved?.(ruleUid);
    } finally {
      setSaving(false);
    }
  }, [
    form,
    isCreateMode,
    liveRule,
    ruleUid,
    ruleName,
    isEnabled,
    activeWorkspaceId,
    isDirty,
    isPublished,
    message,
    mutator,
    onSaveDraft,
    onSaved,
    conflicts,
  ]);

  const handleSaveSync = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const shell = useEditorShell({
    entityType: RULE_ENTITY_TYPE,
    entityId: ruleUid ?? null,
    isDirty,
    isPublished,
    isComplete: liveRule ? isRuleComplete(liveRule) : undefined,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

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
    onSaved?.(created.rule.uid);
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
    (nodes: TreeNode[], ruleType: string): NonNullable<MenuProps['items']> => {
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
    if (liveRule) {
      const match = localCollections.find((c) => liveRule.path.startsWith(`${c.path}/`));
      return match?.uid;
    }
    return preferredCollectionId;
  }, [liveRule, localCollections, preferredCollectionId]);

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
        shell={shell.headerProps}
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
        <EntityScopeProvider shell={shell.scopeProps}>
          <ActionPathsProvider value={RULE_ACTION_PATHS}>
            <div
              className="rules-rule-editor"
              style={isDeletedRemotely ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
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

                  <EntityConflictBanner
                    count={allConflicts.size}
                    forceVisible={dialogOnlyConflict}
                    onReview={() => setConflictDialogOpen(true)}
                    onKeepAllMine={handleKeepAllMine}
                    onUseAllSaved={handleUseAllSaved}
                  />

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
                        <Dropdown
                          menu={{ items: userMenuItems }}
                          trigger={['click']}
                          disabled={userMenuItems.length === 0}
                        >
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
                  <ConflictsProvider api={fieldConflictsApi}>
                    <div className="rules-rule-editor-columns">
                      {/* ── Per-type fields ── */}
                      <div>
                        {selectedType === 'header' && (
                          <HeaderRuleFields
                            activeTab={headerActiveTab}
                            onTabChange={handleHeaderTabChange}
                            reqCount={headerReqCount}
                            resCount={headerResCount}
                            ruleUid={ruleUid}
                            excludeInstanceId={localInstanceId}
                          />
                        )}
                        {selectedType === 'block' && <BlockRuleFields />}
                        {selectedType === 'redirect' && <RedirectRuleFields />}
                        {selectedType === 'query-param' && <QueryParamRuleFields ruleUid={ruleUid} />}
                        {selectedType === 'inject' && <InjectRuleFields />}
                        {selectedType === 'delay' && <DelayRuleFields />}
                        {selectedType === 'request-body' && <RequestBodyRuleFields />}
                        {selectedType === 'response' && <ResponseRuleFields />}
                        {selectedType === 'ws' && <WsRuleFields />}
                        {selectedType === 'sse' && <SseRuleFields />}
                        {selectedType === 'auth' && <AuthRuleFields />}
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
                          Each row targets one DNR field, so rows combine with <strong>AND</strong> — every row must
                          match. To match any of several values, list them inside one row (the <strong>OR</strong> badge
                          marks rows that accept multiple values; <strong>1 value</strong> rows take a single scalar).
                          Add at least one condition.
                        </div>
                        <Form.Item name="conditions" style={{ marginBottom: 0 }}>
                          <ConditionEditor />
                        </Form.Item>
                      </div>
                    </div>
                  </ConflictsProvider>
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
          </ActionPathsProvider>
        </EntityScopeProvider>
      </div>
    </div>
  );
};

export default RuleEditor;
