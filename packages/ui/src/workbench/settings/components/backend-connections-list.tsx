/**
 * "Synced with" — band 2 of the Sync page (the Backup and Sync UX plan
 * §5.2): one row per `OH.backends` record, the place first, the state
 * second, the address as the tertiary line. The row's ⋯ carries
 * Connect / Disconnect, Edit and Remove; Re-pair stays inline as the
 * one primary gesture a broken wire needs; Auto-connect stays a
 * checkbox.
 *
 * Life of a record: the two verbs under the list create it disabled.
 * Connect desktop app pairs over native messaging first and opens the
 * wizard (`backend-wizard.tsx`) only as its fallback
 * (`use-connect-desktop-app.ts`); Sign in to a server… opens the wizard
 * on an empty address; the row's Edit reopens the same wizard on the
 * place. **Connect is the probe gate** — off→on verifies reachability +
 * auth and hard-aborts without committing on failure, so nothing
 * connects until the probe passes; an enabled record's wizard goes
 * disable-first.
 *
 * Remove delegates to `backend-remove-flow.tsx`: a plain confirm for
 * records with no consumed Orgs, the Keep-local-copies / Discard outcome
 * dialog for bound records.
 */

import { MoreOutlined } from '@ant-design/icons';
import { Button, Checkbox, Dropdown, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type BackendConnectionPatch, createBackend, getBackend, updateBackend } from '@openheaders/core/backends';
import { getOrgBackendBindings } from '@openheaders/core/identity';
import type { BackendOrgConflict } from '@openheaders/core/storage';
import type { BackendConnection, Org } from '@openheaders/core/types';
import { backendPlace, useBackends } from '../../../shared/backend';
import { getCurrentHost, type Host, viewerHostKind } from '../../../shared/host-vocabulary';
import { useBackendOrgConflicts } from '../../../shared/hooks/useBackendOrgConflicts';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';
import { deriveBackendMode } from '../schema/backend';
import { BackendIcon, backendModeIcon } from './backend-icons';
import { backendDisplayLabel } from './backend-record-context';
import { useBackendRemove } from './backend-remove-flow';
import { BackendRowStatusDot } from './backend-row-status-dot';
import { BackendWizard, type BackendWizardTarget } from './backend-wizard';
import { PairPopover } from './pair-popover';
import { PaneSection } from './pane-chrome';
import { type BackendEnableSwitchHandle, useBackendEnableSwitch } from './use-backend-enable-switch';
import { useBackendRegistryWrite } from './use-backend-registry-write';
import { BACKEND_ROW_STATUS_LABEL, useBackendRowStatus } from './use-backend-row-status';
import { useConnectDesktopApp } from './use-connect-desktop-app';

export const BackendConnectionsList: React.FC<{ host: Host }> = ({ host }) => {
  const { token } = theme.useToken();
  const t = useT();
  const backends = useBackends();
  const orgConflicts = useBackendOrgConflicts();
  const enableSwitch = useBackendEnableSwitch();
  const write = useBackendRegistryWrite();
  const [wizard, setWizard] = useState<BackendWizardTarget | null>(null);
  // The desktop-app verb exists where the desktop app is a place to join
  // — a browser viewer; the desktop app IS the desktop app.
  const offersDesktopApp = viewerHostKind(host) === 'browser';
  const desktopApp = useConnectDesktopApp(enableSwitch, setWizard);

  const signInToServer = async (): Promise<void> => {
    // A host that cannot store the record refuses here; the wizard must
    // not open on a record that was never created. The bare scheme is
    // the empty address the wizard opens on.
    const created = await write(() => createBackend({ url: 'ws://' }));
    if (created) setWizard({ recordId: created.id, mode: 'add', kind: 'server' });
  };

  return (
    <PaneSection title={t('workbench.settings.backendPane.connections.title')}>
      {backends.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {backends.map((record) => (
            <ConnectionRow
              key={record.id}
              record={record}
              orgConflicts={orgConflicts.filter((c) => c.backendId === record.id)}
              enableSwitch={enableSwitch}
              onEdit={(place) => setWizard({ recordId: record.id, mode: 'edit', place })}
              onRemoved={() => setWizard(null)}
            />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {offersDesktopApp && (
          <Button size="small" loading={desktopApp.busy} onClick={() => void desktopApp.connect()}>
            {t('workbench.settings.backendPane.connections.connectDesktop')}
          </Button>
        )}
        <Button size="small" onClick={() => void signInToServer()}>
          {t('workbench.settings.backendPane.connections.signInServer')}
        </Button>
      </div>
      {backends.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.5 }}>
          {offersDesktopApp && <div>{t('workbench.settings.backendPane.connections.emptyDesktopLine')}</div>}
          <div>{t('workbench.settings.backendPane.connections.emptyServerLine')}</div>
        </div>
      )}
      {wizard && <BackendWizard target={wizard} enableSwitch={enableSwitch} onClose={() => setWizard(null)} />}
      {enableSwitch.overlayElement}
    </PaneSection>
  );
};

const ConnectionRow: React.FC<{
  record: BackendConnection;
  orgConflicts: BackendOrgConflict[];
  enableSwitch: BackendEnableSwitchHandle;
  onEdit: (place: string) => void;
  onRemoved: () => void;
}> = ({ record, orgConflicts, enableSwitch, onEdit, onRemoved }) => {
  const { token } = theme.useToken();
  const t = useT();
  const host = getCurrentHost();
  const { status, detail } = useBackendRowStatus(record);
  const consumedOrgs = useConsumedOrgs(record.id);
  const write = useBackendRegistryWrite();

  // Dialog titles and toasts keep the record's own name (label, else
  // its address); the row itself names the place.
  const label = backendDisplayLabel(record);
  const place = backendPlace(
    host,
    record,
    consumedOrgs.map((org) => org.name),
  );
  const placeText = place.name ?? t('workbench.settings.backendPane.connections.place.desktopApp');
  const icon = backendModeIcon(deriveBackendMode(host, { ...record, enabled: true }));
  const removal = useBackendRemove(record, label, consumedOrgs, onRemoved);

  const patch = (next: BackendConnectionPatch): void => {
    void write(() => updateBackend(record.id, next));
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
        <BackendRowStatusDot status={status} detail={detail} />
        <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
          <BackendIcon kind={icon} size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: token.colorText,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {placeText}
            </span>
            <span style={{ fontSize: 11, color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>
              {t(BACKEND_ROW_STATUS_LABEL[status])}
            </span>
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
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'toggle',
                label: t(
                  record.enabled
                    ? 'workbench.settings.backendPane.connections.menu.disconnect'
                    : 'workbench.settings.backendPane.connections.menu.connect',
                ),
                disabled: enableSwitch.busy,
                onClick: () => {
                  void enableSwitch.setEnabled(record, !record.enabled);
                },
              },
              {
                key: 'edit',
                label: t('workbench.settings.backendPane.connections.menu.edit'),
                onClick: () => onEdit(placeText),
              },
              { type: 'divider' },
              {
                key: 'remove',
                label: t('workbench.settings.backendPane.connections.menu.remove'),
                danger: true,
                onClick: removal.remove,
              },
            ],
          }}
        >
          <Button
            size="small"
            type="text"
            icon={<MoreOutlined />}
            data-testid="synced-row-menu"
            aria-label={t('workbench.settings.backendPane.rowMenuAria', { label: placeText })}
          />
        </Dropdown>
      </div>
      {orgConflicts.map((conflict) => (
        <OrgConflictNotice key={conflict.orgId} conflict={conflict} />
      ))}
      {removal.element}
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
