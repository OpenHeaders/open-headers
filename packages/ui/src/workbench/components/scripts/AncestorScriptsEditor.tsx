/**
 * AncestorScriptsEditor — tab body for a request collection's or
 * request folder's script slots (`preRequestScript` /
 * `postResponseScript`).
 *
 * Polymorphic over `kind` the same way {@link CollectionVariablesEditor}
 * is: 'collection' reads the collection off `useRequests().collections`
 * and saves through the request-collection write client; 'folder'
 * reads `useRequests().folders` and saves through the request-folder
 * write client. Everything else — dirty tracking (derived
 * form-vs-canonical via `useReprime`), the shared two-pane
 * {@link ScriptsTab} editor, presence — is identical.
 *
 * The slots compose ancestor-first at send time: collection pre →
 * folder pre → request pre (same order post-response). Empty editors
 * persist as ABSENT fields (field absent ↔ no script), matching the
 * request save flow's rule.
 */

import type { Collection } from '@openheaders/core/types';
import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { PersistedLocalFolder } from '@openheaders/core/storage';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { applyRequestCollectionSetScripts } from '@openheaders/ui/shared/sync/request-collection-write-client';
import { applyRequestFolderSetScripts } from '@openheaders/ui/shared/sync/request-folder-write-client';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import ScriptsTab from '../request-editor/ScriptsTab';
import { SuggestionContextProvider } from '../template-input';
import EditorHeader from '../shell/EditorHeader';

const { Text } = Typography;

export type AncestorScriptsKind = 'collection' | 'folder';

interface AncestorScriptsEditorProps {
  kind: AncestorScriptsKind;
  /** Request-collection uid or request-folder uid, per `kind`. */
  entityUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Open the Package Library tab (ScriptsTab's Packages popover footer). */
  onOpenPackageLibrary?: () => void;
}

interface ScriptsDraft {
  pre: string;
  post: string;
}

interface ScriptSlotEntity {
  uid: string;
  name: string;
  path: string;
  preRequestScript?: string;
  postResponseScript?: string;
}

function scriptsSignature(entity: { preRequestScript?: string; postResponseScript?: string }): string {
  return stableStringify({ pre: entity.preRequestScript ?? '', post: entity.postResponseScript ?? '' });
}

/** Editor value → persisted slot: whitespace-only means "no script". */
function slotValue(source: string): string | undefined {
  return source.trim() ? source : undefined;
}

const AncestorScriptsEditor: React.FC<AncestorScriptsEditorProps> = ({
  kind,
  entityUid,
  onDirtyChange,
  registerSaveRef,
  onOpenPackageLibrary,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const t = useT();
  const { collections, folders } = useRequests();
  const { activeWorkspaceId: workspaceId } = useRules();

  const entity: ScriptSlotEntity | null = useMemo(() => {
    if (kind === 'collection') return collections.find((c: Collection) => c.uid === entityUid) ?? null;
    return folders.find((f: PersistedLocalFolder) => f.uid === entityUid) ?? null;
  }, [kind, collections, folders, entityUid]);

  // The template-suggestion scope: the collection itself, or the
  // folder's owning collection by path prefix.
  const suggestionCollectionId = useMemo(() => {
    if (!entity) return undefined;
    if (kind === 'collection') return entity.uid;
    return collections.find((c: Collection) => entity.path.startsWith(`${c.path}/`))?.uid;
  }, [kind, entity, collections]);

  const entityType = kind === 'collection' ? REQUEST_COLLECTION_ENTITY_TYPE : REQUEST_FOLDER_ENTITY_TYPE;

  const [draft, setDraft] = useState<ScriptsDraft>(() => ({
    pre: entity?.preRequestScript ?? '',
    post: entity?.postResponseScript ?? '',
  }));
  const formFingerprint = useMemo(() => stableStringify({ pre: draft.pre, post: draft.post }), [draft]);

  const reprime = useReprime<ScriptSlotEntity>({
    liveEntity: entity,
    scope: { entityType, entityId: entityUid },
    enabled: entity !== null,
    formFingerprint,
    signature: scriptsSignature,
    populate: (e) => setDraft({ pre: e.preRequestScript ?? '', post: e.postResponseScript ?? '' }),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(() => {
    if (!entity || !isDirty || !workspaceId) return;
    const updates = [
      { path: 'preRequestScript' as const, value: slotValue(draft.pre) },
      { path: 'postResponseScript' as const, value: slotValue(draft.post) },
    ];
    const apply =
      kind === 'collection'
        ? applyRequestCollectionSetScripts(
            { collectionUid: entity.uid, updates },
            { workspaceId, surfaceId: 'workbench' },
          )
        : applyRequestFolderSetScripts({ folderUid: entity.uid, updates }, { workspaceId, surfaceId: 'workbench' });
    void apply.then((result) => {
      // Dirty derives from form-vs-canonical equality; the post-save
      // broadcast brings them into alignment automatically.
      if (result.ok) return;
      if (result.reason === 'not-found') {
        message.error(t('workbench.editors.ancestorScripts.deletedElsewhere'));
        return;
      }
      const detail = 'message' in result ? result.message : undefined;
      message.error(
        detail
          ? t('workbench.editors.ancestorScripts.saveFailedDetail', { message: detail })
          : t('workbench.editors.ancestorScripts.saveFailed'),
      );
    });
  }, [entity, isDirty, workspaceId, draft, kind, message, t]);

  const shell = useEditorShell({
    entityType,
    entityId: entityUid,
    isDirty,
    onSave: handleSave,
    onDirtyChange,
    registerSaveRef,
  });

  const localInstanceId = useLocalInstanceId();

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">
          {kind === 'collection'
            ? t('workbench.editors.ancestorScripts.notFoundCollection')
            : t('workbench.editors.ancestorScripts.notFoundFolder')}
        </Text>
      </div>
    );
  }

  const headerTitle = (
    <>
      <Typography.Text strong style={{ fontSize: 13 }}>
        {kind === 'collection'
          ? t('workbench.editors.ancestorScripts.titleCollection', { name: entity.name })
          : t('workbench.editors.ancestorScripts.titleFolder', { name: entity.name })}
      </Typography.Text>
      <PresenceBadge
        entityType={entityType}
        entityId={entityUid}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} shell={shell.headerProps} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
            gap: 16,
          }}
        >
          <Text type="secondary">
            {kind === 'collection'
              ? t('workbench.editors.ancestorScripts.descriptionCollection')
              : t('workbench.editors.ancestorScripts.descriptionFolder')}
          </Text>
          <SuggestionContextProvider value={{ collectionId: suggestionCollectionId }}>
            <ScriptsTab
              preRequestScript={draft.pre}
              postResponseScript={draft.post}
              onPreRequestChange={(v) => setDraft((d) => ({ ...d, pre: v }))}
              onPostResponseChange={(v) => setDraft((d) => ({ ...d, post: v }))}
              workspaceId={workspaceId}
              onOpenPackageLibrary={onOpenPackageLibrary}
            />
          </SuggestionContextProvider>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default AncestorScriptsEditor;
