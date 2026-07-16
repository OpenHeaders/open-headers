/**
 * UpdateCollectionModal — the per-link Update action for a
 * spec-generated collection (API_SPECS_PLAN.md Phase F).
 *
 * Parses the SAVED spec source, plans a user-mediated diff against the
 * live collection (spec-update-plan.ts) and presents it as grouped
 * checkbox rows: adds and changes default on, removals default OFF —
 * orphaned requests survive an apply unless opted in per row, never a
 * silent overwrite. Apply converges the checked rows through the
 * standard write legs (`updateRequest` partials ride the per-leaf
 * field-diff builder) and rewrites `specLink.sourceHash` in the same
 * gesture — the link is in sync with this document version even when
 * the user kept local divergence.
 */

import { CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import {
  hashImportSource,
  OpenApiParseError,
  type OpenApiParseResult,
  parseOpenApi,
} from '@openheaders/core/import';
import type { Collection, Request, Spec, TreeNode } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Checkbox, Modal, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import {
  buildSpecUpdatePlan,
  type SpecChangedField,
  type SpecUpdatePlan,
  specUpdatePlanSize,
} from './spec-update-plan';

interface UpdateCollectionModalProps {
  open: boolean;
  spec: Spec;
  /** Saved canonical root-file source — never the live editor buffer. */
  content: string;
  collection: Collection;
  /** The editor buffer has unsaved changes — surfaces the hint that
   *  the update reads the saved document. */
  editorDirty: boolean;
  onCancel: () => void;
}

type Stage = { kind: 'planned'; parsed: OpenApiParseResult; plan: SpecUpdatePlan } | { kind: 'error'; message: string };

const FIELD_LABEL_KEYS = {
  name: 'workbench.editors.spec.update.field.name',
  description: 'workbench.editors.spec.update.field.description',
  headers: 'workbench.editors.spec.update.field.headers',
  params: 'workbench.editors.spec.update.field.params',
  auth: 'workbench.editors.spec.update.field.auth',
  body: 'workbench.editors.spec.update.field.body',
} as const satisfies Record<SpecChangedField, string>;

const VARIABLES_ROW = 'variables';
const AUTH_ROW = 'auth';

/** Live tree walk: the collection's request uids + folder paths keyed
 *  by their name chain (the planner/apply folder addressing unit). */
function collectLiveTree(nodes: readonly TreeNode[]): {
  requestUids: string[];
  folderPathByChain: Map<string, string>;
} {
  const requestUids: string[] = [];
  const folderPathByChain = new Map<string, string>();
  const walk = (children: readonly TreeNode[], chain: string[]) => {
    for (const node of children) {
      if (node.type === 'request') {
        requestUids.push(node.uid);
      } else if (node.type === 'folder') {
        const nextChain = [...chain, node.name];
        folderPathByChain.set(nextChain.join('/'), node.path);
        walk(node.children, nextChain);
      }
    }
  };
  walk(nodes, []);
  return { requestUids, folderPathByChain };
}

const UpdateCollectionModal: React.FC<UpdateCollectionModalProps> = ({
  open,
  spec,
  content,
  collection,
  editorDirty,
  onCancel,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const requestsApi = useRequests();

  const [stage, setStage] = useState<Stage | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const liveTree = useMemo(() => {
    const tree = requestsApi.collectionTrees.find((c) => c.uid === collection.uid);
    return collectLiveTree(tree?.tree ?? []);
  }, [requestsApi.collectionTrees, collection.uid]);

  // The plan snapshots the live state at open — a mid-review peer edit
  // re-plans on the next open, not under the user's cursor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: plan is deliberately pinned to the open gesture
  useEffect(() => {
    if (!open) return;
    try {
      const parsed = parseOpenApi(content);
      const uidSet = new Set(liveTree.requestUids);
      const liveRequests = requestsApi.requests.filter((r) => uidSet.has(r.uid));
      const plan = buildSpecUpdatePlan(parsed, { collection, requests: liveRequests });
      const defaults = new Set<string>();
      for (const add of plan.adds) defaults.add(`add:${add.key}`);
      for (const change of plan.changes) defaults.add(`change:${change.requestUid}`);
      if (plan.variables !== null) defaults.add(VARIABLES_ROW);
      if (plan.auth !== null) defaults.add(AUTH_ROW);
      setStage({ kind: 'planned', parsed, plan });
      setChecked(defaults);
    } catch (err) {
      setStage({ kind: 'error', message: err instanceof OpenApiParseError ? err.message : String(err) });
      setChecked(new Set());
    }
    setBusy(false);
  }, [open, content]);

  const toggle = useCallback((rowKey: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const plan = stage?.kind === 'planned' ? stage.plan : null;
  const selectedCount = checked.size;

  const handleApply = useCallback(async () => {
    if (!plan || busy) return;
    setBusy(true);
    try {
      const sourceHash = await hashImportSource(content);
      let applied = 0;
      let failed = 0;

      // Adds — ensure ancestor folders exist (depth-first over the
      // checked adds' chains), then create like the landing loop.
      const checkedAdds = plan.adds.filter((a) => checked.has(`add:${a.key}`));
      const folderPathByChain = new Map(liveTree.folderPathByChain);
      const neededChains = new Set<string>();
      for (const add of checkedAdds) {
        for (let depth = 1; depth <= add.folderPath.length; depth++) {
          neededChains.add(add.folderPath.slice(0, depth).join('/'));
        }
      }
      for (const chain of [...neededChains].sort((a, b) => a.split('/').length - b.split('/').length)) {
        if (folderPathByChain.has(chain)) continue;
        const segments = chain.split('/');
        const parentPath = segments.length > 1 ? folderPathByChain.get(segments.slice(0, -1).join('/')) : collection.path;
        const folderName = segments[segments.length - 1];
        if (!parentPath || !folderName) continue;
        const created = await requestsApi.createFolder(folderName, parentPath);
        if (created) folderPathByChain.set(chain, created.path);
      }
      for (const add of checkedAdds) {
        const request = add.request;
        const parentPath = folderPathByChain.get(add.folderPath.join('/')) ?? collection.path;
        const created = await requestsApi.createRequest({
          name: request.name,
          parentPath,
          seed: {
            ...(request.description !== undefined ? { description: request.description } : {}),
            ...request.settings,
            method: request.method,
            url: request.url,
            headers: request.headers,
            params: request.params,
            auth: request.auth,
            body: request.body,
          },
        });
        if (created) applied++;
        else failed++;
      }

      for (const change of plan.changes) {
        if (!checked.has(`change:${change.requestUid}`)) continue;
        const result = await requestsApi.updateRequest(change.requestUid, change.updates);
        if (result.ok) applied++;
        else failed++;
      }

      for (const remove of plan.removes) {
        if (!checked.has(`remove:${remove.requestUid}`)) continue;
        const deleted = await requestsApi.deleteRequest(remove.requestUid);
        if (deleted) applied++;
        else failed++;
      }

      if (plan.variables !== null && checked.has(VARIABLES_ROW)) {
        const landed = await requestsApi.setCollectionVariables(collection.uid, plan.variables);
        if (landed) applied++;
        else failed++;
      }
      if (plan.auth !== null && checked.has(AUTH_ROW)) {
        const landed = await requestsApi.setCollectionAuth(collection.uid, plan.auth);
        if (landed) applied++;
        else failed++;
      }

      const linked = await requestsApi.setCollectionSpecLink(collection.uid, { specUid: spec.uid, sourceHash });
      if (!linked) failed++;

      if (failed > 0) {
        message.warning(t('workbench.editors.spec.update.partial', { applied, failed }));
      } else {
        message.success(t('workbench.editors.spec.update.success', { name: collection.name, count: applied }));
      }
      onCancel();
    } catch (err) {
      message.error(`${t('workbench.editors.spec.update.failed')} ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [plan, busy, checked, content, liveTree, collection, spec.uid, requestsApi, message, t, onCancel]);

  const groupTitle = (label: string) => (
    <Typography.Text strong style={{ fontSize: 11, letterSpacing: 0.5, color: token.colorTextSecondary }}>
      {label}
    </Typography.Text>
  );

  const methodTag = (method: string) => (
    <Tag style={{ fontSize: 9, lineHeight: '14px', marginInlineEnd: 0 }}>{method}</Tag>
  );

  const planEmpty = plan !== null && specUpdatePlanSize(plan) === 0;

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {t('workbench.editors.spec.update.modalTitle')}
        </span>
      }
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel} size="small" disabled={busy}>
            {t('shared.action.cancel')}
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => void handleApply()}
            disabled={plan === null || busy}
            loading={busy}
            data-testid="spec-update-confirm"
          >
            {selectedCount > 0
              ? t('workbench.editors.spec.update.action', { count: selectedCount })
              : t('workbench.editors.spec.update.markInSync')}
          </Button>
        </div>
      }
      width={640}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        {t('workbench.editors.spec.update.blurb', { name: collection.name })}
      </Typography.Paragraph>

      {editorDirty && (
        <Alert
          type="info"
          showIcon
          message={t('workbench.editors.spec.update.dirtyHint')}
          style={{ marginBottom: 12 }}
        />
      )}

      {stage?.kind === 'error' && (
        <Alert
          type="error"
          showIcon
          message={t('workbench.editors.spec.update.parseFailed')}
          description={stage.message}
        />
      )}

      {planEmpty && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message={t('workbench.editors.spec.update.inSync')}
          data-testid="spec-update-in-sync"
        />
      )}

      {plan !== null && !planEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
          {plan.adds.length > 0 && (
            <div>
              {groupTitle(t('workbench.editors.spec.update.groupAdded', { count: plan.adds.length }))}
              {plan.adds.map((add) => (
                <div key={add.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <Checkbox
                    checked={checked.has(`add:${add.key}`)}
                    onChange={() => toggle(`add:${add.key}`)}
                    data-testid={`spec-update-add-${add.request.method}-${add.request.url}`}
                  />
                  {methodTag(add.request.method)}
                  <Typography.Text style={{ fontSize: 12 }} ellipsis>
                    {add.request.name}
                  </Typography.Text>
                </div>
              ))}
            </div>
          )}
          {plan.changes.length > 0 && (
            <div>
              {groupTitle(t('workbench.editors.spec.update.groupChanged', { count: plan.changes.length }))}
              {plan.changes.map((change) => (
                <div
                  key={change.requestUid}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
                >
                  <Checkbox
                    checked={checked.has(`change:${change.requestUid}`)}
                    onChange={() => toggle(`change:${change.requestUid}`)}
                    data-testid={`spec-update-change-${change.requestUid}`}
                  />
                  {methodTag(change.method)}
                  <Typography.Text style={{ fontSize: 12 }} ellipsis>
                    {change.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {change.changedFields.map((f) => t(FIELD_LABEL_KEYS[f])).join(', ')}
                  </Typography.Text>
                </div>
              ))}
            </div>
          )}
          {plan.removes.length > 0 && (
            <div>
              {groupTitle(t('workbench.editors.spec.update.groupRemoved', { count: plan.removes.length }))}
              <Typography.Paragraph type="secondary" style={{ fontSize: 11, margin: '2px 0 4px' }}>
                {t('workbench.editors.spec.update.removeHint')}
              </Typography.Paragraph>
              {plan.removes.map((remove) => (
                <div
                  key={remove.requestUid}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
                >
                  <Checkbox
                    checked={checked.has(`remove:${remove.requestUid}`)}
                    onChange={() => toggle(`remove:${remove.requestUid}`)}
                    data-testid={`spec-update-remove-${remove.requestUid}`}
                  />
                  {methodTag(remove.method)}
                  <Typography.Text delete={checked.has(`remove:${remove.requestUid}`)} style={{ fontSize: 12 }} ellipsis>
                    {remove.name}
                  </Typography.Text>
                </div>
              ))}
            </div>
          )}
          {(plan.variables !== null || plan.auth !== null) && (
            <div>
              {groupTitle(t('workbench.editors.spec.update.groupCollection'))}
              {plan.variables !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <Checkbox
                    checked={checked.has(VARIABLES_ROW)}
                    onChange={() => toggle(VARIABLES_ROW)}
                    data-testid="spec-update-variables"
                  />
                  <Typography.Text style={{ fontSize: 12 }}>
                    {t('workbench.editors.spec.update.variablesRow')}
                  </Typography.Text>
                </div>
              )}
              {plan.auth !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <Checkbox
                    checked={checked.has(AUTH_ROW)}
                    onChange={() => toggle(AUTH_ROW)}
                    data-testid="spec-update-auth"
                  />
                  <Typography.Text style={{ fontSize: 12 }}>
                    {t('workbench.editors.spec.update.authRow')}
                  </Typography.Text>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {plan !== null && !planEmpty && (
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'inline-block', marginTop: 10 }}>
          {t('workbench.editors.spec.update.hashNote')}
        </Typography.Text>
      )}
    </Modal>
  );
};

export default UpdateCollectionModal;
