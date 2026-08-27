/**
 * TrustedRootsEditor — singleton tab body for the workspace's trust
 * list (the Trusted Roots plan §UI). Certificate authorities every TLS
 * dial the workspace makes trusts in addition to the runtime's bundled
 * roots: synced, public, never a secret.
 *
 * Draft editor with the Vault anatomy: the table is the draft, add /
 * rename / remove edit it in place, dirty derives from draft-vs-
 * canonical equality (`useReprime`), and Save commits one set diff
 * through `replaceRoots`. That draft is the local-before-remote
 * boundary — a root under test dials from this device only until
 * Save publishes it to every peer of the workspace.
 *
 * Awareness through `useEditorShell` pinned to the singleton id; no
 * per-field focus (rows are opaque PEM blobs).
 */

import { PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID } from '@openheaders/core/sync';
import type { TrustedRoot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { mintTrustedRoot } from '@openheaders/ui/shared/sync/trusted-roots-write-client';
import { Alert, App, Button, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTrustedRootsMutator } from '../../../shared/hooks/mutators/useTrustedRootsMutator';
import { useTrustedRoots } from '../../../shared/hooks/readers/useTrustedRoots';
import EditorHeader from '../shell/EditorHeader';
import AddTrustedRootPanel from './AddTrustedRootPanel';
import TrustedRootRow, { ROOT_GRID_COLUMNS } from './TrustedRootRow';

const { Text } = Typography;

const SURFACE_ID = 'workbench';

interface TrustedRootsEditorProps {
  workspaceId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

interface TrustedRootsEntity {
  roots: TrustedRoot[];
}

function rootsSignature(roots: readonly TrustedRoot[]): string {
  return stableStringify(roots);
}

const TrustedRootsEditor: React.FC<TrustedRootsEditorProps> = ({ workspaceId, onDirtyChange, registerSaveRef }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const roots = useTrustedRoots(workspaceId);
  const { replaceRoots } = useTrustedRootsMutator({ workspaceId, surfaceId: SURFACE_ID });

  const [draft, setDraft] = useState<TrustedRoot[]>(roots);
  const [adding, setAdding] = useState(false);
  const formFingerprint = useMemo(() => rootsSignature(draft), [draft]);
  const liveEntity = useMemo<TrustedRootsEntity>(() => ({ roots }), [roots]);

  const reprime = useReprime<TrustedRootsEntity>({
    liveEntity,
    scope: { entityType: TRUSTED_ROOTS_ENTITY_TYPE, entityId: TRUSTED_ROOTS_ID },
    enabled: workspaceId !== null,
    formFingerprint,
    signature: (e) => rootsSignature(e.roots),
    populate: (e) => setDraft(e.roots),
  });
  const isDirty = reprime.isDirty;

  const handleAdd = useCallback((input: { name: string; certPem: string }) => {
    setDraft((prev) => [...prev, mintTrustedRoot(input)]);
    setAdding(false);
  }, []);

  const handleRename = useCallback((uid: string, name: string) => {
    setDraft((prev) => prev.map((root) => (root.uid === uid ? { ...root, name } : root)));
  }, []);

  const handleRemove = useCallback((uid: string) => {
    setDraft((prev) => prev.filter((root) => root.uid !== uid));
  }, []);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const result = await replaceRoots(draft, roots);
    if (result.ok) return;
    const detail = 'message' in result && result.message ? result.message : null;
    message.error(
      detail
        ? t('workbench.trustedRoots.saveFailedDetail', { message: detail })
        : t('workbench.trustedRoots.saveFailed'),
    );
  }, [isDirty, draft, roots, replaceRoots, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: TRUSTED_ROOTS_ENTITY_TYPE,
    entityId: TRUSTED_ROOTS_ID,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
    options: { disableFieldFocus: true },
  });

  const localInstanceId = useLocalInstanceId();

  const headerTitle = (
    <>
      <SafetyCertificateOutlined style={{ fontSize: 14, color: token.colorTextSecondary }} />
      <Typography.Text strong style={{ fontSize: 13 }}>
        {t('workbench.trustedRoots.title')}
      </Typography.Text>
      <PresenceBadge
        entityType={TRUSTED_ROOTS_ENTITY_TYPE}
        entityId={TRUSTED_ROOTS_ID}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  const headerCell = (label: string) => (
    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
      {label}
    </Text>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} shell={shell.headerProps} />
        <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert type="info" showIcon message={t('workbench.trustedRoots.description')} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                {t('workbench.trustedRoots.count', { count: draft.length })}
              </Text>
              <Button
                type={draft.length === 0 ? 'primary' : 'default'}
                icon={<PlusOutlined />}
                onClick={() => setAdding(true)}
                disabled={adding}
                data-testid="trusted-root-add"
              >
                {t('workbench.trustedRoots.add')}
              </Button>
            </div>

            <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: ROOT_GRID_COLUMNS,
                  gap: 12,
                  padding: '6px 12px',
                  background: token.colorFillQuaternary,
                }}
              >
                {headerCell(t('workbench.trustedRoots.header.name'))}
                {headerCell(t('workbench.trustedRoots.header.subject'))}
                {headerCell(t('workbench.trustedRoots.header.fingerprint'))}
                {headerCell(t('workbench.trustedRoots.header.expires'))}
                <span />
              </div>
              {draft.length === 0 ? (
                <div
                  data-testid="trusted-roots-empty"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '16px 12px',
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <Text>{t('workbench.trustedRoots.empty')}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('workbench.trustedRoots.emptyHint')}
                  </Text>
                </div>
              ) : (
                draft.map((root) => (
                  <TrustedRootRow key={root.uid} root={root} onRename={handleRename} onRemove={handleRemove} />
                ))
              )}
            </div>

            {adding && <AddTrustedRootPanel onAdd={handleAdd} onCancel={() => setAdding(false)} />}
          </div>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default TrustedRootsEditor;
