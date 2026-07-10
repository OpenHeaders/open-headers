/**
 * Daemon administration console — the workbench surface for the
 * daemon's team tier: the user directory, per-workspace grants, device
 * management (tokens + pairing), and audit reports.
 *
 * Every read and mutation rides the `oh.daemon.*` bridge channels:
 * the desktop renderer reaches its own spine over IPC, the served web
 * tab forwards the same calls up its wire to the daemon's gated peer
 * admin plane. Rendering is probe-gated for honesty of affordance
 * only — the server re-gates every call as the caller per frame, so a
 * revoked admin sees in-band errors here, never a bypass.
 */

import {
  App as AntApp,
  Button,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';
import { useWorkspaces } from '../../../shared/hooks/readers/useWorkspaces';
import DaemonTokensSection from '../../settings/components/daemon-tokens-section';
import DaemonAuditReports from './DaemonAuditReports';
import { type DaemonAdminStatus, useDaemonAdminStatus } from './use-daemon-admin-status';

type DirectoryRole = 'owner' | 'editor' | 'viewer';

interface DirectoryUser {
  userId: string;
  displayName: string;
  email: string | null;
  createdAt: number;
  deactivatedAt: number | null;
  grants: ReadonlyArray<{ workspaceId: string; role: DirectoryRole; origin?: 'idp' }>;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: DirectoryRole; label: string }> = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'owner', label: 'Owner' },
];

function formatTimestamp(ms: number | null | undefined): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

const SectionHeader: React.FC<{ title: string; hint: string }> = ({ title, hint }) => {
  const { token } = theme.useToken();
  return (
    <header style={{ marginBottom: 6, padding: '0 2px' }}>
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
        {title}
      </h3>
      <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>{hint}</div>
    </header>
  );
};

/** Per-user grant editor — existing grants as revocable tags + an add row. */
const GrantsEditor: React.FC<{
  user: DirectoryUser;
  workspaceName: (id: string) => string;
  workspaceOptions: ReadonlyArray<{ value: string; label: string }>;
  onGrant: (userId: string, workspaceId: string, role: DirectoryRole) => Promise<void>;
  onRevokeGrant: (userId: string, workspaceId: string) => Promise<void>;
}> = ({ user, workspaceName, workspaceOptions, onGrant, onRevokeGrant }) => {
  const { token } = theme.useToken();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<DirectoryRole>('viewer');
  const [busy, setBusy] = useState(false);

  const granted = new Set(user.grants.map((g) => g.workspaceId));
  const addable = workspaceOptions.filter((o) => !granted.has(o.value));

  async function handleAdd(): Promise<void> {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await onGrant(user.userId, workspaceId, role);
      setWorkspaceId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {user.grants.length === 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            No workspace access yet.
          </Typography.Text>
        )}
        {user.grants.map((g) => (
          <Tooltip
            key={g.workspaceId}
            title={
              g.origin === 'idp'
                ? 'Granted by the identity-provider mapping. Revoking holds only until their next SSO login re-applies it.'
                : undefined
            }
          >
            <Tag
              closable={user.deactivatedAt === null}
              onClose={(e) => {
                e.preventDefault();
                void onRevokeGrant(user.userId, g.workspaceId);
              }}
              color={g.origin === 'idp' ? 'blue' : undefined}
              style={{ marginInlineEnd: 0 }}
            >
              {workspaceName(g.workspaceId)} · {g.role}
              {g.origin === 'idp' ? ' · IdP' : ''}
            </Tag>
          </Tooltip>
        ))}
      </div>
      {user.deactivatedAt === null && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Select
            size="small"
            placeholder="Workspace"
            style={{ minWidth: 180 }}
            value={workspaceId}
            options={[...addable]}
            onChange={(v) => setWorkspaceId(v)}
            showSearch
            optionFilterProp="label"
            disabled={addable.length === 0}
          />
          <Select
            size="small"
            style={{ width: 90 }}
            value={role}
            options={[...ROLE_OPTIONS]}
            onChange={(v) => setRole(v)}
          />
          <Button size="small" onClick={() => void handleAdd()} disabled={!workspaceId} loading={busy}>
            Grant
          </Button>
          {addable.length === 0 && user.grants.length > 0 && (
            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>Granted on every workspace.</span>
          )}
        </div>
      )}
    </div>
  );
};

