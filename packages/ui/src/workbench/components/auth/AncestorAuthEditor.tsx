/**
 * AncestorAuthEditor — tab body for a request collection's or request
 * folder's default auth (`auth`).
 *
 * Mirrors {@link AncestorScriptsEditor}: polymorphic over `kind`
 * ('collection' reads `useRequests().collections` and saves through
 * the request-collection write client; 'folder' reads
 * `useRequests().folders` and saves through the request-folder write
 * client), derived-dirty via `useReprime`, presence, and the shared
 * {@link AuthorizationTab} form.
 *
 * At send time a request whose auth is `inherit` resolves up the
 * ancestor chain: the innermost carrier whose auth is set (and not
 * itself `inherit`) wins — folder beats collection; `none` is a real
 * carrier ("no auth"). Picking Inherit here persists the field ABSENT
 * (field absent ↔ transparent level), matching the script slots'
 * "field absent ↔ no script" rule.
 */

import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { PersistedLocalFolder } from '@openheaders/core/storage';
import type { AuthConfig, Collection } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { applyRequestCollectionSetAuth } from '@openheaders/ui/shared/sync/request-collection-write-client';
import { applyRequestFolderSetAuth } from '@openheaders/ui/shared/sync/request-folder-write-client';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import AuthorizationTab from '../request-editor/AuthorizationTab';
import EditorHeader from '../shell/EditorHeader';
import { SuggestionContextProvider } from '../template-input';

const { Text } = Typography;

export type AncestorAuthKind = 'collection' | 'folder';

interface AncestorAuthEditorProps {
  kind: AncestorAuthKind;
  /** Request-collection uid or request-folder uid, per `kind`. */
  entityUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

interface AuthSlotEntity {
  uid: string;
  name: string;
  path: string;
  auth?: AuthConfig;
}

/** Absent field renders — and compares — as the Inherit choice. */
const TRANSPARENT: AuthConfig = { type: 'inherit' };

function authSignature(entity: { auth?: AuthConfig }): string {
  return stableStringify(entity.auth ?? TRANSPARENT);
}

const AncestorAuthEditor: React.FC<AncestorAuthEditorProps> = ({ kind, entityUid, onDirtyChange, registerSaveRef }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const t = useT();
  const { collections, folders } = useRequests();
  const { activeWorkspaceId: workspaceId } = useRules();

  const entity: AuthSlotEntity | null = useMemo(() => {
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

  const [draft, setDraft] = useState<AuthConfig>(() => entity?.auth ?? TRANSPARENT);
  const formFingerprint = useMemo(() => stableStringify(draft), [draft]);

  const reprime = useReprime<AuthSlotEntity>({
    liveEntity: entity,
    scope: { entityType, entityId: entityUid },
    enabled: entity !== null,
    formFingerprint,
    signature: authSignature,
    populate: (e) => setDraft(e.auth ?? TRANSPARENT),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(() => {
    if (!entity || !isDirty || !workspaceId) return;
    // Inherit at an ancestor level means "nothing configured here" —
    // the field persists ABSENT so the chain walk passes through.
    const auth = draft.type === 'inherit' ? undefined : draft;
    const apply =
      kind === 'collection'
        ? applyRequestCollectionSetAuth({ collectionUid: entity.uid, auth }, { workspaceId, surfaceId: 'workbench' })
        : applyRequestFolderSetAuth({ folderUid: entity.uid, auth }, { workspaceId, surfaceId: 'workbench' });
    void apply.then((result) => {
      // Dirty derives from form-vs-canonical equality; the post-save
      // broadcast brings them into alignment automatically.
      if (result.ok) return;
      if (result.reason === 'not-found') {
        message.error(t('workbench.editors.ancestorAuth.deletedElsewhere'));
        return;
      }
      const detail = 'message' in result ? result.message : undefined;
      message.error(
        detail
          ? t('workbench.editors.ancestorAuth.saveFailedDetail', { message: detail })
          : t('workbench.editors.ancestorAuth.saveFailed'),
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
            ? t('workbench.editors.ancestorAuth.notFoundCollection')
            : t('workbench.editors.ancestorAuth.notFoundFolder')}
        </Text>
      </div>
    );
  }

  const headerTitle = (
    <>
      <Typography.Text strong style={{ fontSize: 13 }}>
        {kind === 'collection'
          ? t('workbench.editors.ancestorAuth.titleCollection', { name: entity.name })
          : t('workbench.editors.ancestorAuth.titleFolder', { name: entity.name })}
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
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
            gap: 16,
          }}
        >
          <Text type="secondary">
            {kind === 'collection'
              ? t('workbench.editors.ancestorAuth.descriptionCollection')
              : t('workbench.editors.ancestorAuth.descriptionFolder')}
          </Text>
          <SuggestionContextProvider value={{ collectionId: suggestionCollectionId }}>
            <AuthorizationTab auth={draft} onChange={setDraft} />
          </SuggestionContextProvider>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default AncestorAuthEditor;
