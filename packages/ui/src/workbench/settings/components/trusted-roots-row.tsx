/**
 * Workspace trusted certificates — custom editor for
 * `requests.trustedRoots` on API Requests › TLS: the workspace's trust
 * list edited in place (the Trusted Roots plan). Certificate
 * authorities every TLS dial the workspace makes trusts in addition to
 * the runtime's bundled roots: synced, exported, public, never a
 * secret. Rows commit on the gesture like every other settings row —
 * add (paste → summary → Add, a leaf refused, a chain one root),
 * inline rename, remove. On a non-node host the block is read-only
 * with the honest caption: the browser dials with its own store.
 */

import { PlusOutlined } from '@ant-design/icons';
import type { TrustedRoot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isNodeRequestRuntime } from '@openheaders/ui/shared/device-trust';
import { useTrustedRootsMutator } from '@openheaders/ui/shared/hooks/mutators/useTrustedRootsMutator';
import { useTrustedRoots } from '@openheaders/ui/shared/hooks/readers/useTrustedRoots';
import { App, Button, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import AddTrustedRootPanel from '../../components/trusted-roots/AddTrustedRootPanel';
import CertificateTable from '../../components/trusted-roots/CertificateTable';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const SURFACE_ID = 'workbench';

const TrustedRootsRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const nodeHost = isNodeRequestRuntime();
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const roots = useTrustedRoots(workspaceId);
  const { addRoot, removeRoot, replaceRoots } = useTrustedRootsMutator({ workspaceId, surfaceId: SURFACE_ID });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const failed = useCallback(
    (result: { ok: boolean; message?: string }) => {
      const detail = 'message' in result && result.message ? result.message : null;
      message.error(
        detail
          ? t('workbench.trustedRoots.saveFailedDetail', { message: detail })
          : t('workbench.trustedRoots.saveFailed'),
      );
    },
    [message, t],
  );

  const handleAdd = useCallback(
    async (input: { name: string; certPem: string }) => {
      setBusy(true);
      const result = await addRoot(input);
      setBusy(false);
      if (!result.ok) {
        failed(result);
        return;
      }
      setAdding(false);
    },
    [addRoot, failed],
  );

  const handleRename = useCallback(
    async (uid: string, name: string) => {
      const next: TrustedRoot[] = roots.map((root) => (root.uid === uid ? { ...root, name } : root));
      const result = await replaceRoots(next, roots);
      if (!result.ok) failed(result);
    },
    [roots, replaceRoots, failed],
  );

  const handleRemove = useCallback(
    async (uid: string) => {
      const result = await removeRoot(uid);
      if (!result.ok) failed(result);
    },
    [removeRoot, failed],
  );

  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
            {t('workbench.trustedRoots.count', { count: roots.length })}
          </Text>
          <Button
            size="small"
            type={roots.length === 0 ? 'primary' : 'default'}
            icon={<PlusOutlined />}
            onClick={() => setAdding(true)}
            disabled={adding || !nodeHost || workspaceId === null}
            data-testid="trusted-root-add"
          >
            {t('workbench.trustedRoots.add')}
          </Button>
        </div>
        <CertificateTable
          certificates={roots}
          emptyTitle={t('workbench.trustedRoots.empty')}
          emptyHint={t('workbench.trustedRoots.emptyHint')}
          onRename={nodeHost ? (uid, name) => void handleRename(uid, name) : undefined}
          onRemove={nodeHost ? (uid) => void handleRemove(uid) : undefined}
        />
        {adding && (
          <AddTrustedRootPanel onAdd={(input) => void handleAdd(input)} onCancel={() => setAdding(false)} busy={busy} />
        )}
        {!nodeHost && (
          <Text type="secondary" style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {t('workbench.trustedRoots.settings.browserNote')}
          </Text>
        )}
      </div>
    </FieldRow>
  );
};

export default TrustedRootsRow;