const DaemonAdminConsole: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const adminStatus: DaemonAdminStatus = useDaemonAdminStatus();
  const { workspaces } = useWorkspaces();
  const [users, setUsers] = useState<readonly DirectoryUser[] | null>(null);
  const [addForm] = Form.useForm<{ displayName: string; email: string }>();
  const [adding, setAdding] = useState(false);

  const workspaceName = useCallback(
    (id: string): string => workspaces.find((w) => w.id === id)?.name ?? id,
    [workspaces],
  );
  const workspaceOptions = workspaces.map((w) => ({ value: w.id, label: w.name }));

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const resp = await hostBridge.call('oh.daemon.users.list');
      setUsers(resp.users);
    } catch (err) {
      message.error(`Failed to load the user directory: ${(err as Error).message}`);
      setUsers([]);
    }
  }, [message]);

  useEffect(() => {
    if (adminStatus === 'admin') void refresh();
  }, [adminStatus, refresh]);

  async function handleAddUser(values: { displayName: string; email: string }): Promise<void> {
    setAdding(true);
    try {
      const resp = await hostBridge.call('oh.daemon.users.create', {
        displayName: values.displayName.trim(),
        email: values.email?.trim() || undefined,
      });
      if (!resp.ok) throw new Error(resp.error);
      addForm.resetFields();
      await refresh();
    } catch (err) {
      message.error(`Failed to add user: ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleDeactivate(userId: string): Promise<void> {
    try {
      const resp = await hostBridge.call('oh.daemon.users.deactivate', { userId });
      if (!resp.ok) throw new Error(resp.error);
      message.success('User deactivated. Their tokens were revoked and live connections closed.');
      await refresh();
    } catch (err) {
      message.error(`Failed to deactivate: ${(err as Error).message}`);
    }
  }

  const handleGrant = useCallback(
    async (userId: string, workspaceId: string, role: DirectoryRole): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.grant', { userId, workspaceId, role });
        if (!resp.ok) throw new Error(resp.error);
        await refresh();
      } catch (err) {
        message.error(`Failed to grant: ${(err as Error).message}`);
      }
    },
    [message, refresh],
  );

  const handleRevokeGrant = useCallback(
    async (userId: string, workspaceId: string): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.revokeGrant', { userId, workspaceId });
        if (!resp.ok) throw new Error(resp.error);
        await refresh();
      } catch (err) {
        message.error(`Failed to revoke grant: ${(err as Error).message}`);
      }
    },
    [message, refresh],
  );

  if (adminStatus === 'unknown') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }
  if (adminStatus === 'denied') {
    return (
      <div style={{ padding: 48 }}>
        <Empty description="Administering this daemon requires the daemon.admin capability." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 32px' }} data-testid="daemon-admin-console">
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 2 }}>
        Daemon administration
      </Typography.Title>
      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 16 }}>
        Directory users sign in with a bound token or SSO and see exactly the workspaces granted here. Deactivation
        revokes the user's tokens and disconnects them immediately.
      </div>

      <section style={{ marginBottom: 12 }}>
        <SectionHeader
          title="Users"
          hint="Admit a user, then grant per-workspace roles below. Email joins SSO logins to the record."
        />
        <div
          className="settings-card"
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10,
            padding: 12,
          }}
        >
          <Form
            form={addForm}
            layout="inline"
            onFinish={handleAddUser}
            initialValues={{ displayName: '', email: '' }}
            style={{ marginBottom: users && users.length > 0 ? 12 : 0 }}
          >
            <Form.Item name="displayName" rules={[{ required: true, message: 'Name is required' }]} style={{ flex: 1 }}>
              <Input placeholder="Display name" maxLength={64} data-testid="daemon-admin-add-name" />
            </Form.Item>
            <Form.Item name="email" style={{ flex: 1 }}>
              <Input placeholder="Email (optional — required for SSO)" maxLength={128} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={adding} data-testid="daemon-admin-add-user">
                Add user
              </Button>
            </Form.Item>
          </Form>
          {users === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin size="small" />
            </div>
          ) : users.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              No directory users yet — the daemon runs in its solo tier. Add a user to open the team tier.
            </Typography.Text>
          ) : (
            <List
              size="small"
              dataSource={[...users].sort((a, b) => b.createdAt - a.createdAt)}
              renderItem={(u) => {
                const deactivated = u.deactivatedAt !== null;
                return (
                  <List.Item
                    data-testid={`daemon-admin-user-${u.userId}`}
                    actions={
                      deactivated
                        ? [
                            <Tag key="deactivated" color="default">
                              Deactivated {formatTimestamp(u.deactivatedAt)}
                            </Tag>,
                          ]
                        : [
                            <Popconfirm
                              key="deactivate"
                              title="Deactivate this user?"
                              description="Their tokens are revoked and live connections closed. Re-admit later by adding the same email anew."
                              okText="Deactivate"
                              cancelText="Cancel"
                              okButtonProps={{ danger: true }}
                              onConfirm={() => void handleDeactivate(u.userId)}
                            >
                              <Button type="link" size="small" danger>
                                Deactivate
                              </Button>
                            </Popconfirm>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      title={
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13 }}>{u.displayName}</span>
                          {u.email && (
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                              {u.email}
                            </Typography.Text>
                          )}
                        </span>
                      }
                      description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                            added {formatTimestamp(u.createdAt)}
                          </span>
                          <GrantsEditor
                            user={u}
                            workspaceName={workspaceName}
                            workspaceOptions={workspaceOptions}
                            onGrant={handleGrant}
                            onRevokeGrant={handleRevokeGrant}
                          />
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </section>

      {/* Tokens + pairing — the settings section rides the same
          oh.daemon.* channels, so it works here over the wire unchanged
          (its Pair-a-device modal included). */}
      <DaemonTokensSection />

      {/* Audit reports — actor names resolve through the directory
          loaded above, at view time (§9.3). */}
      <DaemonAuditReports
        users={(users ?? []).map((u) => ({ userId: u.userId, displayName: u.displayName }))}
        workspaceName={workspaceName}
        workspaceOptions={workspaceOptions}
      />
    </div>
  );
};

export default DaemonAdminConsole;
