/**
 * TrustedRootsEditor — singleton tab body for the workspace's trust
 * list (the Trusted Roots plan §UI). Certificate authorities every TLS
 * dial the workspace makes trusts in addition to the runtime's bundled
 * roots: synced, public, never a secret.
 *
 * Immediate-commit list, not a draft: rows are opaque PEM blobs nobody
 * edits in place, so add / remove go straight through the write client
 * and the mirror's broadcast brings the row back. Nothing to save —
 * the header mounts without a shell and no dirty state exists.
 */

import { PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { App, Button, Empty, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTrustedRootsMutator } from '../../../shared/hooks/mutators/useTrustedRootsMutator';
import { useTrustedRoots } from '../../../shared/hooks/readers/useTrustedRoots';
import EditorHeader from '../shell/EditorHeader';
import AddTrustedRootPanel from './AddTrustedRootPanel';
import TrustedRootRow, { ROOT_GRID_COLUMNS } from './TrustedRootRow';

const { Text } = Typography;

const SURFACE_ID = 'workbench';

interface TrustedRootsEditorProps {
  workspaceId: string | null;
}

const TrustedRootsEditor: React.FC<TrustedRootsEditorProps> = ({ workspaceId }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const roots = useTrustedRoots(workspaceId);
  const { addRoot, removeRoot } = useTrustedRootsMutator({ workspaceId, surfaceId: SURFACE_ID });
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(
    async (input: { name: string; certPem: string }) => {
      const result = await addRoot(input);
      if (result.ok) {
        message.success(t('workbench.trustedRoots.added'));
        setAdding(false);
        return;
      }
      const detail = 'message' in result && result.message ? result.message : null;
      message.error(
        detail ? `${t('workbench.trustedRoots.addFailed')}: ${detail}` : t('workbench.trustedRoots.addFailed'),
      );
    },
    [addRoot, message, t],
  );

  const handleRemove = useCallback(
    async (uid: string) => {
      const result = await removeRoot(uid);
      if (result.ok) {
        message.success(t('workbench.trustedRoots.removed'));
        return;
      }
      message.error(t('workbench.trustedRoots.removeFailed'));
    },
    [removeRoot, message, t],
  );

  const headerTitle = (
    <>
      <SafetyCertificateOutlined style={{ fontSize: 14, color: token.colorTextSecondary }} />
      <Typography.Text strong style={{ fontSize: 13 }}>
        {t('workbench.trustedRoots.title')}
      </Typography.Text>
    </>
  );

  const addButton = (
    <Button
      type={roots.length === 0 ? 'primary' : 'default'}
      icon={<PlusOutlined />}
      onClick={() => setAdding(true)}
      disabled={adding}
      data-testid="trusted-root-add"
    >
      {t('workbench.trustedRoots.add')}
    </Button>
  );

  const headerCell = (label: string) => (
    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
      {label}
    </Text>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={headerTitle} />
      <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: 24 }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text type="secondary">{t('workbench.trustedRoots.description')}</Text>

          {adding && (
            <AddTrustedRootPanel onAdd={(input) => void handleAdd(input)} onCancel={() => setAdding(false)} />
          )}

          {roots.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Text>{t('workbench.trustedRoots.empty')}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('workbench.trustedRoots.emptyHint')}
                  </Text>
                </div>
              }
            >
              {addButton}
            </Empty>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                  {t('workbench.trustedRoots.count', { count: roots.length })}
                </Text>
                {addButton}
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
                {roots.map((root) => (
                  <TrustedRootRow key={root.uid} root={root} onRemove={(uid) => void handleRemove(uid)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrustedRootsEditor;
