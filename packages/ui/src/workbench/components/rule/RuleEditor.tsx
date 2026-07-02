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

import { DownOutlined, FileOutlined, FolderOpenOutlined, FolderOpenTwoTone } from '@ant-design/icons';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ExtensionRuleType, Rule, RuleDraft } from '@openheaders/core/types';
import { isRuleComplete } from '@openheaders/core/utils';
import { Alert, App, Button, Dropdown, Form, type MenuProps, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionPathsProvider,
  EntityScopeProvider,
  PresenceBadge,
  RULE_ACTION_PATHS,
  useLocalInstanceId,
} from '@openheaders/ui/shared/awareness';
import { EntityConflictBanner, EntityConflictDialog } from '@openheaders/ui/shared/conflicts';
import { ConflictsProvider } from '@openheaders/ui/shared/conflicts/Field';
import { useEditorShell } from '@openheaders/ui/shared/editor-shell';
import { applyRuleCreate, applyRulePublish } from '@openheaders/ui/shared/sync/rule-write-client';
import SectionInfo from '../shared/SectionInfo';
import type { RuleDraftData } from '../../hooks/useSaveRuleFlow';
import { formatString } from '../../languages/prettier';
import type { LanguageId } from '../../languages/registry';
import { useSettingValue } from '../../settings/hooks';
import { get as getSetting } from '../../settings/store';
import ConditionEditor from './ConditionEditor';
import { useHeaderPreviewTabs } from './rule-editor/useHeaderPreviewTabs';
import { useRuleConflictResolution } from './rule-editor/useRuleConflictResolution';
import { useRuleForm } from './rule-editor/useRuleForm';
import { useRuleTemplates } from './rule-editor/useRuleTemplates';
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
import QueryParamRuleFields from '../rule-fields/QueryParamRuleFields';
import RedirectRuleFields from '../rule-fields/RedirectRuleFields';
import SaveAsTemplateModal from '../save/SaveAsTemplateModal';
import { renderTwoToneIcon } from '../shared/TwoToneIconPicker';
import { SuggestionContextProvider } from '../template-input';

