/**
 * RuleEditorTab — one response-override rule opened as a full editor-tab
 * document: the quick popover's in-panel escalation, with the workbench
 * form vocabulary at DevTools size (status, content-type, format-aware
 * body, conditions) instead of the popover's compact fields.
 *
 * EDIT mode reads the CANONICAL rule through the live sync mirror (the
 * value-document precedent — no fetch, no poll) into the shared
 * `useActionDraft` spine, so dirty derives from draft-vs-canonical
 * equality and an external save re-primes a pristine form. The form's
 * body value is WIRE text — `FormatAwareBodyEditor` encodes per edit —
 * so Save stores it verbatim through `buildResponseRuleWireUpdate`
 * (atomic edit, `published: true` in the same batch). A popover
 * hand-off (escalating mid-edit) pre-applies its unsaved form state
 * once, right after the first canonical prime.
 *
 * CREATE mode (uid-less tab) seeds from the captured draft and mirrors
 * the create popover at full size: editable name, destination row,
 * conditions row; Save runs the shared mint-then-publish chain
 * (`performQuickCreateSave`) and re-keys the tab to the minted uid —
 * the body remounts (tab ids key the panels) into edit mode against
 * the live mirror. The document is born dirty: it exists only in this
 * tab until the first Save, so the close guard must offer to keep it.
 */

import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import type { ResponseRule, RuleCondition } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { CONTENT_TYPE_OPTIONS, STATUS_CODES } from '@openheaders/ui/workbench/components/rule-fields/status-codes';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, AutoComplete, Input, Select, theme } from 'antd';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RuleEditorInspectorTab } from '../../data/inspector-tab';
import { buildResponseRuleSeedFromWire } from '../../data/rule-create/response-rule-create';
import { buildResponseRuleWireUpdate, type ResponseQuickDraft } from '../../data/rule-create/response-rule-edit';
import Skeleton from '../detail/Skeleton';
import { QuickConditionsRow } from '../rule-quick-editor/QuickConditionsRow';
import { QuickDestinationRow } from '../rule-quick-editor/QuickDestinationRow';
import { useActionDraft } from '../rule-quick-editor/use-action-draft';
import { useConditionsDraft } from '../rule-quick-editor/use-conditions-draft';
import { useQuickCreateDestination } from '../rule-quick-editor/use-quick-create-destination';
import { performQuickCreateSave } from '../rule-quick-editor/use-quick-create-save';
import { ArmedIconButton } from '../storage/ArmedIconButton';
import { StorageDocSaveButton } from '../storage/StorageDocSaveButton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk.
const FormatAwareBodyEditor = lazy(
  () => import('@openheaders/ui/workbench/components/rule-fields/FormatAwareBodyEditor'),
);

type SaveFailure = 'not-found' | 'write';

const SAVE_FAILURE_NOTES: Record<SaveFailure, MessageKey> = {
  'not-found': 'panel.ruleDoc.saveFailed.notFound',
  write: 'panel.ruleDoc.saveFailed.write',
};

interface RuleEditorTabProps {
  tab: RuleEditorInspectorTab;
  /** Mirrors the derived dirty state up into the tab (pill dot, close guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Registers this tab's save action for the close guard's "Save
   *  changes" path; called with `null` on unmount. Resolves whether the
   *  save committed. */
  registerSave?: (save: (() => Promise<boolean>) | null) => void;
  /** Whether this document is the focused group's active tab — gates
   *  the Save keyboard chord when a split shows two documents. */
  isActiveDocument?: boolean;
  /** Committed rule binding: the first Save minted the rule — the tab
   *  re-keys to the uid (dropping the seed payloads) and the pill takes
   *  the final name. Edit-mode saves re-land the same id to shed a
   *  consumed popover hand-off. */
  onRekeyed?: (ruleUid: string, label: string) => void;
}

