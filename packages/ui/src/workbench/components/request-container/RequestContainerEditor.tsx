/**
 * RequestContainerEditor — THE editor of a request collection or a
 * request folder: one tab per container, its concerns as sub-tabs —
 * Overview · Authorization · Scripts · Settings · Variables (folders
 * carry no variables: the collection is the only variable-scoping
 * container). The request editor's shape: one header, one Save, one
 * dirty state, a modified dot per section.
 *
 * Replaces the per-concern tab modes (`request-collection-auth`,
 * `-scripts`, `-vars` and the folder pair) that each concern's epic had
 * minted — a collection was the only entity in the workbench without
 * an editor of its own.
 *
 * Draft = the container's editable slots (the auth pool's default
 * entry, the two script slots, the inheritable settings, the
 * variables); `useReprime` derives dirty from the draft vs the live
 * entity; Save writes only the slots that changed, each through its
 * own write client (the batches those clients mint are per-slot by
 * design — the pool is a set replacement plus its default scalar,
 * scripts are sibling files, settings one leaf per changed knob,
 * variables a set replacement).
 *
 * Level-honest auth: at a collection the transparent choice reads "No
 * default" (there is no parent), at a folder "Inherit from
 * collection"; both persist the pool WITHOUT a default entry (no
 * default ↔ transparent level), the same rule the script slots follow.
 */