const { Text } = Typography;

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
  const { rules, activeWorkspaceId, localCollections, templates: userTemplates, templateCollectionTrees } = useRules();
  const mutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const localInstanceId = useLocalInstanceId();
  const [form] = Form.useForm();
  const [_saving, setSaving] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  // Header-preview tab + badge state, lifted from HeaderRuleFields so the
  // parent owns the truth (useWatch has first-render timing issues).
  const {
    headerActiveTab,
    headerReqCount,
    headerResCount,
    handleHeaderTabChange,
    setDefaultHeaderTab,
    setHeaderReqCount,
    setHeaderResCount,
  } = useHeaderPreviewTabs();

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

  // Baseline coordination refs — the shared layer between `useRuleForm`
  // (whose `onPrimed` writes both after every populate / auto-rebase),
  // the conflict tracker (wires its setter into `setBaselineRef`, reads
  // `baselineRuleRef` for the merge-editor base), and the save flow
  // (reads `baselineRuleRef` for the per-field merge). Kept here so all
  // three share one layer instead of threading through each other.
  const setBaselineRef = useRef<(r: Rule) => void>(() => undefined);
  // Snapshot of the rule the form was last seeded from. Drives the
  // per-field save merge: Save broadcasts only leaves that diverge from
  // baseline so a peer's concurrent commit on a different leaf survives.
  // Advances in lockstep with the conflict tracker baseline (both wired
  // through `onPrimed`).
  const baselineRuleRef = useRef<Rule | null>(null);

  // ── Template selector ─────────────────────────────────────────
  const {
    applyTemplate,
    selectTemplate,
    selectedMenuKey,
    systemMenuItems,
    userMenuItems,
    activeSystemTemplate,
    activeUserTemplate,
    selectedDescription,
  } = useRuleTemplates({
    selectedType,
    form,
    userTemplates,
    templateCollectionTrees,
    initialTemplateKey,
    setDefaultHeaderTab,
    setHeaderReqCount,
    setHeaderResCount,
  });

  // Form population + dirty derivation: the reactive form snapshot, the
  // reprime pass (dirty / populate gating / auto-rebase) with its
  // overlay-apply `onPrimed`, and the create-mode bootstrap seed.
  // `applyTemplate` (from the template hook above) threads in so
  // `onPrimed` needs no forward reference; the two baseline refs thread
  // in as the shared coordination layer.
  const { formValues, isDirty, populateFormFromRule } = useRuleForm({
    liveRule,
    ruleUid,
    isCreateMode,
    ruleName,
    isEnabled,
    form,
    seedRuleType,
    seedRuleContent,
    initialTemplateKey,
    initialDraft,
    draftUrlStrategy,
    applyTemplate,
    setBaselineRef,
    baselineRuleRef,
    setDefaultHeaderTab,
    setHeaderReqCount,
    setHeaderResCount,
  });

  const {
    fieldConflictsApi,
    allConflicts,
    dialogOnlyConflict,
    isConflictDialogOpen,
    setConflictDialogOpen,
    handleKeepAllMine,
    handleUseAllSaved,
    handleResolveText,
    savedYaml,
    mineText,
    baseYaml,
    clearDismissed,
  } = useRuleConflictResolution({
    liveRule,
    isDirty,
    isCreateMode,
    form,
    formValues,
    ruleName,
    isEnabled,
    populateFormFromRule,
    setBaselineRef,
    baselineRuleRef,
  });

  const handleToggleEnabled = useCallback(() => {
    if (!ruleUid) return;
    void mutator.toggleRule(ruleUid, !isEnabled);
  }, [ruleUid, isEnabled, mutator]);

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
      clearDismissed();
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
    clearDismissed,
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

  // Collection the rule belongs to — used by the resolution banner so
  // collection-scoped `{{collection.X}}` references resolve correctly.
  const bannerCollectionId = useMemo<string | undefined>(() => {
    if (liveRule) {
      const match = localCollections.find((c) => liveRule.path.startsWith(`${c.path}/`));
      return match?.uid;
    }
    return preferredCollectionId;
  }, [liveRule, localCollections, preferredCollectionId]);

  // The header title slot hosts the template picker instead of an
  // "Edit <type>" caption — the tab pill already names the rule type,
  // so repeating it here only cost vertical space. One button, one
  // menu: Blank applies directly; System / User open the same
  // hierarchical trees the old three-button row had.
  const templatesMenuItems: MenuProps['items'] = [
    {
      key: 'blank',
      icon: <FileOutlined />,
      label: 'Blank',
      onClick: () => selectTemplate('empty'),
    },
    {
      key: 'system-templates',
      icon: <FolderOpenOutlined />,
      label: 'System',
      disabled: systemMenuItems.length === 0,
      children: systemMenuItems,
    },
    {
      // Never disabled — with no user templates the submenu opens onto
      // an explanatory empty state, so the feature stays discoverable.
      key: 'user-templates',
      icon: <FolderOpenTwoTone />,
      label: 'User',
      children: userMenuItems.length
        ? userMenuItems
        : [
            {
              key: 'user-templates-empty',
              disabled: true,
              label: (
                <div style={{ maxWidth: 280, whiteSpace: 'normal', padding: '4px 2px' }}>
                  <div style={{ fontWeight: 600, color: token.colorText, marginBottom: 2 }}>No user templates yet</div>
                  <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
                    User templates are your own reusable presets for this rule type. Configure the rule the way you
                    want, then choose <strong>⋮ → Save as User Template</strong> in the header — it will show up here
                    for every new rule of this type.
                  </div>
                </div>
              ),
            },
          ],
    },
  ];

  const activeTemplateSuffix = activeSystemTemplate ? (
    <span>
      {activeSystemTemplate.icon} {activeSystemTemplate.name}
    </span>
  ) : activeUserTemplate ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {renderTwoToneIcon(activeUserTemplate.icon, { fontSize: 12 })}
      {activeUserTemplate.name}
    </span>
  ) : (
    <span>Blank</span>
  );

  const headerTitle = (
    <>
      <Text strong style={{ fontSize: 13 }}>
        Templates
      </Text>
      {/* No `docId` — templates have no docs section yet, so the
          popover carries the whole explanation without a "More
          information" link. */}
      <SectionInfo
        content={{
          kicker: 'Rule Editor',
          title: 'Templates',
          summary: 'Start from a preset instead of a blank form.',
          description:
            'System templates ship with the app; user templates are ones you save yourself via ⋮ → Save as User Template. Applying a template only pre-fills the fields — adjust anything before saving.',
        }}
      />
      <Dropdown
        menu={{ items: templatesMenuItems, selectable: true, selectedKeys: [selectedMenuKey] }}
        trigger={['click']}
      >
        <Tooltip title={selectedDescription} placement="bottomLeft" mouseEnterDelay={0.5}>
          <Button size="small">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FolderOpenOutlined style={{ fontSize: 13 }} />
              {activeTemplateSuffix}
              <DownOutlined style={{ fontSize: 9 }} />
            </span>
          </Button>
        </Tooltip>
      </Dropdown>
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
      label: 'Save as User Template',
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
                          <SectionInfo
                            content={{
                              kicker: 'Rule Editor',
                              title: 'Conditions',
                              summary: 'Conditions decide which requests this rule applies to.',
                              description:
                                'Rows combine with AND — every row must match. To match any of several values, list them inside one row (the OR badge marks rows that accept multiple values).',
                            }}
                            docId="conditions"
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
