/**
 * GenerateProtoCollectionModal — the Protobuf spec editor's Generate
 * Collection action (the gRPC-client plan Phase G), the proto twin of
 * {@link GenerateCollectionModal}.
 *
 * The OpenAPI flow rides the import machinery (parse → sectioned
 * landing loop → HTTP request seeds); rpcs have no such import shape,
 * so this modal walks its own plan (`proto-collection-plan.ts`):
 * create the collection, one folder per service when the spec declares
 * more than one, one GrpcRequest per rpc with the example message
 * pre-filled, then record the collection's `specLink`
 * ({specUid, sourceHash} — the root file's saved-content hash, the
 * same identity the drift judge compares against). Write-path failures
 * count into an honest partial toast; unparseable files surface as
 * warnings while what resolved still generates.
 */

import { ImportOutlined } from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { Spec } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { buildProtoCollectionPlan, type ProtoCollectionPlan } from './proto-collection-plan';

interface GenerateProtoCollectionModalProps {
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

const GenerateProtoCollectionModal: React.FC<GenerateProtoCollectionModalProps> = ({
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

  const [plan, setPlan] = useState<ProtoCollectionPlan | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(buildProtoCollectionPlan(spec));
    setName(spec.name);
    setBusy(false);
  }, [open, spec]);

  const canGenerate = plan !== null && plan.methodCount > 0 && !busy && name.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (plan === null || plan.methodCount === 0 || busy) return;
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
      for (const service of plan.services) {
        let parentPath = coll.path;
        if (plan.services.length > 1) {
          const folder = await requestsApi.createFolder(service.service, coll.path);
          if (folder) parentPath = folder.path;
          else failed++;
        }
        for (const request of service.requests) {
          const landed = await requestsApi.createGrpcRequest({ name: request.name, parentPath, seed: request.seed });
          if (landed) created++;
          else failed++;
        }
      }
      const linked = await requestsApi.setCollectionSpecLink(coll.uid, { specUid: spec.uid, sourceHash });
      if (!linked) {
        message.warning(t('workbench.editors.spec.generate.linkFailed'));
      }
      if (failed > 0) {
        message.warning(t('workbench.editors.spec.generateProto.partial', { created, failed }));
      } else {
        message.success(
          t('workbench.editors.spec.generate.success', {
            name: trimmed,
            summary: t('workbench.editors.spec.generateProto.requestsCount', { count: created }),
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
        {t('workbench.editors.spec.generateProto.blurb')}
      </Typography.Paragraph>

      {editorDirty && (
        <Alert
          type="info"
          showIcon
          message={t('workbench.editors.spec.generate.dirtyHint')}
          style={{ marginBottom: 12 }}
        />
      )}

      {plan !== null && plan.methodCount === 0 && (
        <Alert
          type="warning"
          showIcon
          message={t('workbench.editors.spec.generateProto.empty')}
          style={{ marginBottom: 12 }}
          data-testid="spec-generate-proto-empty"
        />
      )}

      {plan !== null && plan.methodCount > 0 && (
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
            <Tag>{t('workbench.editors.spec.generateProto.requestsCount', { count: plan.methodCount })}</Tag>
            <Tag>{t('workbench.editors.spec.generateProto.servicesCount', { count: plan.services.length })}</Tag>
          </Space>
        </div>
      )}

      {plan !== null &&
        plan.parseFailures.map((failure) => (
          <Alert
            key={failure.path}
            type="warning"
            showIcon
            message={t('workbench.editors.grpc.spec.parseFailure', { path: failure.path, message: failure.message })}
            style={{ marginTop: 8 }}
          />
        ))}
    </Modal>
  );
};

export default GenerateProtoCollectionModal;
