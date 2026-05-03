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
import { useRuleMutator } from '@hooks/useRuleMutator';
import { useRules } from '@hooks/useRules';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
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
} from '@/shared/awareness';
import { useEditorDirty } from '@/shared/awareness/use-editor-dirty';
import { stableStringify, useEntityReprime } from '@/shared/forms';
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
import HeaderRuleFields from './rule-fields/HeaderRuleFields';
import InjectRuleFields, { maybePrefillInjectCode } from './rule-fields/InjectRuleFields';
import MockRuleFields, { MOCK_DYNAMIC_TEMPLATE } from './rule-fields/MockRuleFields';
import QueryParamRuleFields from './rule-fields/QueryParamRuleFields';
import RedirectRuleFields from './rule-fields/RedirectRuleFields';
import { serializeRule } from '@openheaders/core/codec/yaml';
import { freshDocument } from '@openheaders/core/schemas';
import { applyResolutionToForm, applyResolutionToRule } from './rule-fields/rule-form-resolver';
import { prettyRulePathMap } from './rule-fields/pretty-path';
import { useRuleConflicts } from './rule-fields/use-rule-conflicts';
import type { PathConflict } from './rule-fields/use-rule-conflicts';
import { EntityConflictBanner, EntityConflictDialog } from '@/shared/conflicts';
import type { ConflictResolution } from '@/shared/conflicts';
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
  const localInstanceId = useLocalInstanceId();
  const [form] = Form.useForm();
  const [_saving, setSaving] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const initializedRef = useRef(false);
  // Reactive mirror of `initializedRef` for `useEntityReprime`'s
  // `enabled` gate. `useRef` reads don't trigger renders so the hook
  // would otherwise have no way to react to "init just completed".
  // Set once, alongside the ref, by the init effect below.
  const [isInitialized, setIsInitialized] = useState(false);
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

  // Awareness — RuleEditor contributes ONLY its dirty marker via the
  // workspace-level `ActiveEditorDirty` context. The single
  // `<SurfaceAwarenessPublisher>` mounted near the surface root is the
  // sole `useAwareness` caller; it composes `entityFocus` from
  // `ActiveTabEntity`, `fieldFocus` from `ActiveFieldFocus`, and the
  // `dirtyFields` claim from `ActiveEditorDirty`. No per-editor
  // awareness slot — no MRT-pick race against the workspace publisher.
  // ── Derived dirty (see `shared/forms/index.ts` convention) ──────────
  //
  // Dirty is a structural projection of "form has untouched edits
  // diverging from the synced baseline" — never an event log. Two
  // distinct fingerprints, both refreshed reactively:
  //
  //   formFingerprint         — the form's canonical-shape projection,
  //                             updates on every keystroke / setFieldsValue
  //   liveRuleFingerprint     — the mirror's canonical right now,
  //                             updates on every broadcast
  //   lastPrimedFingerprint   — the canonical the form was LAST synced
  //                             from. Initial-set on init; bumped only
  //                             at known-clean moments
  //
  // `isDirty = formFingerprint !== lastPrimedFingerprint`. Comparing
  // against `lastPrimedFingerprint` (NOT `liveRuleFingerprint`) is
  // load-bearing — when an external broadcast lands while the user is
  // clean, the form is briefly "stale-clean" (matches the previous
  // canonical, not the new one). Comparing to live would falsely flag
  // dirty, which would gate `useEntityReprime` and prevent the catch-up.
  // The reprime hook reads `isDirty` to decide "is it safe to overwrite
  // the form?"; only "user has actually touched it" gates that.
  //
  // Auto-rebase effect snaps `lastPrimedFingerprint` to the current
  // canonical the moment `formFingerprint === liveRuleFingerprint`.
  // That single line covers all the convergence paths uniformly:
  //
  //   - Manual revert ("01" → "02" → "01"): formFp re-aligns with
  //     canonical → snap → dirty clears.
  //   - Take Theirs (writes canonical theirs into the form): formFp
  //     matches the just-arrived canonical → snap → dirty clears.
  //   - Save commit: broadcast lands carrying the values we just
  //     submitted; formFp == new canonical → snap → dirty clears.
  //   - Drag-and-drop reorder back to canonical order: same path.
  //
  // `populateAndBaseline` updates `lastPrimedFingerprint` explicitly
  // alongside `populateFormFromRule` so init / re-prime don't have to
  // wait for the auto-rebase effect's next render — keeps `isDirty`
  // false from the very first form-rendered tick.
  const formValues = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const formFingerprint = useMemo(
    () => (formValues ? stableStringify(buildRule(formValues, ruleName, isEnabled)) : null),
    [formValues, ruleName, isEnabled],
  );
  const canonicalProjection = useCallback(
    (rule: V5.Rule) =>
      stableStringify({
        name: rule.name,
        enabled: rule.enabled,
        conditions: rule.conditions,
        type: rule.type,
        action: (rule as { action?: unknown }).action ?? null,
      }),
    [],
  );
  const liveRuleFingerprint = useMemo(
    () => (liveRule ? canonicalProjection(liveRule) : null),
    [liveRule, canonicalProjection],
  );
  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty =
    isInitialized &&
    formFingerprint !== null &&
    lastPrimedFingerprint !== null &&
    formFingerprint !== lastPrimedFingerprint;

  // `onDirtyChange` callback — fire only on transitions, not on every
  // render of the same value. App.tsx maintains a per-tab dirty map.
  const lastReportedDirtyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastReportedDirtyRef.current === isDirty) return;
    lastReportedDirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEditorDirty({ entityType: RULE_ENTITY_TYPE, entityId: ruleUid }, isDirty);

  const conflicts = useRuleConflicts({
    liveRule: liveRule ?? null,
    isDirty,
    enabled: true,
  });
  // `setConflictBaseline` is the stable `useCallback([])` setter from
  // the conflict tracker — destructured once so multiple effects can
  // call it without depending on `conflicts` (whose object identity
  // changes when its internal state updates).
  const setConflictBaseline = conflicts.setBaseline;

  // Auto-rebase: as soon as the form converges with the current
  // canonical (manual revert / take-theirs / save echo), snap BOTH
  // the dirty-baseline (`lastPrimedFingerprint`) AND the conflict
  // tracker's per-path baseline. Both signals represent "the form is
  // in sync with canonical right now" — keeping them on the same
  // trigger prevents a stale conflict baseline from surfacing a
  // false "External change available" chip when the user, several
  // edits later, types a value that doesn't match the original
  // never-rebased baseline.
  useEffect(() => {
    if (formFingerprint === null || liveRuleFingerprint === null) return;
    if (formFingerprint !== liveRuleFingerprint) return;
    if (lastPrimedFingerprint === liveRuleFingerprint) return;
    setLastPrimedFingerprint(liveRuleFingerprint);
    if (liveRule) setConflictBaseline(liveRule);
  }, [formFingerprint, liveRuleFingerprint, lastPrimedFingerprint, liveRule, setConflictBaseline]);

  const conflictBridge = useMemo(
    () => ({
      getConflict: conflicts.getConflict,
      getSetConflict: conflicts.getSetConflict,
      onAcceptTheirs: conflicts.acceptTheirs,
      onDismissConflict: conflicts.dismiss,
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
    // `extractBaseline` keys by `uid` and reads from a full V5.Rule
    // shape — splice the live rule's uid + path onto the built form
    // projection so the path-keyed projection lines up with baseline.
    return conflicts.projectRule({ ...built, uid: liveRule.uid, path: liveRule.path } as V5.Rule);
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
    () =>
      formProjection
        ? conflicts.getAllConflicts(formProjection, formSetOrders)
        : new Map<string, PathConflict>(),
    [formProjection, formSetOrders, conflicts],
  );

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

  // Diff dialog payloads. Saved (left pane) is the canonical rule
  // serialized via the YAML codec — same shape teammates see in `git
  // diff` / PR review (Phase D forward). Local (right pane) is built
  // from the form values with the user's pending per-row picks applied,
  // so the diff updates as soon as the user clicks "Use saved" /
  // "Keep mine" — same model IDE merge tools use.
  const savedYaml = useMemo(() => {
    if (!isConflictDialogOpen || !liveRule) return '';
    try {
      return serializeRule(freshDocument(liveRule));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRule]);

  const buildLocalText = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): string => {
      if (!liveRule || !formValues) return '';
      const localBuilt = buildRule(formValues, ruleName, isEnabled);
      if (!localBuilt) return '';
      // Deep-clone before mutating so the caller's form / live data
      // doesn't drift via shared sub-objects (action arrays especially).
      // Splice entity-managed metadata (schemaVersion, published) from
      // the live rule onto the projection — `buildRule` only knows the
      // form-owned fields, so without this the diff would falsely
      // remove `schemaVersion`/`published` lines on the local side.
      const localRule = JSON.parse(
        JSON.stringify({
          ...localBuilt,
          uid: liveRule.uid,
          path: liveRule.path,
          schemaVersion: liveRule.schemaVersion,
          published: liveRule.published,
        }),
      ) as V5.Rule;
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        applyResolutionToRule(localRule, path, conflict);
      }
      try {
        return serializeRule(freshDocument(localRule));
      } catch {
        return '';
      }
    },
    [liveRule, formValues, ruleName, isEnabled, allConflicts],
  );

  const conflictPathLabels = useMemo(
    () => (liveRule ? prettyRulePathMap(liveRule, allConflicts.keys()) : new Map<string, string>()),
    [liveRule, allConflicts],
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
        setDefaultHeaderTab(reqLen, resLen);
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

      // Dirty derives from form vs canonical equality; setting form
      // values via the template above causes the next render to compute
      // a divergent fingerprint and report dirty automatically.
    },
    [selectedType, form, userTemplates],
  );

  // ── Form initialization (content fields only — no name/enabled) ──

  // Populate form from a persisted rule. Pulled out of the init effect
  // so the live-update path (Phase A A4 — re-prime form on external
  // mutation while the editor is clean) can reuse the same shape.
  //
  // `setConflictBaseline` (destructured above near useRuleConflicts) is
  // the stable `useCallback(_, [])` setter; depending on the whole
  // `conflicts` memo would loop: setBaseline calls `setDismissed(new Set())`
  // which triggers `getConflict` to rebuild → `conflicts` rebuilds →
  // `populateFormFromRule` rebuilds → re-prime effect re-fires →
  // setBaseline → loop. Stable identity breaks the cycle at the source.
  const populateFormFromRule = useCallback(
    (rule: V5.Rule) => {
      const baseValues = {
        ruleType: rule.type,
        conditions: rule.conditions,
      };
      setConflictBaseline(rule);
      switch (rule.type) {
        case 'header': {
          const hr = rule as V5.HeaderRule;
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
          const rr = rule as V5.RedirectRule;
          form.setFieldsValue({ ...baseValues, redirectTo: rr.action.redirectTo });
          break;
        }
        case 'query-param': {
          const qr = rule as V5.QueryParamRule;
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
    [form, setConflictBaseline, setDefaultHeaderTab],
  );

  // `populateAndBaseline` is the canonical "sync the form from the
  // mirror" entry point — it sets form values AND snaps
  // `lastPrimedFingerprint` to the just-applied canonical so `isDirty`
  // reads `false` from the very first form-rendered tick (the
  // auto-rebase effect would catch up on the next render anyway, but
  // explicit avoids a one-frame "false dirty" flash). Used by both
  // the init effect (mount path) and `useEntityReprime` (broadcast
  // catch-up path).
  const populateAndBaseline = useCallback(
    (rule: V5.Rule) => {
      populateFormFromRule(rule);
      setLastPrimedFingerprint(canonicalProjection(rule));
    },
    [populateFormFromRule, canonicalProjection],
  );

  // Phase A A4 — live-update reconciliation. After init, `liveRule`
  // mutates whenever another surface commits a change. `useEntityReprime`
  // owns the gating: skip while `isDirty`, while the user has a field
  // of this rule focused (so we don't tear down `Form.List` rows under
  // them mid-edit), and when the broadcast carries content we already
  // populated (signature gate). Same hook every entity editor uses.
  const ruleSignature = useCallback((r: V5.Rule) => JSON.stringify(r), []);
  const reprime = useEntityReprime<V5.Rule>({
    liveEntity: liveRule,
    scope: { entityType: RULE_ENTITY_TYPE, entityId: ruleUid },
    isDirty,
    enabled: isInitialized,
    signature: ruleSignature,
    populate: populateAndBaseline,
  });

  useEffect(() => {
    if (initializedRef.current) return;
    const rule = rules.find((r) => r.uid === ruleUid);
    if (!rule) return;
    initializedRef.current = true;
    setIsInitialized(true);
    populateAndBaseline(rule);
    reprime.markPopulated(rule);

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
        // Dirty derives from form vs canonical — overlay applies user
        // intent ON TOP of the persisted shell, so the next render's
        // fingerprint diverges and reports dirty automatically.
        if (rule.type === 'header') {
          const reqLen = Array.isArray(overlay.requestHeaders)
            ? (overlay.requestHeaders as unknown[]).length
            : ((rule as V5.HeaderRule).action.requestHeaders?.length ?? 0);
          const resLen = Array.isArray(overlay.responseHeaders)
            ? (overlay.responseHeaders as unknown[]).length
            : ((rule as V5.HeaderRule).action.responseHeaders?.length ?? 0);
          setHeaderReqCount(reqLen);
          setHeaderResCount(resLen);
          setDefaultHeaderTab(reqLen, resLen);
        }
      }
    }
    // populateAndBaseline / reprime captured at mount time via the
    // initializedRef guard above; lint exhaustive-deps would suggest
    // listing them here, but the effect is idempotent and runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleUid, rules, form, initialDraft, draftUrlStrategy, setDefaultHeaderTab]);

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

  // `buildRule` is a pure module-level function (defined below the
  // component). Closures over `ruleName` / `isEnabled` are explicit
  // function arguments — keeps it usable BOTH as the save-time
  // projection AND the dirty-derivation projection without React
  // hook-order constraints.

  const handleSubmit = useCallback(async () => {
    if (!liveRule) return;
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
      const rule = buildRule(values, ruleName, isEnabled);
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
      // Dirty derives from form vs canonical equality; once the
      // commit broadcast lands and the mirror updates `liveRule` to
      // match the form's values, the next render reports dirty=false
      // automatically. No explicit reset needed.
      conflicts.clearDismissed();
      onSaved(ruleUid);
    } finally {
      setSaving(false);
    }
  }, [
    form,
    liveRule,
    ruleUid,
    ruleName,
    isEnabled,
    activeWorkspaceId,
    isDirty,
    isPublished,
    message,
    mutator,
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
        <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={ruleUid}>
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
                      onTabChange={handleHeaderTabChange}
                      reqCount={headerReqCount}
                      resCount={headerResCount}
                      ruleUid={ruleUid}
                      excludeInstanceId={localInstanceId}
                      getConflict={conflicts.getConflict}
                      getSetConflict={conflicts.getSetConflict}
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

            <EntityConflictDialog
              open={isConflictDialogOpen}
              savedText={savedYaml}
              buildLocalText={buildLocalText}
              conflicts={allConflicts}
              localValuesByPath={formProjection ? new Map(Object.entries(formProjection)) : undefined}
              pathLabels={conflictPathLabels}
              onResolve={applyResolutions}
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

// ── Pure projection: form values → V5.Rule shape ─────────────────────
//
// Used at save time (`handleSubmit` reads form values and projects to
// the mutation payload) AND at dirty-derivation time (the same
// projection is fingerprinted and compared to `liveRule`). One source
// of truth, no React hook-order constraints — the function is module-
// level pure so it can be referenced from anywhere in the component
// without TDZ issues.
//
// `name` / `enabled` are externally-owned (sourced from `liveRule`
// and updated via inline-rename / toggle paths, not the form). They
// flow through here as parameters so the projected shape lines up
// with what the mirror stores; the dirty fingerprint compares
// like-for-like.
function buildRule(
  formValues: Record<string, unknown>,
  ruleName: string,
  isEnabled: boolean,
): Omit<V5.Rule, 'uid' | 'path'> | null {
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
          params: (
            formValues.queryParams as Array<{ uid?: string; param: string; value: string; operation: string }>
          ).map((p) => ({
            // Mint when the row was added by the editor before the
            // hidden uid Form.Item was bound (e.g. seed templates,
            // freshly-cloned rows). Existing rows preserve their
            // persisted uid so awareness paths remain stable across
            // reorders.
            uid: p.uid ?? generateUid(),
            param: p.param,
            value: p.operation === 'remove' ? undefined : p.value,
            operation: p.operation as V5.QueryParamOperation,
          })),
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
}