import { FolderOpenOutlined, FolderOutlined } from '@ant-design/icons';
import { authPoolOf, LEGACY_AUTH_ENTRY_UID } from '@openheaders/core/auth-inheritance';
import { definedSettingCount } from '@openheaders/core/schemas';
import { type ScriptSlotCarrier, scriptSlotPath } from '@openheaders/core/scripts';
import { type SettingsCarrier, settingUpdatesBetween } from '@openheaders/core/settings-inheritance';
import type { PersistedLocalFolder } from '@openheaders/core/storage';
import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import type {
  AuthConfig,
  AuthPoolEntry,
  Collection,
  HttpMethod,
  ContainerSettings,
  Variable,
} from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  EntityScopeProvider,
  PresenceBadge,
  useLocalInstanceId,
  VARIABLE_PATHS,
} from '@openheaders/ui/shared/awareness';
import { EntityConflictBanner, EntityConflictDialog } from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import type { SyncSimpleResult } from '@openheaders/ui/shared/sync/apply-payload';
import { useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import {
  applyRequestCollectionSetAuthPool,
  applyRequestCollectionSetScripts,
  applyRequestCollectionSetSettings,
} from '@openheaders/ui/shared/sync/request-collection-write-client';
import {
  applyRequestFolderSetAuthPool,
  applyRequestFolderSetScripts,
  applyRequestFolderSetSettings,
} from '@openheaders/ui/shared/sync/request-folder-write-client';
import { App, Tabs, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RequestContainerSection } from '../../types';
import RequestCollectionOverview from '../overviews/RequestCollectionOverview';
import RequestFolderOverview from '../overviews/RequestFolderOverview';
import VariableTable from '../panels/VariableTable';
import { TabCount, TabDot } from '../request-editor/request-tab-items';
import ScriptsTab from '../request-editor/ScriptsTab';
import {
  SCRIPT_KINDS,
  type ScriptSlotValues,
  scriptSlotFlagsBetween,
  scriptSlotValuesOf,
} from '../script-editor/script-slots';
import EditorHeader from '../shell/EditorHeader';
import { SuggestionContextProvider } from '../template-input';
import { useCollectionVariableConflictsUi } from '../variables/use-collection-variable-conflicts-ui';
import { findFolderAncestry, findFolderCollectionUid, nearestAuthPool, settingsChainOf } from './ancestry';
import AuthPoolSection, { type AuthPoolDraft } from './AuthPoolSection';
import SettingsSection from './SettingsSection';

const { Text } = Typography;

export type RequestContainerKind = 'collection' | 'folder';

/** The overview section's navigation — the callbacks the overview
 *  tables and the Add request picker need, threaded from the tab body. */
export interface RequestContainerOverviewActions {
  onSelectRequest: (uid: string, name: string, method: HttpMethod) => void;
  onSelectGrpcRequest: (uid: string, name: string) => void;
  onSelectWebSocketRequest: (uid: string, name: string, flavor?: 'raw' | 'socketio') => void;
  onSelectMqttRequest: (uid: string, name: string) => void;
  onCreateRequest: (context: { collectionId: string; folderPath?: string }) => void;
  onCreateGrpcRequest?: (context: { collectionId: string; folderPath?: string }) => void;
  onCreateWebSocketRequest?: (context: {
    collectionId: string;
    folderPath?: string;
    flavor: 'raw' | 'socketio';
  }) => void;
  onCreateMqttRequest?: (context: { collectionId: string; folderPath?: string }) => void;
  onOpenFolderOverview: (uid: string, name: string) => void;
}

interface RequestContainerEditorProps {
  kind: RequestContainerKind;
  /** Request-collection uid or request-folder uid, per `kind`. */
  entityUid: string;
  /** The section an opener asked for; the editor follows every change
   *  of it and otherwise keeps its own choice. */
  section?: RequestContainerSection;
  /** The user switched sections — the tab records it so a reopen lands
   *  where they left. */
  onSectionChange?: (section: RequestContainerSection) => void;
  overview: RequestContainerOverviewActions;
  /** Open the Package Library tab (ScriptsTab's Packages popover footer). */
  onOpenPackageLibrary?: () => void;
  /** The Scripts section became visible — the post-import "review
   *  pending" reminder for this container clears on it. */
  onScriptsViewed?: (uid: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Opens a container's Authorization section — an inheriting
   *  folder's "Edit in …" opener onto the supplying level. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  /** Opens a container's Settings section — a folder's inherited
   *  rows' "Edit in parent" opener onto the supplying level. */
  onOpenContainerSettings?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
}

interface ContainerEntity extends ScriptSlotCarrier {
  uid: string;
  name: string;
  auths?: AuthPoolEntry[];
  defaultAuthUid?: string;
  auth?: AuthConfig;
  settings?: ContainerSettings;
  variables?: Variable[];
}

interface ContainerDraft {
  pool: AuthPoolDraft;
  scripts: ScriptSlotValues;
  settings: ContainerSettings;
  variables: Variable[];
}

const EMPTY_VARS: Variable[] = [];
const EMPTY_SETTINGS: ContainerSettings = {};
const NO_SETTINGS_CHAIN: readonly SettingsCarrier[] = [];

/** The whole pool as the draft's auth slot — a transparent level (no
 *  pool) is the empty list; the legacy single-auth read seeds as its
 *  one entry (Save re-mints its reserved uid and retires the field). */
function poolDraftOf(entity: ContainerEntity | null): AuthPoolDraft {
  const pool = entity === null ? null : authPoolOf(entity);
  if (pool === null) return { auths: [] };
  return { auths: [...pool.entries], defaultAuthUid: pool.defaultUid };
}

function draftOf(entity: ContainerEntity | null): ContainerDraft {
  return {
    pool: poolDraftOf(entity),
    scripts: scriptSlotValuesOf(entity ?? {}),
    settings: entity?.settings ?? EMPTY_SETTINGS,
    variables: entity?.variables ?? EMPTY_VARS,
  };
}

function draftSignature(draft: ContainerDraft): string {
  return stableStringify(draft);
}

/** Editor value → persisted slot: whitespace-only means "no script". */
function slotValue(source: string): string | undefined {
  return source.trim() ? source : undefined;
}

const RequestContainerEditor: React.FC<RequestContainerEditorProps> = ({
  kind,
  entityUid,
  section,
  onSectionChange,
  overview,
  onOpenPackageLibrary,
  onScriptsViewed,
  onDirtyChange,
  registerSaveRef,
  onOpenContainerAuth,
  onOpenContainerSettings,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const t = useT();
  const { collections, folders, collectionTrees } = useRequests();
  const { activeWorkspaceId: workspaceId } = useRules();
  const { replaceRequestCollectionVariables } = useVariableMutator();

  const entity: ContainerEntity | null = useMemo(() => {
    if (kind === 'collection') return collections.find((c: Collection) => c.uid === entityUid) ?? null;
    return folders.find((f: PersistedLocalFolder) => f.uid === entityUid) ?? null;
  }, [kind, collections, folders, entityUid]);

  const entityType = kind === 'collection' ? REQUEST_COLLECTION_ENTITY_TYPE : REQUEST_FOLDER_ENTITY_TYPE;

  // The template-suggestion scope: the collection itself, or the
  // folder's owning collection read off the trees.
  const suggestionCollectionId = useMemo(
    () => (kind === 'collection' ? entityUid : (findFolderCollectionUid(collectionTrees, entityUid) ?? undefined)),
    [kind, entityUid, collectionTrees],
  );

  // A transparent folder shows the pool it inherits — the NEAREST
  // ancestor holding one (a folder above it, else the collection), the
  // level the resolver applies — read off the trees, never a stored
  // path.
  const inherited = useMemo(() => {
    if (kind !== 'folder') return undefined;
    return nearestAuthPool(findFolderAncestry(collectionTrees, collections, folders, entityUid));
  }, [kind, collectionTrees, collections, folders, entityUid]);

  // A folder's Settings rows read the chain above it (outer → inner,
  // off the trees) for their placeholders — the per-knob cascade's
  // own answer, per kind; a collection has nothing above it. Both sit
  // on the ancestor plane (explicit wins).
  const settingsChain = useMemo((): readonly SettingsCarrier[] => {
    const ancestry = kind === 'folder' ? findFolderAncestry(collectionTrees, collections, folders, entityUid) : null;
    return ancestry === null ? NO_SETTINGS_CHAIN : settingsChainOf(ancestry);
  }, [kind, collectionTrees, collections, folders, entityUid]);

  const [activeSection, setActiveSection] = useState<RequestContainerSection>(section ?? 'overview');
  useEffect(() => {
    // A folder has no Variables section — a stale ask for it lands on
    // the overview.
    if (section !== undefined) setActiveSection(section === 'variables' && kind === 'folder' ? 'overview' : section);
  }, [section, kind]);
  const switchSection = useCallback(
    (next: RequestContainerSection) => {
      setActiveSection(next);
      onSectionChange?.(next);
    },
    [onSectionChange],
  );
  useEffect(() => {
    if (activeSection === 'scripts') onScriptsViewed?.(entityUid);
  }, [activeSection, entityUid, onScriptsViewed]);

  const [draft, setDraft] = useState<ContainerDraft>(() => draftOf(entity));
  const formFingerprint = useMemo(() => draftSignature(draft), [draft]);
  const setVariables = useCallback((variables: Variable[]) => setDraft((d) => ({ ...d, variables })), []);

  // Conflict-baseline ref pattern (canonical recipe): the reprime
  // primes before the conflict wiring exists, so the baseline advance
  // goes through a ref the wiring fills in below.
  const onPrimedRef = useRef<(variables: Variable[]) => void>(() => undefined);

  const reprime = useReprime<ContainerEntity>({
    liveEntity: entity,
    scope: { entityType, entityId: entityUid },
    enabled: entity !== null,
    formFingerprint,
    signature: (e) => draftSignature(draftOf(e)),
    populate: (e) => setDraft(draftOf(e)),
    onPrimed: (e) => onPrimedRef.current(e.variables ?? EMPTY_VARS),
  });
  const isDirty = reprime.isDirty;

  const conflictsUi = useCollectionVariableConflictsUi({
    collectionUid: entityUid,
    entityType,
    savedVariables: kind === 'collection' ? (entity?.variables ?? null) : null,
    draft: draft.variables,
    setDraft: setVariables,
    isDirty,
  });
  onPrimedRef.current = conflictsUi.onPrimed;

  const saved = useMemo(() => draftOf(entity), [entity]);
  const authUnsaved = stableStringify(draft.pool) !== stableStringify(saved.pool);
  // Per slot — the rail's dots and the Save's slice read the same
  // flags; the section is unsaved when any slot is.
  const scriptsUnsavedSlots = useMemo(
    () => scriptSlotFlagsBetween(draft.scripts, saved.scripts),
    [draft.scripts, saved.scripts],
  );
  const scriptsUnsaved = SCRIPT_KINDS.some((slot) => scriptsUnsavedSlots[slot] === true);
  // Per knob — the rail dot, the sub-tab dots and the Save's slice read
  // the same diff; only the knobs that changed ride the write.
  const settingsUpdates = useMemo(
    () => settingUpdatesBetween(saved.settings, draft.settings),
    [saved.settings, draft.settings],
  );
  const settingsUnsaved = settingsUpdates.length > 0;
  const variablesUnsaved = stableStringify(draft.variables) !== stableStringify(saved.variables);

  const handleSave = useCallback(() => {
    if (!entity || !isDirty || !workspaceId) return;
    const opts = { workspaceId, surfaceId: 'workbench' };
    const failed = (result: SyncSimpleResult, slot: 'auth' | 'scripts' | 'settings') => {
      if (result.ok) return;
      if (result.reason === 'not-found') {
        message.error(t('workbench.editors.requestContainer.deletedElsewhere'));
        return;
      }
      const detail = result.message;
      if (slot === 'auth') {
        message.error(
          detail
            ? t('workbench.editors.ancestorAuth.saveFailedDetail', { message: detail })
            : t('workbench.editors.ancestorAuth.saveFailed'),
        );
        return;
      }
      if (slot === 'settings') {
        message.error(
          detail
            ? t('workbench.editors.ancestorSettings.saveFailedDetail', { message: detail })
            : t('workbench.editors.ancestorSettings.saveFailed'),
        );
        return;
      }
      message.error(
        detail
          ? t('workbench.editors.ancestorScripts.saveFailedDetail', { message: detail })
          : t('workbench.editors.ancestorScripts.saveFailed'),
      );
    };
    const run = async () => {
      if (authUnsaved) {
        // The legacy single-auth read seeds the draft under its
        // reserved uid — a pool write re-mints it (entry uids are
        // schema-validated; the write retires the legacy field).
        let auths = draft.pool.auths;
        let defaultAuthUid = draft.pool.defaultAuthUid;
        if (auths.some((e) => e.uid === LEGACY_AUTH_ENTRY_UID)) {
          const minted = generateUid();
          auths = auths.map((e) => (e.uid === LEGACY_AUTH_ENTRY_UID ? { ...e, uid: minted } : e));
          if (defaultAuthUid === LEGACY_AUTH_ENTRY_UID) defaultAuthUid = minted;
        }
        const result =
          kind === 'collection'
            ? await applyRequestCollectionSetAuthPool({ collectionUid: entity.uid, auths, defaultAuthUid }, opts)
            : await applyRequestFolderSetAuthPool({ folderUid: entity.uid, auths, defaultAuthUid }, opts);
        failed(result, 'auth');
      }
      if (scriptsUnsaved) {
        // Only the slots that changed ride the batch — a save never
        // rewrites a slot the user did not touch.
        const updates = SCRIPT_KINDS.filter((slot) => scriptsUnsavedSlots[slot] === true).map((slot) => ({
          path: scriptSlotPath(slot),
          value: slotValue(draft.scripts[slot]),
        }));
        const result =
          kind === 'collection'
            ? await applyRequestCollectionSetScripts({ collectionUid: entity.uid, updates }, opts)
            : await applyRequestFolderSetScripts({ folderUid: entity.uid, updates }, opts);
        failed(result, 'scripts');
      }
      if (settingsUnsaved) {
        // One leaf per changed knob — never the object whole.
        const result =
          kind === 'collection'
            ? await applyRequestCollectionSetSettings({ collectionUid: entity.uid, updates: settingsUpdates }, opts)
            : await applyRequestFolderSetSettings({ folderUid: entity.uid, updates: settingsUpdates }, opts);
        failed(result, 'settings');
      }
      if (kind === 'collection' && variablesUnsaved) {
        const result = await replaceRequestCollectionVariables(entity.uid, draft.variables);
        if (result.ok) {
          conflictsUi.clearDismissed();
        } else if (result.reason === 'not-found') {
          message.error(t('workbench.editors.requestContainer.deletedElsewhere'));
        } else {
          message.error(
            result.message
              ? t('workbench.variables.collection.saveFailedDetail', { message: result.message })
              : t('workbench.variables.collection.saveFailed'),
          );
        }
      }
      // Dirty derives from form-vs-canonical equality; the post-save
      // broadcasts bring them into alignment automatically.
    };
    void run();
  }, [
    entity,
    isDirty,
    workspaceId,
    kind,
    draft,
    scriptsUnsavedSlots,
    settingsUpdates,
    authUnsaved,
    scriptsUnsaved,
    settingsUnsaved,
    variablesUnsaved,
    replaceRequestCollectionVariables,
    conflictsUi,
    message,
    t,
  ]);

  const shell = useEditorShell({
    entityType,
    entityId: entityUid,
    isDirty,
    onSave: handleSave,
    onDirtyChange,
    registerSaveRef,
  });

  const localInstanceId = useLocalInstanceId();

  const scriptsMark = SCRIPT_KINDS.filter((slot) => draft.scripts[slot].trim()).length;
  const settingsMark = definedSettingCount(draft.settings);
  const variablesMark = draft.variables.filter((v) => v.name.trim()).length;
  const sectionItems = useMemo(
    () => [
      { key: 'overview', label: <span>{t('workbench.editors.requestContainer.tab.overview')}</span> },
      {
        key: 'authorization',
        label: (
          <span>
            {t('workbench.editors.request.tab.authorization')}
            {authUnsaved ? <TabDot tone="unsaved" /> : draft.pool.auths.length > 0 ? <TabDot /> : null}
          </span>
        ),
      },
      {
        key: 'scripts',
        label: (
          <span>
            {t('workbench.editors.request.tab.scripts')}
            {scriptsMark > 0 ? (
              <TabCount n={scriptsMark} unsaved={scriptsUnsaved} />
            ) : scriptsUnsaved ? (
              <TabDot tone="unsaved" />
            ) : null}
          </span>
        ),
      },
      {
        key: 'settings',
        label: (
          <span>
            {t('workbench.editors.request.tab.settings')}
            {settingsMark > 0 ? (
              <TabCount n={settingsMark} unsaved={settingsUnsaved} />
            ) : settingsUnsaved ? (
              <TabDot tone="unsaved" />
            ) : null}
          </span>
        ),
      },
      ...(kind === 'collection'
        ? [
            {
              key: 'variables',
              label: (
                <span>
                  {t('workbench.overview.action.variables')}
                  {variablesMark > 0 ? (
                    <TabCount n={variablesMark} unsaved={variablesUnsaved} />
                  ) : variablesUnsaved ? (
                    <TabDot tone="unsaved" />
                  ) : null}
                </span>
              ),
            },
          ]
        : []),
    ],
    [
      t,
      kind,
      draft.pool.auths.length,
      authUnsaved,
      scriptsMark,
      scriptsUnsaved,
      settingsMark,
      settingsUnsaved,
      variablesMark,
      variablesUnsaved,
    ],
  );

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">
          {kind === 'collection'
            ? t('workbench.editors.ancestorAuth.notFoundCollection')
            : t('workbench.editors.ancestorAuth.notFoundFolder')}
        </Text>
      </div>
    );
  }

  const Glyph = kind === 'collection' ? FolderOpenOutlined : FolderOutlined;
  const headerTitle = (
    <>
      <Glyph style={{ fontSize: 13, color: token.colorTextTertiary }} />
      <Typography.Text strong style={{ fontSize: 13 }}>
        {entity.name}
      </Typography.Text>
      <PresenceBadge
        entityType={entityType}
        entityId={entityUid}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  const body = (() => {
    switch (activeSection) {
      case 'overview':
        return kind === 'collection' ? (
          <RequestCollectionOverview collectionUid={entityUid} {...overview} />
        ) : (
          <RequestFolderOverview folderUid={entityUid} {...overview} />
        );
      case 'authorization':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              boxSizing: 'border-box',
              padding: 24,
              overflow: 'auto',
            }}
          >
            <SuggestionContextProvider value={{ collectionId: suggestionCollectionId }}>
              <AuthPoolSection
                kind={kind}
                pool={draft.pool}
                onChange={(pool) => setDraft((d) => ({ ...d, pool }))}
                inherited={inherited}
                onOpenContainerAuth={onOpenContainerAuth}
              />
            </SuggestionContextProvider>
          </div>
        );
      case 'scripts':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              boxSizing: 'border-box',
              padding: 24,
            }}
          >
            <SuggestionContextProvider value={{ collectionId: suggestionCollectionId }}>
              <ScriptsTab
                scope="container"
                scripts={draft.scripts}
                unsaved={scriptsUnsavedSlots}
                onScriptChange={(slot, value) => setDraft((d) => ({ ...d, scripts: { ...d.scripts, [slot]: value } }))}
                workspaceId={workspaceId}
                onOpenPackageLibrary={onOpenPackageLibrary}
              />
            </SuggestionContextProvider>
          </div>
        );
      case 'settings':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              boxSizing: 'border-box',
              padding: 24,
              overflow: 'auto',
            }}
          >
            <SuggestionContextProvider value={{ collectionId: suggestionCollectionId }}>
              <SettingsSection
                settings={draft.settings}
                onChange={(settings) => setDraft((d) => ({ ...d, settings }))}
                unsaved={settingsUpdates}
                chain={settingsChain}
                onOpenSource={onOpenContainerSettings}
                workspaceId={workspaceId}
              />
            </SuggestionContextProvider>
          </div>
        );
      case 'variables':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <EntityConflictBanner count={conflictsUi.conflictCount} {...conflictsUi.banner} />
            <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: 24 }}>
              <div style={{ maxWidth: 920, margin: '0 auto' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  {t('workbench.variables.collection.descriptionRequest')}
                </Text>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
                  {t('workbench.variables.variablesCount', { count: variablesMark })}
                </Text>
                <VariableTable
                  variables={draft.variables}
                  onChange={setVariables}
                  allowSecrets={false}
                  rowPath={VARIABLE_PATHS.row}
                  conflictBridge={conflictsUi.conflictBridge}
                />
              </div>
            </div>
            <EntityConflictDialog language="json" {...conflictsUi.dialog} />
          </div>
        );
    }
  })();

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} shell={shell.headerProps} />
        <div style={{ padding: '8px 16px 0' }}>
          <Tabs
            size="small"
            activeKey={activeSection}
            onChange={(k) => switchSection(k as RequestContainerSection)}
            items={sectionItems}
            className="rules-request-tabs"
            tabBarStyle={{ marginBottom: 0 }}
            data-testid="oh-container-sections"
          />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{body}</div>
      </div>
    </EntityScopeProvider>
  );
};

export default RequestContainerEditor;
