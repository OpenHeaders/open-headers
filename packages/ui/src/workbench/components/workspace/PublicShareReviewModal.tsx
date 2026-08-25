/**
 * PublicShareReviewModal — the review moment of the public snapshot
 * plane (the access-foundation plan §8 F5b, decision d): before a
 * snapshot is shared (or re-shared) publicly, the owner eyeballs a
 * per-category summary computed server-side from the EXACT projection
 * a confirm would store — variables listed name+value (secret-typed
 * rows name-only), coarse entity counts, and a note on what the
 * content contract strips. Confirm runs the publish verb; the server
 * re-gates regardless.
 *
 * Wording law: "Share publicly", never "Publish" — that verb belongs
 * to the duplicate-into-Org flow on the WorkspaceManager row.
 */

import type { PublicWorkspaceSnapshotSummary } from '@openheaders/core/protocol';
import type { WorkspacePublicShareApi } from '@openheaders/core/capabilities';
import type { MessageKey } from '@openheaders/i18n';
import { Alert, App as AntApp, Button, Modal, Spin, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

interface CategoryRow {
  labelKey: MessageKey;
  countKeys: readonly string[];
}

// Coarse review categories over the snapshot's own array names — the
// summary omits zero-count keys, so absent keys simply contribute 0.
const CATEGORY_ROWS: readonly CategoryRow[] = [
  { labelKey: 'workbench.workspace.publicShare.cat.requests', countKeys: ['requests', 'grpcRequests', 'websocketRequests', 'mqttRequests'] },
  { labelKey: 'workbench.workspace.publicShare.cat.collections', countKeys: ['collections', 'requestCollections', 'templateCollections'] },
  { labelKey: 'workbench.workspace.publicShare.cat.folders', countKeys: ['folders', 'requestFolders', 'templateFolders'] },
  { labelKey: 'workbench.workspace.publicShare.cat.rules', countKeys: ['rules'] },
  { labelKey: 'workbench.workspace.publicShare.cat.environments', countKeys: ['environments'] },
  {
    labelKey: 'workbench.workspace.publicShare.cat.examples',
    countKeys: ['responseExamples', 'grpcResponseExamples', 'wsResponseExamples', 'mqttResponseExamples'],
  },
  { labelKey: 'workbench.workspace.publicShare.cat.specs', countKeys: ['specs'] },
  { labelKey: 'workbench.workspace.publicShare.cat.scripts', countKeys: ['scriptPackages'] },
  { labelKey: 'workbench.workspace.publicShare.cat.templates', countKeys: ['templates'] },
  { labelKey: 'workbench.workspace.publicShare.cat.live', countKeys: ['liveWorkflows', 'liveVariables'] },
  { labelKey: 'workbench.workspace.publicShare.cat.files', countKeys: ['files'] },
];

const SCOPE_LABELS: Record<'workspace' | 'environment' | 'collection', MessageKey> = {
  workspace: 'workbench.workspace.publicShare.scope.workspace',
  environment: 'workbench.workspace.publicShare.scope.environment',
  collection: 'workbench.workspace.publicShare.scope.collection',
};

export interface PublicShareReviewModalProps {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  /** True when a publication already stands — the confirm replaces it in place. */
  isUpdate: boolean;
  api: WorkspacePublicShareApi;
  onClose: () => void;
  /** Fired after a successful share so the caller re-reads the status. */
  onShared: () => void;
}

const PublicShareReviewModal: React.FC<PublicShareReviewModalProps> = ({
  open,
  workspaceId,
  workspaceName,
  isUpdate,
  api,
  onClose,
  onShared,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [summary, setSummary] = useState<PublicWorkspaceSnapshotSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSummary(null);
    setError(null);
    void api
      .preview(workspaceId)
      .catch(() => null)
      .then((result) => {
        if (!result || !result.ok || !result.summary) {
          setError(result?.error ?? t('workbench.workspace.publicShare.previewFailed'));
          return;
        }
        setSummary(result.summary);
      });
  }, [open, workspaceId, api, t]);

  const share = async (): Promise<void> => {
    setSharing(true);
    try {
      const result = await api.publish(workspaceId).catch(() => null);
      if (!result || !result.ok) {
        message.error(result?.error ?? t('workbench.workspace.publicShare.shareFailed'));
        return;
      }
      message.success(t('workbench.workspace.publicShare.sharedToast'));
      onShared();
      onClose();
    } finally {
      setSharing(false);
    }
  };

  const renderSummary = (loaded: PublicWorkspaceSnapshotSummary): React.ReactNode => {
    const counts = CATEGORY_ROWS.map((row) => ({
      labelKey: row.labelKey,
      count: row.countKeys.reduce((sum, key) => sum + (loaded.entityCounts[key] ?? 0), 0),
    })).filter((row) => row.count > 0);
    return (
      <>
        <Text style={{ display: 'block', marginBottom: 12 }}>{t('workbench.workspace.publicShare.reviewIntro')}</Text>
        {isUpdate && (
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            {t('workbench.workspace.publicShare.reviewUpdateNote')}
          </Text>
        )}
        <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
          {t('workbench.workspace.publicShare.reviewContents')}
        </Text>
        {counts.length === 0 ? (
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            {t('workbench.workspace.publicShare.reviewEmpty')}
          </Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {counts.map((row) => (
              <Tag key={row.labelKey} style={{ marginInlineEnd: 0 }}>
                {t(row.labelKey, { count: row.count })}
              </Tag>
            ))}
          </div>
        )}
        <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
          {t('workbench.workspace.publicShare.reviewVariables', { count: loaded.variables.length })}
        </Text>
        {loaded.variables.length === 0 ? (
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            {t('workbench.workspace.publicShare.reviewNoVariables')}
          </Text>
        ) : (
          <div
            data-testid="public-share-review-variables"
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadius,
              padding: '4px 8px',
              marginBottom: 12,
            }}
          >
            {loaded.variables.map((row, index) => (
              <div
                key={`${row.scope}:${row.container ?? ''}:${row.name}:${index}`}
                style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '2px 0', minWidth: 0 }}
              >
                <Tag style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                  {row.container !== null ? `${t(SCOPE_LABELS[row.scope])}: ${row.container}` : t(SCOPE_LABELS[row.scope])}
                </Tag>
                <Text style={{ fontFamily: token.fontFamilyCode, fontSize: 12, flexShrink: 0 }}>{row.name}</Text>
                {row.secret ? (
                  <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                    {t('workbench.workspace.publicShare.reviewValueHidden')}
                  </Text>
                ) : (
                  <Text
                    type="secondary"
                    style={{
                      fontFamily: token.fontFamilyCode,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                    title={row.value}
                  >
                    {row.value}
                  </Text>
                )}
              </div>
            ))}
          </div>
        )}
        <Alert
          type="info"
          showIcon
          message={
            loaded.secretValuesStripped > 0
              ? `${t('workbench.workspace.publicShare.reviewStripped')} ${t(
                  'workbench.workspace.publicShare.reviewStrippedCount',
                  { count: loaded.secretValuesStripped },
                )}`
              : t('workbench.workspace.publicShare.reviewStripped')
          }
        />
      </>
    );
  };

  return (
    <Modal
      open={open}
      title={t('workbench.workspace.publicShare.reviewTitle', { name: workspaceName })}
      onCancel={onClose}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('workbench.workspace.cancel')}
        </Button>,
        <Button
          key="share"
          type="primary"
          loading={sharing}
          disabled={summary === null}
          data-testid="public-share-confirm"
          onClick={() => void share()}
        >
          {t('workbench.workspace.publicShare.confirmShare')}
        </Button>,
      ]}
    >
      {error !== null ? (
        <Text type="danger">{error}</Text>
      ) : summary === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : (
        renderSummary(summary)
      )}
    </Modal>
  );
};

export default PublicShareReviewModal;
