/**
 * GenerateCollectionModal — the spec editor's Generate Collection
 * action (the API-specs plan Phase E).
 *
 * Generation reuses the import machinery wholesale (§4 law): the SAVED
 * canonical spec source parses through `parseOpenApi` (response
 * examples stay off — the file-import examples write-leg residual
 * gates them) and lands through the shared collection-landing loop
 * (`land-collections.ts`) — the exact path the OpenAPI import modal
 * rides. The generated collection then records its `specLink`
 * ({specUid, sourceHash}) so the toolbar popover lists it and Phase F
 * can judge drift; the structured report persists like every import
 * (nothing lossless presents as loss).
 */

import { ImportOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import {
  hashImportSource,
  type ImportReport,
  OpenApiParseError,
  type OpenApiParseResult,
  parseOpenApi,
  recordDrop,
} from '@openheaders/core/import';
import type { Spec } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Divider, Input, Modal, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import ImportReportPanel from '../import/ImportReportPanel';
import { landSectionedCollections, type SectionedCollection } from '../import/land-collections';

interface GenerateCollectionModalProps {
  open: boolean;
  spec: Spec;
  /** Saved canonical root-file source — never the live editor buffer. */
  content: string;
  /** The editor buffer has unsaved changes — surfaces the hint that
   *  generation reads the saved document. */
  editorDirty: boolean;
  onCancel: () => void;
  onGenerated?: (collectionUid: string) => void;
}

type Stage = { kind: 'parsed'; result: OpenApiParseResult } | { kind: 'error'; message: string };

const GenerateCollectionModal: React.FC<GenerateCollectionModalProps> = ({
  open,
  spec,
  content,
  editorDirty,
  onCancel,
  onGenerated,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const requestsApi = useRequests();

  const [stage, setStage] = useState<Stage | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      // Examples stay off (§2) — same posture as the import modal's
      // OpenAPI path; the parser keeps the honest aggregate note.
      const result = parseOpenApi(content);
      setStage({ kind: 'parsed', result });
      setName(result.collectionName);
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof OpenApiParseError ? err.message : String(err),
      });
      setName('');
    }
    setBusy(false);
  }, [open, content]);

  const canGenerate = stage?.kind === 'parsed' && !busy && name.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (stage?.kind !== 'parsed' || busy) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    try {
      const sourceHash = await hashImportSource(content);
      const report: ImportReport = { ...stage.result.report, sourceHash };
      const section: SectionedCollection = {
        name: trimmed,
        ...(stage.result.collectionAuth !== undefined ? { auth: stage.result.collectionAuth } : {}),
        ...(stage.result.collectionVariables.length > 0 ? { variables: stage.result.collectionVariables } : {}),
        folders: stage.result.folders,
        requests: stage.result.requests,
      };
      const landed = await landSectionedCollections(
        [section],
        [trimmed],
        {
          createCollection: async (n) => {
            const c = await requestsApi.createCollection(n);
            return c ? { uid: c.uid, path: c.path } : null;
          },
          createFolder: async (n, parentPath) => {
            const f = await requestsApi.createFolder(n, parentPath);
            return f ? { uid: f.uid, path: f.path } : null;
          },
          setCollectionAuth: requestsApi.setCollectionAuth,
          setCollectionVariables: requestsApi.setCollectionVariables,
          createRequest: async ({ name: reqName, parentPath, seed }) => {
            const r = await requestsApi.createRequest({ name: reqName, parentPath, seed });
            return r ? { uid: r.uid } : null;
          },
        },
        report,
      );
      const collectionUid = landed.collectionUids[0] ?? null;
      if (!collectionUid) {
        message.error(t('workbench.editors.spec.generate.failed'));
        void hostBridge.call('recordImportReport', { report }).catch(() => undefined);
        return;
      }
      const linked = await requestsApi.setCollectionSpecLink(collectionUid, { specUid: spec.uid, sourceHash });
      if (!linked) {
        recordDrop(report, {
          path: 'collections[0].specLink',
          reason: 'The generated collection could not record its spec link — it will not appear under Collections.',
          tracking: 'PERMANENT: write-path failure',
        });
        message.warning(t('workbench.editors.spec.generate.linkFailed'));
      }
      void hostBridge.call('recordImportReport', { report }).catch(() => undefined);
      const summaryParts = [t('workbench.editors.spec.generate.requestsCount', { count: landed.requestsImported })];
      if (report.summary.dropped > 0) {
        summaryParts.push(`${report.summary.dropped} drop${report.summary.dropped === 1 ? '' : 's'}`);
      }
      message.success(
        t('workbench.editors.spec.generate.success', { name: trimmed, summary: summaryParts.join(' · ') }),
      );
      onGenerated?.(collectionUid);
      onCancel();
    } catch (err) {
      message.error(`${t('workbench.editors.spec.generate.failed')} ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [stage, busy, name, content, requestsApi, spec.uid, message, t, onGenerated, onCancel]);

  const result = stage?.kind === 'parsed' ? stage.result : null;

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
        {t('workbench.editors.spec.generate.blurb')}
      </Typography.Paragraph>

      {editorDirty && (
        <Alert
          type="info"
          showIcon
          message={t('workbench.editors.spec.generate.dirtyHint')}
          style={{ marginBottom: 12 }}
        />
      )}

      {stage?.kind === 'error' && (
        <Alert
          type="error"
          showIcon
          message={t('workbench.editors.spec.generate.parseFailed')}
          description={stage.message}
        />
      )}

      {result && (
        <>
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
              <Tag>{t('workbench.editors.spec.generate.requestsCount', { count: result.requests.length })}</Tag>
              <Tag>{t('workbench.editors.spec.generate.foldersCount', { count: result.folders.length })}</Tag>
              {result.collectionVariables.length > 0 && (
                <Tag>
                  {t('workbench.editors.spec.generate.variablesCount', { count: result.collectionVariables.length })}
                </Tag>
              )}
            </Space>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <ImportReportPanel report={result.report} token={token} />
        </>
      )}
    </Modal>
  );
};

export default GenerateCollectionModal;
