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
  Modal,
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
import { getDateTimeFormat, type MessageKey } from '@openheaders/i18n';
import { useLocale, useT } from '@openheaders/ui/context/LocaleContext';
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
  hasPassword: boolean;
  admission?: { licenseId: string; status: 'licensed' | 'grace' | 'expired' | 'invalid' };
  grants: ReadonlyArray<{ workspaceId: string; role: DirectoryRole; origin?: 'idp' }>;
}

const ROLE_LABELS: Record<DirectoryRole, MessageKey> = {
  viewer: 'workbench.daemonAdmin.grants.roleViewer',
  editor: 'workbench.daemonAdmin.grants.roleEditor',
  owner: 'workbench.daemonAdmin.grants.roleOwner',
};

const ROLE_VALUES: readonly DirectoryRole[] = ['viewer', 'editor', 'owner'];

/** Provenance tag for a personal-seat admission — status derived server-side at projection time. */
const PersonalSeatTag: React.FC<{ admission: NonNullable<DirectoryUser['admission']> }> = ({ admission }) => {
  const t = useT();
  const healthy = admission.status === 'licensed' || admission.status === 'grace';
  return (
    <Tooltip
      title={
        healthy
          ? t('workbench.daemonAdmin.seat.healthyTooltip', { id: admission.licenseId })
          : t('workbench.daemonAdmin.seat.lapsedTooltip', { id: admission.licenseId, status: admission.status })
      }
    >
      <Tag color={healthy ? 'purple' : 'orange'} style={{ marginInlineEnd: 0 }}>
        {t('workbench.daemonAdmin.seat.tag')}
        {healthy ? '' : ` · ${admission.status}`}
      </Tag>
    </Tooltip>
  );
};

