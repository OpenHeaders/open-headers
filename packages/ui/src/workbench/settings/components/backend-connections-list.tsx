/**
 * Connections list — the managed `OH.backends` records on the Back-end
 * pane (MULTI_BACKEND_PLAN.md §4). One row per record: status dot,
 * label, address, the Orgs consumed from it, the auto-connect and
 * enabled toggles, re-pair, edit, remove.
 *
 * Life of a record: **Add** creates it disabled with loopback defaults
 * and opens the wizard (`backend-wizard.tsx`: scenario → connect → pair
 * → turn on); the row's Edit reopens the same wizard. The **enabled
 * toggle is the probe gate** — off→on verifies reachability + auth and
 * hard-aborts without committing on failure, so nothing connects until
 * the probe passes; an enabled record's wizard goes disable-first.
 *
 * Remove delegates to `backend-remove-flow.tsx`: a Popconfirm for
 * records with no consumed Orgs, the Keep-local-copies / Discard
 * outcome dialog for bound records.
 */

import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Switch, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type BackendConnectionPatch, createBackend, getBackend, updateBackend } from '@openheaders/core/backends';
import { getOrgBackendBindings } from '@openheaders/core/identity';
import type { BackendOrgConflict } from '@openheaders/core/storage';
import type { BackendConnection, Org } from '@openheaders/core/types';
import { useBackends } from '../../../shared/backend';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useBackendOrgConflicts } from '../../../shared/hooks/useBackendOrgConflicts';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';
import { deriveBackendMode } from '../schema/backend';
import { BackendIcon, backendModeIcon } from './backend-icons';
import { backendDisplayLabel } from './backend-record-context';
import { BackendRemoveButton } from './backend-remove-flow';
import { BackendWizard, type BackendWizardTarget } from './backend-wizard';
import { PairPopover } from './pair-popover';
import { type BackendEnableSwitchHandle, useBackendEnableSwitch } from './use-backend-enable-switch';
import { type BackendRowStatus, useBackendRowStatus } from './use-backend-row-status';

