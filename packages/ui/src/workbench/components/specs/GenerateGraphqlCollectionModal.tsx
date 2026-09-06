/**
 * GenerateGraphqlCollectionModal — the GraphQL spec editor's Generate
 * Collection action (the GraphQL-client plan Phase E), the graphql
 * twin of {@link GenerateProtoCollectionModal}.
 *
 * A schema names no endpoint, so the modal asks for one (optional —
 * blank leaves every generated request a draft to fill in) and walks
 * the plan from `graphql-collection-plan.ts`: create the collection,
 * one folder per root type when both Query and Mutation hold fields,
 * one GraphqlRequest per root field with its synthesized document and
 * example variables pre-filled, then record the collection's
 * `specLink` ({specUid, sourceHash} — the root file's saved-content
 * hash, the same identity the drift judge compares against).
 * Subscription fields are named and left out; write-path failures
 * count into an honest partial toast; schema problems surface as
 * warnings while what resolved still generates.
 */

import { ImportOutlined } from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { Spec } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { buildGraphqlCollectionPlan, type GraphqlCollectionPlan } from './graphql-collection-plan';

interface GenerateGraphqlCollectionModalProps {
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

const GenerateGraphqlCollectionModal: React.FC<GenerateGraphqlCollectionModalProps> = ({
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

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(spec.name);
    setUrl('');
    setBusy(false);
  }, [open, spec]);

  // The plan re-derives on the endpoint so the seeds carry it; the
  // schema read is the saved root's, cheap next to the write path.
  const plan = useMemo<GraphqlCollectionPlan | null>(
    () => (open ? buildGraphqlCollectionPlan(spec, { url }) : null),
    [open, spec, url],
  );

  const canGenerate = plan !== null && plan.requestCount > 0 && !busy && name.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (plan === null || plan.requestCount === 0 || busy) return;
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
      for (const root of plan.roots) {
        let parentPath = coll.path;
        if (plan.roots.length > 1) {
          const folder = await requestsApi.createFolder(root.typeName, coll.path);
          if (folder) parentPath = folder.path;
          else failed++;
        }
        for (const request of root.requests) {
          const landed = await requestsApi.createGraphqlRequest({ name: request.name, parentPath, seed: request.seed });
          if (landed) created++;
          else failed++;
        }
      }
      const linked = await requestsApi.setCollectionSpecLink(coll.uid, { specUid: spec.uid, sourceHash });
      if (!linked) {
        message.warning(t('workbench.editors.spec.generate.linkFailed'));
      }
      if (failed > 0) {
        message.warning(t('workbench.editors.spec.generateGraphql.partial', { created, failed }));
      } else {
        message.success(
          t('workbench.editors.spec.generate.success', {
            name: trimmed,
            summary: t('workbench.editors.spec.generateGraphql.requestsCount', { count: created }),
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
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        {t('workbench.editors.spec.generateGraphql.blurb')}
      </Typography.Paragraph>

      {editorDirty && (
        <Alert
          type="info"
          showIcon
          title={t('workbench.editors.spec.generate.dirtyHint')}
          style={{ marginBottom: 12 }}
        />
      )}

      {plan !== null && plan.requestCount === 0 && (
        <Alert
          type="warning"
          showIcon
          title={t('workbench.editors.spec.generateGraphql.empty')}
          style={{ marginBottom: 12 }}
          data-testid="spec-generate-graphql-empty"
        />
      )}

      {plan !== null && plan.requestCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <Tag>{t('workbench.editors.spec.generateGraphql.requestsCount', { count: plan.requestCount })}</Tag>
              {plan.roots.map((root) => (
                <Tag key={root.operation}>{root.typeName}</Tag>
              ))}
            </Space>
          </div>
          <Input
            size="small"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={() => void handleGenerate()}
            placeholder={t('workbench.editors.spec.generateGraphql.urlPlaceholder')}
            style={{ fontSize: 12, fontFamily: "'SF Mono', monospace" }}
            data-testid="spec-generate-graphql-url"
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.editors.spec.generateGraphql.urlHint')}
          </Typography.Text>
        </div>
      )}

      {plan !== null && plan.subscriptions.length > 0 && (
        <Alert
          type="info"
          showIcon
          title={t('workbench.editors.spec.generateGraphql.subscriptionsSkipped', {
            count: plan.subscriptions.length,
            fields: plan.subscriptions.join(', '),
          })}
          style={{ marginTop: 8 }}
          data-testid="spec-generate-graphql-subscriptions"
        />
      )}

      {plan !== null &&
        plan.problems.map((problem) => (
          <Alert
            key={problem}
            type="warning"
            showIcon
            title={t('workbench.editors.spec.generateGraphql.problem', { message: problem })}
            style={{ marginTop: 8 }}
          />
        ))}
    </Modal>
  );
};

export default GenerateGraphqlCollectionModal;