function formatTimestamp(locale: string, ms: number | null | undefined): string {
  if (!ms) return '—';
  try {
    return getDateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(ms));
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
  const t = useT();
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
            {t('workbench.daemonAdmin.grants.none')}
          </Typography.Text>
        )}
        {user.grants.map((g) => (
          <Tooltip
            key={g.workspaceId}
            title={g.origin === 'idp' ? t('workbench.daemonAdmin.grants.idpTooltip') : undefined}
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
              {workspaceName(g.workspaceId)} · {t(ROLE_LABELS[g.role])}
              {g.origin === 'idp' ? ' · IdP' : ''}
            </Tag>
          </Tooltip>
        ))}
      </div>
      {user.deactivatedAt === null && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Select
            size="small"
            placeholder={t('workbench.daemonAdmin.grants.workspacePlaceholder')}
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
            options={ROLE_VALUES.map((r) => ({ value: r, label: t(ROLE_LABELS[r]) }))}
            onChange={(v) => setRole(v)}
          />
          <Button size="small" onClick={() => void handleAdd()} disabled={!workspaceId} loading={busy}>
            {t('workbench.daemonAdmin.grants.grantCta')}
          </Button>
          {addable.length === 0 && user.grants.length > 0 && (
            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
              {t('workbench.daemonAdmin.grants.everyWorkspace')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Set / reset / remove a directory user's local-login password. The
 * password is sent once over the admin plane and hashed daemon-side;
 * removing it only blocks NEW password logins — live sessions are
 * revoked from the tokens section like any other.
 */
const PasswordModal: React.FC<{
  user: DirectoryUser;
  onClose: () => void;
  onSetPassword: (userId: string, password: string | null) => Promise<void>;
}> = ({ user, onClose, onSetPassword }) => {
  const t = useT();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function apply(next: string | null): Promise<void> {
    setBusy(true);
    try {
      await onSetPassword(user.userId, next);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={
        user.hasPassword
          ? t('workbench.daemonAdmin.password.resetTitle', { name: user.displayName })
          : t('workbench.daemonAdmin.password.setTitle', { name: user.displayName })
      }
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={busy}>
          {t('workbench.daemonAdmin.cancel')}
        </Button>,
        <Button
          key="save"
          type="primary"
          disabled={password.length < 8}
          loading={busy}
          onClick={() => void apply(password)}
          data-testid="daemon-admin-password-save"
        >
          {user.hasPassword ? t('workbench.daemonAdmin.password.resetCta') : t('workbench.daemonAdmin.password.setCta')}
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.daemonAdmin.password.explainer')}
        </Typography.Text>
        <Input.Password
          autoFocus
          placeholder={t('workbench.daemonAdmin.password.placeholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={() => {
            if (password.length >= 8 && !busy) void apply(password);
          }}
          disabled={busy}
          data-testid="daemon-admin-password-input"
        />
        {user.hasPassword && (
          <Button danger size="small" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void apply(null)}>
            {t('workbench.daemonAdmin.password.removeCta')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

const DaemonAdminConsole: React.FC = () => {
  const { t, locale } = useLocale();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const adminStatus: DaemonAdminStatus = useDaemonAdminStatus();
  const { workspaces } = useWorkspaces();
  const [users, setUsers] = useState<readonly DirectoryUser[] | null>(null);
  const [addForm] = Form.useForm<{ displayName: string; email: string; personalLicense: string }>();
  const [adding, setAdding] = useState(false);
  const [seatBlocked, setSeatBlocked] = useState(false);
  const [passwordUser, setPasswordUser] = useState<DirectoryUser | null>(null);

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
      message.error(t('workbench.daemonAdmin.users.loadFailed', { message: (err as Error).message }));
      setUsers([]);
    }
  }, [message, t]);

  useEffect(() => {
    if (adminStatus === 'admin') void refresh();
  }, [adminStatus, refresh]);

  async function handleAddUser(values: { displayName: string; email: string; personalLicense?: string }): Promise<void> {
    setAdding(true);
    try {
      const resp = await hostBridge.call('oh.daemon.users.create', {
        displayName: values.displayName.trim(),
        email: values.email?.trim() || undefined,
        personalLicense: values.personalLicense?.trim() || undefined,
      });
      if (!resp.ok) throw new Error(resp.error);
      addForm.resetFields();
      setSeatBlocked(false);
      await refresh();
    } catch (err) {
      // The seat wall is the conversion moment: reveal the redeem field
      // so the blocked admission can complete with the user's own seat.
      if ((err as Error).message.includes('seat limit reached')) setSeatBlocked(true);
      message.error(t('workbench.daemonAdmin.users.addFailed', { message: (err as Error).message }));
    } finally {
      setAdding(false);
    }
  }

  async function handleAbsorbSeat(userId: string): Promise<void> {
    try {
      const resp = await hostBridge.call('oh.daemon.users.absorbSeat', { userId });
      if (!resp.ok) throw new Error(resp.error);
      message.success(t('workbench.daemonAdmin.seat.absorbed'));
      await refresh();
    } catch (err) {
      message.error(t('workbench.daemonAdmin.seat.absorbFailed', { message: (err as Error).message }));
    }
  }

  async function handleDeactivate(userId: string): Promise<void> {
    try {
      const resp = await hostBridge.call('oh.daemon.users.deactivate', { userId });
      if (!resp.ok) throw new Error(resp.error);
      message.success(t('workbench.daemonAdmin.deactivate.done'));
      await refresh();
    } catch (err) {
      message.error(t('workbench.daemonAdmin.deactivate.failed', { message: (err as Error).message }));
    }
  }

  const handleGrant = useCallback(
    async (userId: string, workspaceId: string, role: DirectoryRole): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.grant', { userId, workspaceId, role });
        if (!resp.ok) throw new Error(resp.error);
        await refresh();
      } catch (err) {
        message.error(t('workbench.daemonAdmin.grants.grantFailed', { message: (err as Error).message }));
      }
    },
    [message, refresh, t],
  );

  const handleSetPassword = useCallback(
    async (userId: string, password: string | null): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.setPassword', { userId, password });
        if (!resp.ok) throw new Error(resp.error);
        message.success(
          password === null ? t('workbench.daemonAdmin.password.removedDone') : t('workbench.daemonAdmin.password.setDone'),
        );
        await refresh();
      } catch (err) {
        message.error(t('workbench.daemonAdmin.password.updateFailed', { message: (err as Error).message }));
      }
    },
    [message, refresh, t],
  );

  const handleRevokeGrant = useCallback(
    async (userId: string, workspaceId: string): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.revokeGrant', { userId, workspaceId });
        if (!resp.ok) throw new Error(resp.error);
        await refresh();
      } catch (err) {
        message.error(t('workbench.daemonAdmin.grants.revokeFailed', { message: (err as Error).message }));
      }
    },
    [message, refresh, t],
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
        <Empty description={t('workbench.daemonAdmin.deniedDescription')} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 32px' }} data-testid="daemon-admin-console">
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 2 }}>
        {t('workbench.daemonAdmin.title')}
      </Typography.Title>
      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 16 }}>
        {t('workbench.daemonAdmin.intro')}
      </div>

      <section style={{ marginBottom: 12 }}>
        <SectionHeader
          title={t('workbench.daemonAdmin.users.sectionTitle')}
          hint={t('workbench.daemonAdmin.users.sectionHint')}
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
            initialValues={{ displayName: '', email: '', personalLicense: '' }}
            style={{ marginBottom: users && users.length > 0 ? 12 : 0 }}
          >
            <Form.Item
              name="displayName"
              rules={[{ required: true, message: t('workbench.daemonAdmin.users.nameRequired') }]}
              style={{ flex: 1 }}
            >
              <Input
                placeholder={t('workbench.daemonAdmin.users.displayNamePlaceholder')}
                maxLength={64}
                data-testid="daemon-admin-add-name"
              />
            </Form.Item>
            <Form.Item name="email" style={{ flex: 1 }}>
              <Input placeholder={t('workbench.daemonAdmin.users.emailPlaceholder')} maxLength={128} />
            </Form.Item>
            {seatBlocked && (
              <Form.Item name="personalLicense" style={{ flex: 1, minWidth: 220 }}>
                <Input
                  placeholder={t('workbench.daemonAdmin.users.seatKeyPlaceholder')}
                  data-testid="daemon-admin-personal-license"
                />
              </Form.Item>
            )}
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={adding} data-testid="daemon-admin-add-user">
                {t('workbench.daemonAdmin.users.addUser')}
              </Button>
            </Form.Item>
          </Form>
          {seatBlocked && (
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 12 }}>
              {t('workbench.daemonAdmin.users.seatLimit')} {t('workbench.daemonAdmin.users.seatsSoldAt')}{' '}
              <Typography.Link href="https://openheaders.io/pricing" target="_blank">
                openheaders.io/pricing
              </Typography.Link>
              .
            </div>
          )}
          {users === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin size="small" />
            </div>
          ) : users.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.daemonAdmin.users.emptyDirectory')}
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
                              {t('workbench.daemonAdmin.users.deactivatedOn', {
                                date: formatTimestamp(locale, u.deactivatedAt),
                              })}
                            </Tag>,
                          ]
                        : [
                            ...(u.admission
                              ? [
                                  <Popconfirm
                                    key="absorb"
                                    title={t('workbench.daemonAdmin.seat.absorbTitle')}
                                    description={t('workbench.daemonAdmin.seat.absorbDescription')}
                                    okText={t('workbench.daemonAdmin.seat.absorbOk')}
                                    cancelText={t('workbench.daemonAdmin.cancel')}
                                    onConfirm={() => void handleAbsorbSeat(u.userId)}
                                  >
                                    <Button type="link" size="small">
                                      {t('workbench.daemonAdmin.seat.absorbCta')}
                                    </Button>
                                  </Popconfirm>,
                                ]
                              : []),
                            <Button
                              key="password"
                              type="link"
                              size="small"
                              onClick={() => setPasswordUser(u)}
                              data-testid={`daemon-admin-password-${u.userId}`}
                            >
                              {u.hasPassword
                                ? t('workbench.daemonAdmin.password.resetCta')
                                : t('workbench.daemonAdmin.password.setCta')}
                            </Button>,
                            <Popconfirm
                              key="deactivate"
                              title={t('workbench.daemonAdmin.deactivate.title')}
                              description={t('workbench.daemonAdmin.deactivate.description')}
                              okText={t('workbench.daemonAdmin.deactivate.cta')}
                              cancelText={t('workbench.daemonAdmin.cancel')}
                              okButtonProps={{ danger: true }}
                              onConfirm={() => void handleDeactivate(u.userId)}
                            >
                              <Button type="link" size="small" danger>
                                {t('workbench.daemonAdmin.deactivate.cta')}
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
                          {u.admission && <PersonalSeatTag admission={u.admission} />}
                        </span>
                      }
                      description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                            {t('workbench.daemonAdmin.users.addedOn', { date: formatTimestamp(locale, u.createdAt) })}
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

      {passwordUser && (
        <PasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} onSetPassword={handleSetPassword} />
      )}

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