export function RuleEditorTab({ tab, onDirtyChange, registerSave, isActiveDocument, onRekeyed }: RuleEditorTabProps) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  const isCreate = tab.ruleUid === null;
  const liveRule = useLiveRule(tab.ruleUid, workspaceId);
  const responseRule: ResponseRule | null = liveRule?.type === 'response' ? liveRule : null;
  const isDynamic = responseRule?.action.bodyType === 'dynamic';

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);

  // Create-mode identity fields; inert in edit mode.
  const [name, setName] = useState(() => tab.draftName ?? '');
  const dest = useQuickCreateDestination(tab.draft?.url);
  const [createConditions, setCreateConditions] = useState<RuleCondition[]>(
    () => tab.draftConditions ?? (tab.draft ? buildDraftConditions(tab.draft, strategy) : []),
  );
  const createConditionsRef = useRef(createConditions);
  createConditionsRef.current = createConditions;

  // The draft record lives in WIRE space (the body editor encodes per
  // edit), so dirty equality and the Save payload read the same text.
  const canonical = useMemo<ResponseQuickDraft | null>(() => {
    if (isCreate) {
      if (tab.draft === undefined) return null;
      return {
        statusCode: tab.draft.statusCode ?? 0,
        contentType: tab.draft.contentType ?? '',
        responseBody: tab.draft.responseBody ?? '',
      };
    }
    if (responseRule === null || isDynamic) return null;
    return {
      statusCode: responseRule.action.statusCode,
      contentType: responseRule.action.contentType,
      responseBody: responseRule.action.responseBody,
    };
  }, [isCreate, tab.draft, responseRule, isDynamic]);

  const { draft, setDraft, draftRef, updateDraft, isDirty: fieldsDirty } = useActionDraft({ canonical });
  const condEdit = useConditionsDraft({ canonical: isCreate ? null : (responseRule?.conditions ?? null) });

  // Popover hand-off: apply its unsaved form state ONCE, after the
  // draft's first canonical prime (this effect is registered after the
  // hook's, so the prime always lands first within the same flush).
  const handOffApplied = useRef(false);
  useEffect(() => {
    if (handOffApplied.current || isCreate || tab.handOff === undefined || canonical === null) return;
    handOffApplied.current = true;
    const { conditions, ...fields } = tab.handOff;
    setDraft(fields);
    if (conditions !== undefined) condEdit.setConditions(conditions);
  }, [isCreate, tab.handOff, canonical, setDraft, condEdit.setConditions]);

  // A create document exists only in this tab until Save mints it —
  // born dirty so the close guard offers to keep it.
  const dirty = isCreate ? true : fieldsDirty || condEdit.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const savable = isCreate
    ? !saving && tab.draft !== undefined && name.trim().length > 0
    : !saving && canonical !== null && dirty;

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (saving) return false;
    if (isCreate) {
      const createDraft = tab.draft;
      if (createDraft === undefined || name.trim().length === 0) return false;
      setSaving(true);
      try {
        const outcome = await performQuickCreateSave({
          buildSeed: () => buildResponseRuleSeedFromWire(createDraft, draftRef.current, name, createConditionsRef.current),
          destination: dest.forSave,
          workspaceId,
          mutator,
          message,
          t,
        });
        if (outcome === null) return false;
        onRekeyed?.(outcome.ruleUid, name);
        return true;
      } finally {
        setSaving(false);
      }
    }
    if (responseRule === null || isDynamic) return false;
    setSaving(true);
    try {
      const updates = buildResponseRuleWireUpdate(
        responseRule,
        draftRef.current,
        condEdit.isDirty ? condEdit.conditionsRef.current : undefined,
      );
      const result = await mutator.updateRule(responseRule.uid, updates);
      if (!result.ok) {
        setSaveError(result.reason === 'not-found' ? 'not-found' : 'write');
        return false;
      }
      setSaveError(null);
      // The draft already IS the written state; derived dirty clears
      // when the mirror echo lands (the draft hooks' auto-rebase). The
      // re-key sheds a consumed hand-off and clears the pill now.
      onRekeyed?.(responseRule.uid, responseRule.name);
      return true;
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    isCreate,
    tab.draft,
    name,
    dest.forSave,
    workspaceId,
    mutator,
    message,
    t,
    responseRule,
    isDynamic,
    draftRef,
    condEdit.isDirty,
    condEdit.conditionsRef,
    onRekeyed,
  ]);

  useEffect(() => {
    registerSave?.(handleSave);
    return () => registerSave?.(null);
  }, [registerSave, handleSave]);

  const discardDraft = useCallback(() => {
    if (canonical !== null) setDraft({ ...canonical });
    if (!isCreate && responseRule !== null) condEdit.setConditions(responseRule.conditions);
    setSaveError(null);
  }, [canonical, setDraft, isCreate, responseRule, condEdit.setConditions]);

  const openInWorkspace = useCallback(() => {
    if (tab.ruleUid === null) return;
    void openWorkspace({ kind: 'edit-rule', uid: tab.ruleUid }, 'devpanel');
  }, [tab.ruleUid]);

  const statusOptions = useMemo(
    () => [{ value: 0, label: t('workbench.editors.rule.fields.response.keepOriginalStatus') }, ...STATUS_CODES],
    [t],
  );

  const crumbName = isCreate ? name : (responseRule?.name ?? tab.label);
  const showForm = canonical !== null;

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 2,
  };

  return (
    <div className="dt-storagedoc">
      <div className="dt-storagedoc-toolbar">
        <span className="dt-storagedoc-crumb" title={`${crumbName} › ${t('panel.ruleDoc.crumbKind')}`}>
          {crumbName} <span className="dt-storage-meta">· {t('panel.ruleDoc.crumbKind')}</span>
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        <StorageDocSaveButton
          savable={savable}
          saving={saving}
          dirty={dirty}
          saveHint={isCreate ? t('panel.ruleDoc.saveHintCreate') : t('panel.ruleDoc.saveHint')}
          blockedHint={showForm ? undefined : t('panel.ruleDoc.blockedHintDetached')}
          isActiveDocument={isActiveDocument}
          onSave={() => void handleSave()}
        />
        {!isCreate && dirty && showForm && (
          <ArmedIconButton
            icon={<ReloadOutlined />}
            title={t('panel.ruleDoc.rereadTitle')}
            confirmTitle={t('panel.ruleDoc.rereadConfirm')}
            ariaLabel={t('panel.ruleDoc.rereadAria')}
            onConfirm={discardDraft}
          />
        )}
        {!isCreate && (
          <button
            type="button"
            className="dt-storagedoc-reveal"
            title={t('panel.ruleDoc.openRuleTitle')}
            onClick={openInWorkspace}
          >
            <ExportOutlined aria-hidden="true" /> {t('panel.ruleDoc.openRule')}
          </button>
        )}
      </div>
      {saveError !== null && (
        <div className="dt-storagedoc-note dt-storagedoc-note--error" role="alert">
          {t(SAVE_FAILURE_NOTES[saveError])}
        </div>
      )}
      {showForm ? (
        <div className="dt-storagedoc-source dt-scrollbar" style={{ overflowY: 'auto', overscrollBehavior: 'none', padding: 12 }}>
          {isCreate && (
            <div style={{ marginBottom: 8 }}>
              <div style={fieldLabelStyle}>{t('panel.ruleDoc.nameLabel')}</div>
              <Input
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab.draftName}
                style={{ maxWidth: 420 }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, maxWidth: 640 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabelStyle}>{t('workbench.editors.rule.fields.response.statusCode')}</div>
              <Select
                size="small"
                showSearch
                value={draft.statusCode}
                onChange={(code) => updateDraft({ statusCode: code })}
                options={statusOptions}
                style={{ width: '100%' }}
                filterOption={(input, option) => {
                  const label = String(option?.label ?? '');
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabelStyle}>{t('workbench.editors.rule.fields.response.contentType')}</div>
              <AutoComplete
                size="small"
                value={draft.contentType}
                onChange={(v) => updateDraft({ contentType: v })}
                options={CONTENT_TYPE_OPTIONS}
                placeholder="application/json"
                style={{ width: '100%' }}
                filterOption={(input, option) => {
                  const value = String(option?.value ?? '');
                  return value.toLowerCase().includes(input.toLowerCase());
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={fieldLabelStyle}>{t('workbench.editors.rule.fields.response.bodyLabel')}</div>
            <Suspense fallback={<Skeleton />}>
              <FormatAwareBodyEditor
                value={draft.responseBody}
                onChange={(v) => updateDraft({ responseBody: v })}
                minHeight={280}
              />
            </Suspense>
          </div>
          <QuickConditionsRow
            value={isCreate ? createConditions : condEdit.conditions}
            onChange={isCreate ? setCreateConditions : condEdit.setConditions}
          />
          {isCreate && <QuickDestinationRow api={dest} />}
        </div>
      ) : isCreate || liveRule === null ? (
        <div className="dt-empty-hero">
          <strong>{t('panel.ruleDoc.detachedTitle')}</strong>
          <span className="dt-empty-hero-sub">{t('panel.ruleDoc.detachedSub')}</span>
        </div>
      ) : (
        <div className="dt-empty-hero">
          <strong>{t('panel.ruleDoc.dynamicTitle')}</strong>
          <span className="dt-empty-hero-sub">{t('panel.ruleDoc.dynamicSub')}</span>
        </div>
      )}
    </div>
  );
}
