/**
 * GenerateWsCollectionModal — the AsyncAPI spec editor's Generate
 * Collection action (WEBSOCKET_CLIENT_PLAN.md Phase F, ratified GO),
 * the asyncapi twin of {@link GenerateProtoCollectionModal}.
 *
 * Walks the plan from `ws-collection-plan.ts`: create the collection,
 * one WebSocketRequest per censused operation (flat landing — channel
 * grouping has no folder precedent worth minting yet), then record the
 * collection's `specLink` ({specUid, sourceHash} — the root file's
 * saved-content hash, the same identity the drift judge compares
 * against). Write-path failures count into an honest partial toast;
 * skipped operations surface as warnings while what resolved still
 * generates.
 */

import { ImportOutlined } from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { Spec } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { buildWsCollectionPlan, type WsCollectionPlan } from './ws-collection-plan';

interface GenerateWsCollectionModalProps {
  open: boolean;
  spec: Spec;
  /** Saved canonical root-file source — hashed into the specLink. */
  content: string;
  /** The editor buffer has unsaved changes — surfaces the hint that
   *  generation reads the saved document. */
  editorDirty: boolean;
  onCancel: () => void;
  onGenerated?: (collectionUid: string) => void;
}

const GenerateWsCollectionModal: React.FC<GenerateWsCollectionModalProps> = ({
  open,
  spec,
  content,
  editorDirty,
  onCancel,
  onGenerated,
}) => {
  const { message } = AntApp.useApp();
  const t = useT();
  const requestsApi = useRequests();

  const [plan, setPlan] = useState<WsCollectionPlan | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(buildWsCollectionPlan(spec));
    setName(spec.name);
    setBusy(false);
  }, [open, spec]);

  const canGenerate = plan !== null && plan.requests.length > 0 && !busy && name.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (plan === null || plan.requests.length === 0 || busy) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    try {
      const sourceHash = await hashImportSource(content);
      const coll = await requestsApi.createCollection(trimmed);
      if (!coll) {
        message.error(t('workbench.editors.spec.generate.failed'));
        return;
      }
      let created = 0;
      let failed = 0;
      for (const request of plan.requests) {
        const landed = await requestsApi.createWebSocketRequest({
          name: request.name,
          parentPath: coll.path,
          seed: request.seed,
        });
        if (landed) created++;
        else failed++;
      }
      const linked = await requestsApi.setCollectionSpecLink(coll.uid, { specUid: spec.uid, sourceHash });
      if (!linked) {
        message.warning(t('workbench.editors.spec.generate.linkFailed'));
      }
      if (failed > 0) {
        message.warning(t('workbench.editors.spec.generateWs.partial', { created, failed }));
      } else {
        message.success(
          t('workbench.editors.spec.generate.success', {
            name: trimmed,
            summary: t('workbench.editors.spec.generateWs.requestsCount', { count: created }),
          }),
        );
      }
      onGenerated?.(coll.uid);
      onCancel();
    } catch (err) {
      message.error(`${t('workbench.editors.spec.generate.failed')} ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [plan, busy, name, content, requestsApi, spec.uid, message, t, onGenerated, onCancel]);

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {t('workbench.editors.spec.generate.modalTitle')}
        </span>
      }
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel} size="small" disabled={busy}>
            {t('shared.action.cancel')}
          </Button>
          <Tooltip title={canGenerate ? undefined : t('workbench.editors.spec.generate.nameRequired')}>
            <span>
              <Button
                type="primary"
                size="small"
                icon={<ImportOutlined />}
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                loading={busy}
                data-testid="spec-generate-confirm"
              >
                {t('workbench.editors.spec.generate.action')}
              </Button>
            </span>
          </Tooltip>
        </div>
      }
      width={640}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        {t('workbench.editors.spec.generateWs.blurb')}
      </Typography.Paragraph>

      {editorDirty && (
        <Alert
          type="info"
          showIcon
          message={t('workbench.editors.spec.generate.dirtyHint')}
          style={{ marginBottom: 12 }}
        />
      )}

      {plan !== null && plan.parseError !== null && (
        <Alert
          type="warning"
          showIcon
          message={t('workbench.editors.websocket.spec.parseFailure', { message: plan.parseError })}
          style={{ marginBottom: 12 }}
        />
      )}

      {plan !== null && plan.parseError === null && plan.server === null && (
        <Alert
          type="warning"
          showIcon
          message={t('workbench.editors.spec.generateWs.noWsServer')}
          style={{ marginBottom: 12 }}
          data-testid="spec-generate-ws-no-server"
        />
      )}

      {plan !== null && plan.server !== null && plan.requests.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message={t('workbench.editors.spec.generateWs.empty')}
          style={{ marginBottom: 12 }}
          data-testid="spec-generate-ws-empty"
        />
      )}

      {plan !== null && plan.requests.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Input
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={() => void handleGenerate()}
            placeholder={t('workbench.editors.spec.generate.namePlaceholder')}
            style={{ fontSize: 12, maxWidth: 280 }}
            data-testid="spec-generate-name"
          />
          <Space size={6} wrap>
            <Tag>{t('workbench.editors.spec.generateWs.requestsCount', { count: plan.requests.length })}</Tag>
            {plan.server !== null && <Tag>{plan.server.protocol ?? 'ws'}</Tag>}
          </Space>
        </div>
      )}

      {plan !== null &&
        plan.skipped.map((entry) => (
          <Alert
            key={entry.operation}
            type="warning"
            showIcon
            message={t('workbench.editors.spec.generateWs.skipped', {
              operation: entry.operation,
              reason: entry.reason,
            })}
            style={{ marginTop: 8 }}
          />
        ))}
    </Modal>
  );
};

export default GenerateWsCollectionModal;
