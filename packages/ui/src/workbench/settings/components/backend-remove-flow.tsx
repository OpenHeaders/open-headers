/**
 * Remove flow for a backend record (MULTI_BACKEND_PLAN.md §4).
 *
 * An unbound record (no consumed Orgs) removes through a plain
 * Popconfirm — nothing was synced from it, only its address and pairing
 * are forgotten. A bound record opens the outcome dialog with the two
 * posture-independent choices scoped to this backend's Org subset:
 *
 *   - **Keep local copies** — `removeBackend` deletes the record and
 *     prunes its `OH.joinedOrgs` rows; the Orgs stop syncing and their
 *     workspaces stay on this device as offline local data.
 *   - **Discard** — each of those workspaces is exported to a downloaded
 *     backup file, then EVICTED from this device: a host-local removal
 *     (no synced delete mutation) that purges the workspace's data and
 *     log rows and drops the list entry without a tombstone. A synced
 *     delete would tombstone the workspace with a fresh local HLC that
 *     outranks the back-end's state forever — eviction is what makes
 *     "re-joining later syncs them down again" actually hold.
 *
 * Discard's sequence is export → `removeBackend` → evict, in that
 * order deliberately: one failed export aborts with everything intact,
 * and the record goes before the evictions so the Orgs are already
 * unbound while their local state is torn down. Removing a backend
 * never touches its own data.
 */

import { DeleteOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { removeBackend } from '@openheaders/core/backends';
import type { BackendConnection, Org } from '@openheaders/core/types';
import { slugify } from '@openheaders/core/utils';
import { App as AntApp, Button, Checkbox, Modal, Popconfirm, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useWorkspaces } from '../../../shared/hooks/readers/useWorkspaces';
import { downloadYaml } from '../../components/workspace-export/download-yaml';

type Outcome = 'keep' | 'discard';

export interface DiscardRemovalDeps {
  /** Active-locale translator for the progress copy. */
  t: Translate;
  workspaces: ReadonlyArray<{ id: string; name: string }>;
  /** Export one workspace to a backup file. False aborts the whole flow. */
  backupWorkspace: (workspace: { id: string; name: string }) => Promise<boolean>;
  /** Delete the backend record + prune its joined-Org rows. */
  removeBackend: () => Promise<void>;
  /** Host-local eviction of one consumed workspace (no synced delete). */
  evictWorkspace: (id: string) => Promise<{ success: boolean }>;
  onProgress: (text: string) => void;
}

export type DiscardRemovalResult =
  | { ok: false; aborted: 'backup' }
  | { ok: true; failedDeletes: string[] };

/**
 * The Discard sequence, in load-bearing order: back up every workspace
 * BEFORE any destructive step (one failed export aborts with record and
 * workspaces intact), then remove the backend record, then EVICT the
 * local copies. Eviction, not a synced delete: a delete's tombstone
 * would outrank the back-end's state forever and the retained log rows
 * would make a re-join's state vector claim full knowledge — the
 * eviction purges both so re-joining is a genuine first join.
 */
export async function orchestrateDiscardRemoval(deps: DiscardRemovalDeps): Promise<DiscardRemovalResult> {
  for (const workspace of deps.workspaces) {
    deps.onProgress(deps.t('workbench.settings.backendPane.remove.progress.backingUp', { name: workspace.name }));
    if (!(await deps.backupWorkspace(workspace))) return { ok: false, aborted: 'backup' };
  }
  deps.onProgress(deps.t('workbench.settings.backendPane.remove.progress.removing'));
  await deps.removeBackend();
  const failedDeletes: string[] = [];
  for (const workspace of deps.workspaces) {
    deps.onProgress(deps.t('workbench.settings.backendPane.remove.progress.deleting', { name: workspace.name }));
    const result = await deps.evictWorkspace(workspace.id);
    if (!result.success) failedDeletes.push(workspace.name);
  }
  return { ok: true, failedDeletes };
}

export const BackendRemoveButton: React.FC<{
  record: BackendConnection;
  label: string;
  consumedOrgs: readonly Org[];
  onRemoved: () => void;
}> = ({ record, label, consumedOrgs, onRemoved }) => {
  const { message } = AntApp.useApp();
  const t = useT();
  const [open, setOpen] = useState(false);

  if (consumedOrgs.length === 0) {
    const remove = async (): Promise<void> => {
      await removeBackend(record.id);
      onRemoved();
      message.success(t('workbench.settings.backendPane.remove.removed', { label }));
    };
    return (
      <Popconfirm
        title={t('workbench.settings.backendPane.remove.confirmTitle', { label })}
        description={t('workbench.settings.backendPane.remove.confirmBody')}
        okText={t('shared.action.remove')}
        okButtonProps={{ danger: true }}
        onConfirm={() => void remove()}
      >
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={t('workbench.settings.backendPane.remove.aria', { label })}
        />
      </Popconfirm>
    );
  }

  return (
    <>
      <Tooltip title={t('workbench.settings.backendPane.remove.tooltip')}>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={t('workbench.settings.backendPane.remove.aria', { label })}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      {open && (
        <BackendRemoveDialog
          record={record}
          label={label}
          consumedOrgs={consumedOrgs}
          onClose={() => setOpen(false)}
          onRemoved={onRemoved}
        />
      )}
    </>
  );
};

const BackendRemoveDialog: React.FC<{
  record: BackendConnection;
  label: string;
  consumedOrgs: readonly Org[];
  onClose: () => void;
  onRemoved: () => void;
}> = ({ record, label, consumedOrgs, onClose, onRemoved }) => {
  const { token } = theme.useToken();
  const { message, notification } = AntApp.useApp();
  const t = useT();
  const { workspaces } = useWorkspaces();
  const [outcome, setOutcome] = useState<Outcome>('keep');
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const orgIds = new Set(consumedOrgs.map((org) => org.id));
  const affected = workspaces.filter((w) => orgIds.has(w.orgId));
  const orgNames = consumedOrgs.map((org) => org.name).join(', ');
  const workspaceCount = t('workbench.settings.backendPane.remove.workspaceCount', { count: affected.length });

  const runKeep = async (): Promise<void> => {
    await removeBackend(record.id);
    message.success(
      t('workbench.settings.backendPane.remove.keepDone', { label, orgs: orgNames, workspaces: workspaceCount }),
    );
  };

  const backupWorkspace = async (workspace: { id: string; name: string }): Promise<boolean> => {
    const resp = await hostBridge
      .call('exportWorkspace', {
        workspaceId: workspace.id,
        scope: { kind: 'workspace' },
        vaultMode: includeSecrets ? 'plaintext' : 'omitted',
      })
      .catch(() => null);
    if (!resp?.success || !resp.yaml) {
      notification.error({
        message: t('workbench.settings.backendPane.remove.backupFailedTitle', { name: workspace.name }),
        description: resp?.error ?? t('workbench.settings.backendPane.remove.backupFailedBody'),
      });
      return false;
    }
    downloadYaml(`${slugify(workspace.name) || 'workspace'}-backup.openheaders.yaml`, resp.yaml);
    return true;
  };

  const runDiscard = async (): Promise<void> => {
    const result = await orchestrateDiscardRemoval({
      t,
      workspaces: affected,
      backupWorkspace,
      removeBackend: async () => {
        await removeBackend(record.id);
      },
      evictWorkspace: async (id) => {
        const resp = await hostBridge.call('evictWorkspace', { workspaceId: id }).catch(() => null);
        return { success: resp?.success === true };
      },
      onProgress: setBusy,
    });
    if (!result.ok) return;
    if (result.failedDeletes.length > 0) {
      notification.warning({
        message: t('workbench.settings.backendPane.remove.discardStayedTitle', {
          label,
          count: result.failedDeletes.length,
        }),
        description: t('workbench.settings.backendPane.remove.discardStayedBody', {
          names: result.failedDeletes.join(', '),
        }),
      });
      return;
    }
    message.success(
      t('workbench.settings.backendPane.remove.discardDone', { label, orgs: orgNames, workspaces: workspaceCount }),
    );
  };

  const run = async (): Promise<void> => {
    setBusy(
      t(
        outcome === 'keep'
          ? 'workbench.settings.backendPane.remove.progress.removing'
          : 'workbench.settings.backendPane.remove.progress.preparing',
      ),
    );
    try {
      if (outcome === 'keep') await runKeep();
      else await runDiscard();
      onRemoved();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title={t('workbench.settings.backendPane.remove.confirmTitle', { label })}
      open
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      maskClosable={false}
      width={560}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{busy}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose} disabled={busy !== null}>
              {t('shared.action.cancel')}
            </Button>
            <Button danger type="primary" loading={busy !== null} onClick={() => void run()}>
              {t(
                outcome === 'keep'
                  ? 'workbench.settings.backendPane.remove.removeBackend'
                  : 'workbench.settings.backendPane.remove.backupThenRemove',
              )}
            </Button>
          </div>
        </div>
      }
    >
      <p style={{ fontSize: 12.5, color: token.colorTextSecondary, margin: '4px 0 12px' }}>
        {t('workbench.settings.backendPane.remove.body.prefix')} <strong>{orgNames}</strong>{' '}
        {t('workbench.settings.backendPane.remove.body.suffix', { workspaces: workspaceCount })}
      </p>
      <div
        role="radiogroup"
        aria-label={t('workbench.settings.backendPane.remove.outcomeAria')}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <OutcomeCard
          selected={outcome === 'keep'}
          onSelect={() => setOutcome('keep')}
          title={t('workbench.settings.backendPane.remove.keep.title')}
          badge={t('workbench.settings.backendPane.remove.recommendedBadge')}
          description={t('workbench.settings.backendPane.remove.keep.description', {
            orgs: orgNames,
            workspaces: workspaceCount,
          })}
        />
        <OutcomeCard
          selected={outcome === 'discard'}
          onSelect={() => setOutcome('discard')}
          title={t('workbench.settings.backendPane.remove.discard.title')}
          description={t('workbench.settings.backendPane.remove.discard.description')}
        >
          {outcome === 'discard' && (
            <Checkbox
              checked={includeSecrets}
              onChange={(e) => setIncludeSecrets(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ fontSize: 12 }}>
                {t('workbench.settings.backendPane.remove.discard.includeSecrets')}
              </span>
            </Checkbox>
          )}
        </OutcomeCard>
      </div>
    </Modal>
  );
};

const OutcomeCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  badge?: string;
  children?: React.ReactNode;
}> = ({ selected, onSelect, title, description, badge, children }) => {
  const { token } = theme.useToken();
  return (
    // A div (not <button>) — the discard card nests an interactive
    // checkbox, which HTML forbids inside a button element.
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 8,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: token.colorText,
        textAlign: 'left',
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
        {badge && (
          <span
            style={{
              padding: '0 5px',
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              borderRadius: 999,
              background: token.colorSuccess,
              color: token.colorTextLightSolid,
              lineHeight: '14px',
            }}
          >
            {badge}
          </span>
        )}
      </span>
      <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{description}</span>
      {children}
    </div>
  );
};