export const BackendConnectionsList: React.FC<{ host: Host }> = ({ host }) => {
  const { token } = theme.useToken();
  const t = useT();
  const backends = useBackends();
  const orgConflicts = useBackendOrgConflicts();
  const enableSwitch = useBackendEnableSwitch();
  const [wizard, setWizard] = useState<BackendWizardTarget | null>(null);

  const add = async (): Promise<void> => {
    const created = await createBackend();
    setWizard({ recordId: created.id, mode: 'add' });
  };

  return (
    <section style={{ marginBottom: 12 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
          padding: '0 2px',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: token.colorTextSecondary,
            }}
          >
            {t('workbench.settings.backendPane.connections.title')}
          </h3>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
            {t(
              host === 'extension'
                ? 'workbench.settings.backendPane.connections.blurbBrowser'
                : 'workbench.settings.backendPane.connections.blurbApp',
            )}
          </div>
        </div>
        <Button size="small" icon={<PlusOutlined />} onClick={() => void add()}>
          {t('workbench.settings.backendPane.connections.add')}
        </Button>
      </header>
      {backends.length === 0 ? (
        <div
          style={{
            padding: '14px 12px',
            fontSize: 12,
            color: token.colorTextTertiary,
            background: token.colorBgContainer,
            border: `1px dashed ${token.colorBorderSecondary}`,
            borderRadius: 10,
          }}
        >
          {t(
            host === 'extension'
              ? 'workbench.settings.backendPane.connections.emptyBrowser'
              : 'workbench.settings.backendPane.connections.emptyApp',
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backends.map((record) => (
            <ConnectionRow
              key={record.id}
              record={record}
              orgConflicts={orgConflicts.filter((c) => c.backendId === record.id)}
              enableSwitch={enableSwitch}
              onEdit={() => setWizard({ recordId: record.id, mode: 'edit' })}
              onRemoved={() => setWizard(null)}
            />
          ))}
        </div>
      )}
      {wizard && <BackendWizard target={wizard} enableSwitch={enableSwitch} onClose={() => setWizard(null)} />}
      {enableSwitch.overlayElement}
    </section>
  );
};

const STATUS_LABEL: Record<BackendRowStatus, MessageKey> = {
  connected: 'workbench.settings.backendPane.connections.status.connected',
  connecting: 'workbench.settings.backendPane.connections.status.connecting',
  'auth-required': 'workbench.settings.backendPane.connections.status.authRequired',
  error: 'workbench.settings.backendPane.connections.status.error',
  off: 'workbench.settings.backendPane.connections.status.off',
};

const ConnectionRow: React.FC<{
  record: BackendConnection;
  orgConflicts: BackendOrgConflict[];
  enableSwitch: BackendEnableSwitchHandle;
  onEdit: () => void;
  onRemoved: () => void;
}> = ({ record, orgConflicts, enableSwitch, onEdit, onRemoved }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { status, detail } = useBackendRowStatus(record);
  const consumedOrgs = useConsumedOrgs(record.id);

  const label = backendDisplayLabel(record);
  const icon = backendModeIcon(deriveBackendMode(getCurrentHost(), { ...record, enabled: true }));

  const patch = (next: BackendConnectionPatch): void => {
    void updateBackend(record.id, next);
  };

  return (
    <div
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <StatusDot status={status} detail={detail} />
        <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
          <BackendIcon kind={icon} size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: token.colorText,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: token.colorTextTertiary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {record.url}
            {consumedOrgs.length > 0 && (
              <>
                {' · '}
                {consumedOrgs.map((org) => org.name).join(', ')}
              </>
            )}
          </div>
        </div>
        {status === 'auth-required' && (
          <PairPopover
            url={record.url}
            onPaired={(next) => patch({ authToken: next })}
            buttonLabel={t('workbench.settings.backendPane.connections.repair')}
            buttonType="primary"
          />
        )}
        <Checkbox checked={record.autoConnect} onChange={(e) => patch({ autoConnect: e.target.checked })}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {t('workbench.settings.backendPane.connections.autoConnect')}
          </span>
        </Checkbox>
        <Tooltip
          title={t(
            record.enabled
              ? 'workbench.settings.backendPane.connections.editTooltipConnected'
              : 'workbench.settings.backendPane.connections.editTooltip',
          )}
        >
          <Button
            size="small"
            icon={<EditOutlined />}
            aria-label={t('workbench.settings.backendPane.connections.editAria', { label })}
            onClick={onEdit}
          />
        </Tooltip>
        <BackendRemoveButton record={record} label={label} consumedOrgs={consumedOrgs} onRemoved={onRemoved} />
        <Tooltip
          title={t(
            record.enabled
              ? 'workbench.settings.backendPane.connections.disconnectTooltip'
              : 'workbench.settings.backendPane.connections.connectTooltip',
          )}
        >
          <Switch
            checked={record.enabled}
            disabled={enableSwitch.busy}
            aria-label={t('workbench.settings.backendPane.connections.enabledAria', { label })}
            onChange={(next) => {
              void enableSwitch.setEnabled(record, next);
            }}
          />
        </Tooltip>
      </div>
      {orgConflicts.map((conflict) => (
        <OrgConflictNotice key={conflict.orgId} conflict={conflict} />
      ))}
    </div>
  );
};

/**
 * One durable Org-conflict row under a backend's status line — this
 * backend's WELCOME claimed an Org another record already provides
 * (`OH.backendOrgConflicts`). Stays visible until the claim succeeds or
 * the record is removed; the provider's label resolves against the live
 * registry so a rename shows through and a removed provider degrades to
 * a neutral phrase.
 */
const OrgConflictNotice: React.FC<{ conflict: BackendOrgConflict }> = ({ conflict }) => {
  const { token } = theme.useToken();
  const t = useT();
  const provider = getBackend(conflict.boundBackendId);
  const providerLabel = provider
    ? provider.label.trim() || provider.url
    : t('workbench.settings.backendPane.connections.removedBackend');
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px 5px 30px',
        fontSize: 11,
        color: token.colorWarningText,
        background: token.colorWarningBg,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {t('workbench.settings.backendPane.connections.orgConflict', { org: conflict.orgName, provider: providerLabel })}
    </div>
  );
};

const StatusDot: React.FC<{ status: BackendRowStatus; detail: string | null }> = ({ status, detail }) => {
  const { token } = theme.useToken();
  const t = useT();
  const color: Record<BackendRowStatus, string> = {
    connected: token.colorSuccess,
    connecting: token.colorWarning,
    'auth-required': token.colorWarning,
    error: token.colorError,
    off: token.colorTextQuaternary,
  };
  return (
    <Tooltip title={detail ?? t(STATUS_LABEL[status])}>
      <span
        role="status"
        aria-label={t(STATUS_LABEL[status])}
        style={{
          flex: 'none',
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color[status],
          display: 'inline-block',
        }}
      />
    </Tooltip>
  );
};

/**
 * The Orgs this backend provides, resolved through the identity
 * snapshot's live bindings (`OH.joinedOrgs`, presence-filtered). The
 * snapshot hook re-hydrates on either identity slot, so a join arriving
 * over the wire updates the row without a reload.
 */
function useConsumedOrgs(backendId: string): Org[] {
  const snapshot = useIdentitySnapshot();
  if (!snapshot) return [];
  const orgs: Org[] = [];
  for (const [orgId, boundBackendId] of getOrgBackendBindings()) {
    if (boundBackendId !== backendId) continue;
    const org = snapshot.orgs.get(orgId);
    if (org) orgs.push(org);
  }
  return orgs;
}
