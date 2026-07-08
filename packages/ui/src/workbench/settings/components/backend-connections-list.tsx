/**
 * Connections list — the managed `OH.backends` records on the Back-end
 * pane (MULTI_BACKEND_PLAN.md §4). One row per record: status dot,
 * label, address, the Orgs consumed from it, the auto-connect and
 * enabled toggles, re-pair, edit, remove.
 *
 * Life of a record: **Add** appends it disabled with loopback defaults
 * and opens its editor; the user configures the address and pairs; the
 * **enabled toggle is the probe gate** — off→on verifies reachability +
 * auth and hard-aborts without committing on failure, so nothing
 * connects until the probe passes. The connection fields only render
 * while the record is disabled (an edit can never move a live wire);
 * disable first to reconfigure.
 *
 * Remove delegates to `backend-remove-flow.tsx`: a Popconfirm for
 * records with no consumed Orgs, the Keep-local-copies / Discard
 * outcome dialog for bound records.
 */

import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, Switch, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { type BackendConnectionPatch, createBackend, updateBackend } from '@openheaders/core/backends';
import { getOrgBackendBindings } from '@openheaders/core/identity';
import type { BackendConnection, Org } from '@openheaders/core/types';
import { useBackends } from '../../../shared/backend';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';
import { deriveBackendMode } from '../schema/backend';
import FieldRow from '../fields/FieldRow';
import BackendAuthTokenField from './backend-auth-token-field';
import { BackendIcon, backendModeIcon } from './backend-icons';
import {
  BackendRecordProvider,
  backendDisplayLabel,
  useBackendRecord,
} from './backend-record-context';
import { BackendRemoveButton } from './backend-remove-flow';
import BackendUrlField from './backend-url-field';
import { PairPopover } from './pair-popover';
import { type BackendEnableSwitchHandle, useBackendEnableSwitch } from './use-backend-enable-switch';
import { type BackendRowStatus, useBackendRowStatus } from './use-backend-row-status';

export const BackendConnectionsList: React.FC<{ host: Host }> = ({ host }) => {
  const { token } = theme.useToken();
  const backends = useBackends();
  const enableSwitch = useBackendEnableSwitch();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const add = async (): Promise<void> => {
    const created = await createBackend();
    setExpandedId(created.id);
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
            Connections
          </h3>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
            Back-ends this {host === 'extension' ? 'browser' : 'app'} has joined. Their workspaces sync down and stay
            usable offline.
          </div>
        </div>
        <Button size="small" icon={<PlusOutlined />} onClick={() => void add()}>
          Add back-end
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
          No connections — everything runs {host === 'extension' ? 'in this browser' : 'in this app'}. Add a back-end
          to sync workspaces from the desktop app or a self-hosted server.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backends.map((record) => (
            <ConnectionRow
              key={record.id}
              record={record}
              host={host}
              enableSwitch={enableSwitch}
              expanded={expandedId === record.id}
              onToggleExpanded={() => setExpandedId(expandedId === record.id ? null : record.id)}
              onRemoved={() => setExpandedId(null)}
            />
          ))}
        </div>
      )}
      {enableSwitch.overlayElement}
    </section>
  );
};

const STATUS_LABEL: Record<BackendRowStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  'auth-required': 'Re-pair needed',
  error: 'Connection down',
  off: 'Off',
};

const ConnectionRow: React.FC<{
  record: BackendConnection;
  host: Host;
  enableSwitch: BackendEnableSwitchHandle;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRemoved: () => void;
}> = ({ record, host, enableSwitch, expanded, onToggleExpanded, onRemoved }) => {
  const { token } = theme.useToken();
  const status = useBackendRowStatus(record);
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
        <StatusDot status={status} />
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
            buttonLabel="Re-pair"
            buttonType="primary"
          />
        )}
        <Checkbox checked={record.autoConnect} onChange={(e) => patch({ autoConnect: e.target.checked })}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Auto-connect</span>
        </Checkbox>
        <Tooltip title={record.enabled ? 'Disable to edit the connection' : undefined}>
          <Button
            size="small"
            type={expanded ? 'primary' : 'default'}
            icon={<EditOutlined />}
            disabled={record.enabled}
            aria-label={`Edit ${label}`}
            onClick={onToggleExpanded}
          />
        </Tooltip>
        <BackendRemoveButton record={record} label={label} consumedOrgs={consumedOrgs} onRemoved={onRemoved} />
        <Tooltip title={record.enabled ? 'Disconnect (settings are kept)' : 'Verify and connect'}>
          <Switch
            checked={record.enabled}
            disabled={enableSwitch.busy}
            aria-label={`${label} enabled`}
            onChange={(next) => {
              void enableSwitch.setEnabled(record, next);
            }}
          />
        </Tooltip>
      </div>
      {expanded && !record.enabled && (
        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <BackendRecordProvider record={record}>
            <BackendLabelField />
            <BackendUrlField />
            <BackendAuthTokenField />
          </BackendRecordProvider>
          <div style={{ padding: '8px 12px', fontSize: 11, color: token.colorTextTertiary }}>
            {host === 'desktop'
              ? 'Configure, then flip the switch — the connection is verified before it turns on.'
              : 'Configure and pair, then flip the switch — the connection is verified before it turns on.'}
          </div>
        </div>
      )}
    </div>
  );
};

/** Display-name editor for the record — bookkeeping, never re-dials. */
const BackendLabelField: React.FC = () => {
  const handle = useBackendRecord();
  const [draft, setDraft] = useState(handle?.record.label ?? '');
  if (!handle) return null;
  const commit = (): void => {
    if (draft !== handle.record.label) void handle.patch({ label: draft });
  };
  return (
    <FieldRow
      settingKey="backend.label"
      label="Name"
      description="What this back-end is called across the app. Defaults to its address."
      block
    >
      <Input
        style={{ width: '100%' }}
        value={draft}
        placeholder="Work VM"
        aria-label="Back-end name"
        maxLength={64}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
      />
    </FieldRow>
  );
};

const StatusDot: React.FC<{ status: BackendRowStatus }> = ({ status }) => {
  const { token } = theme.useToken();
  const color: Record<BackendRowStatus, string> = {
    connected: token.colorSuccess,
    connecting: token.colorWarning,
    'auth-required': token.colorWarning,
    error: token.colorError,
    off: token.colorTextQuaternary,
  };
  return (
    <Tooltip title={STATUS_LABEL[status]}>
      <span
        role="status"
        aria-label={STATUS_LABEL[status]}
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
