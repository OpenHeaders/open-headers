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
import { type BridgeRpcRequest, type BridgeRpcResponse, hostBridge } from '@openheaders/core/bridge';
import { getDateTimeFormat, type MessageKey } from '@openheaders/i18n';
import { useLocale, useT } from '@openheaders/ui/context/LocaleContext';
import { useWorkspaces } from '../../../shared/hooks/readers/useWorkspaces';
import { noteUpgradeCtaShown, trackProductTelemetryEvent } from '../../../shared/product-telemetry';
import BackendTokensSection from '../../settings/components/backend-tokens-section';
import GitWorkspacePane, {
  type WorkspaceTreeRpcType,
  type WorkspaceTreeTransport,
} from '../../settings/components/git-workspace-pane';
import ServerAuditReports from './ServerAuditReports';
import ServerReleaseNotesCard from './ServerReleaseNotesCard';
import { type ServerAdminStatus, useServerAdminStatus } from './use-server-admin-status';

type DirectoryRole = 'owner' | 'editor' | 'viewer';

interface DirectoryUser {
  userId: string;
  displayName: string;
  email: string | null;
  gitEmail: string | null;
  createdAt: number;
  deactivatedAt: number | null;
  hasPassword: boolean;
  admission?: { licenseId: string; status: 'licensed' | 'grace' | 'expired' | 'invalid' };
  grants: ReadonlyArray<{ workspaceId: string; role: DirectoryRole; origin?: 'idp' }>;
}

/**
 * The Git card's call seam over the admin wire: every workspace-tree
 * verb rides `oh.daemon.workspaceTree.dispatch` to the daemon spine's
 * shared verb table (the git-sync plan §11.5). The dispatch channel's wire
 * response is untyped by construction (one channel, many ops), so the
 * op's own response shape is asserted here — the one narrowing seam.
 */
const adminGitTransport: WorkspaceTreeTransport = async <K extends WorkspaceTreeRpcType>(
  type: K,
  ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
): Promise<BridgeRpcResponse<K>> =>
  (await hostBridge.call('oh.daemon.workspaceTree.dispatch', {
    op: type,
    ...(args[0] !== undefined ? { payload: args[0] as Record<string, unknown> } : {}),
  })) as BridgeRpcResponse<K>;

const ROLE_LABELS: Record<DirectoryRole, MessageKey> = {
  viewer: 'workbench.serverAdmin.grants.roleViewer',
  editor: 'workbench.serverAdmin.grants.roleEditor',
  owner: 'workbench.serverAdmin.grants.roleOwner',
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
          ? t('workbench.serverAdmin.seat.healthyTooltip', { id: admission.licenseId })
          : t('workbench.serverAdmin.seat.lapsedTooltip', { id: admission.licenseId, status: admission.status })
      }
    >
      <Tag color={healthy ? 'purple' : 'orange'} style={{ marginInlineEnd: 0 }}>
        {t('workbench.serverAdmin.seat.tag')}
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
            {t('workbench.serverAdmin.grants.none')}
          </Typography.Text>
        )}
        {user.grants.map((g) => (
          <Tooltip
            key={g.workspaceId}
            title={g.origin === 'idp' ? t('workbench.serverAdmin.grants.idpTooltip') : undefined}
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
            placeholder={t('workbench.serverAdmin.grants.workspacePlaceholder')}
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
            {t('workbench.serverAdmin.grants.grantCta')}
          </Button>
          {addable.length === 0 && user.grants.length > 0 && (
            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
              {t('workbench.serverAdmin.grants.everyWorkspace')}
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
          ? t('workbench.serverAdmin.password.resetTitle', { name: user.displayName })
          : t('workbench.serverAdmin.password.setTitle', { name: user.displayName })
      }
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={busy}>
          {t('workbench.serverAdmin.cancel')}
        </Button>,
        <Button
          key="save"
          type="primary"
          disabled={password.length < 8}
          loading={busy}
          onClick={() => void apply(password)}
          data-testid="server-admin-password-save"
        >
          {user.hasPassword ? t('workbench.serverAdmin.password.resetCta') : t('workbench.serverAdmin.password.setCta')}
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.serverAdmin.password.explainer')}
        </Typography.Text>
        <Input.Password
          autoFocus
          placeholder={t('workbench.serverAdmin.password.placeholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={() => {
            if (password.length >= 8 && !busy) void apply(password);
          }}
          disabled={busy}
          data-testid="server-admin-password-input"
        />
        {user.hasPassword && (
          <Button danger size="small" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void apply(null)}>
            {t('workbench.serverAdmin.password.removeCta')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

/**
 * Set / change / remove a directory user's git commit-author email
 * override (the git-sync plan §11.5). Name is never editable here — commit
 * authorship always carries the directory displayName.
 */
const GitEmailModal: React.FC<{
  user: DirectoryUser;
  onClose: () => void;
  onSetGitEmail: (userId: string, gitEmail: string | null) => Promise<void>;
}> = ({ user, onClose, onSetGitEmail }) => {
  const t = useT();
  const [gitEmail, setGitEmail] = useState(user.gitEmail ?? '');
  const [busy, setBusy] = useState(false);

  async function apply(next: string | null): Promise<void> {
    setBusy(true);
    try {
      await onSetGitEmail(user.userId, next);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={
        user.gitEmail !== null
          ? t('workbench.serverAdmin.gitEmail.changeTitle', { name: user.displayName })
          : t('workbench.serverAdmin.gitEmail.setTitle', { name: user.displayName })
      }
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={busy}>
          {t('workbench.serverAdmin.cancel')}
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={busy}
          disabled={gitEmail.trim() === ''}
          onClick={() => void apply(gitEmail.trim())}
          data-testid="server-admin-git-email-save"
        >
          {user.gitEmail !== null
            ? t('workbench.serverAdmin.gitEmail.changeCta')
            : t('workbench.serverAdmin.gitEmail.setCta')}
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 12 }}>{t('workbench.serverAdmin.gitEmail.explainer')}</span>
        <Input
          value={gitEmail}
          onChange={(e) => setGitEmail(e.target.value)}
          placeholder={t('workbench.serverAdmin.gitEmail.placeholder')}
          maxLength={128}
          data-testid="server-admin-git-email-input"
        />
        {user.gitEmail !== null && (
          <Button danger size="small" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void apply(null)}>
            {t('workbench.serverAdmin.gitEmail.removeCta')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

const ServerAdminConsole: React.FC = () => {
  const { t, locale } = useLocale();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const adminStatus: ServerAdminStatus = useServerAdminStatus();
  const { workspaces } = useWorkspaces();
  const [users, setUsers] = useState<readonly DirectoryUser[] | null>(null);
  const [addForm] = Form.useForm<{ displayName: string; email: string; personalLicense: string }>();
  const [adding, setAdding] = useState(false);
  const [seatBlocked, setSeatBlocked] = useState(false);
  const [passwordUser, setPasswordUser] = useState<DirectoryUser | null>(null);
  const [gitEmailUser, setGitEmailUser] = useState<DirectoryUser | null>(null);
  const [gitWorkspaceId, setGitWorkspaceId] = useState<string | null>(null);

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
      message.error(t('workbench.serverAdmin.users.loadFailed', { message: (err as Error).message }));
      setUsers([]);
    }
  }, [message, t]);

  useEffect(() => {
    if (adminStatus === 'admin') void refresh();
  }, [adminStatus, refresh]);

  // Git section default: land on the first workspace so the card shows
  // real state without a pick; the Select re-targets it.
  useEffect(() => {
    if (gitWorkspaceId === null && workspaces.length > 0) setGitWorkspaceId(workspaces[0].id);
  }, [gitWorkspaceId, workspaces]);

  // The seat wall's pricing pointer is the seat-gate upgrade CTA.
  useEffect(() => {
    if (seatBlocked) noteUpgradeCtaShown('seat-gate');
  }, [seatBlocked]);

  async function handleAddUser(values: { displayName: string; email: string; personalLicense?: string }): Promise<void> {
    setAdding(true);
    try {
      const resp = await hostBridge.call('oh.daemon.users.create', {
        displayName: values.displayName.trim(),
        email: values.email?.trim() || undefined,
        personalLicense: values.personalLicense?.trim() || undefined,
      });
      if (!resp.ok) {
        // The seat wall is the conversion moment: reveal the redeem field
        // so the blocked admission can complete with the user's own seat.
        if (resp.reason === 'seat-limit-reached') {
          setSeatBlocked(true);
          trackProductTelemetryEvent({ name: 'paywall_hit', surface: 'seat-gate' });
        }
        message.error(t('workbench.serverAdmin.users.addFailed', { message: resp.error }));
        return;
      }
      addForm.resetFields();
      setSeatBlocked(false);
      await refresh();
    } catch (err) {
      message.error(t('workbench.serverAdmin.users.addFailed', { message: (err as Error).message }));
    } finally {
      setAdding(false);
    }
  }

  async function handleAbsorbSeat(userId: string): Promise<void> {
    try {
      const resp = await hostBridge.call('oh.daemon.users.absorbSeat', { userId });
      if (!resp.ok) throw new Error(resp.error);
      message.success(t('workbench.serverAdmin.seat.absorbed'));
      await refresh();
    } catch (err) {
      message.error(t('workbench.serverAdmin.seat.absorbFailed', { message: (err as Error).message }));
    }
  }

  async function handleDeactivate(userId: string): Promise<void> {
    try {
      const resp = await hostBridge.call('oh.daemon.users.deactivate', { userId });
      if (!resp.ok) throw new Error(resp.error);
      message.success(t('workbench.serverAdmin.deactivate.done'));
      await refresh();
    } catch (err) {
      message.error(t('workbench.serverAdmin.deactivate.failed', { message: (err as Error).message }));
    }
  }

  const handleGrant = useCallback(
    async (userId: string, workspaceId: string, role: DirectoryRole): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.grant', { userId, workspaceId, role });
        if (!resp.ok) throw new Error(resp.error);
        await refresh();
      } catch (err) {
        message.error(t('workbench.serverAdmin.grants.grantFailed', { message: (err as Error).message }));
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
          password === null ? t('workbench.serverAdmin.password.removedDone') : t('workbench.serverAdmin.password.setDone'),
        );
        await refresh();
      } catch (err) {
        message.error(t('workbench.serverAdmin.password.updateFailed', { message: (err as Error).message }));
      }
    },
    [message, refresh, t],
  );

  const handleSetGitEmail = useCallback(
    async (userId: string, gitEmail: string | null): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.users.setGitEmail', { userId, gitEmail });
        if (!resp.ok) throw new Error(resp.error);
        message.success(
          gitEmail === null
            ? t('workbench.serverAdmin.gitEmail.removedDone')
            : t('workbench.serverAdmin.gitEmail.setDone'),
        );
        await refresh();
      } catch (err) {
        message.error(t('workbench.serverAdmin.gitEmail.updateFailed', { message: (err as Error).message }));
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
        message.error(t('workbench.serverAdmin.grants.revokeFailed', { message: (err as Error).message }));
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
        <Empty description={t('workbench.serverAdmin.deniedDescription')} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 32px' }} data-testid="server-admin-console">
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 2 }}>
        {t('workbench.serverAdmin.title')}
      </Typography.Title>
      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 16 }}>
        {t('workbench.serverAdmin.intro')}
      </div>

      <section style={{ marginBottom: 12 }}>
        <SectionHeader
          title={t('workbench.serverAdmin.users.sectionTitle')}
          hint={t('workbench.serverAdmin.users.sectionHint')}
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
              rules={[{ required: true, message: t('workbench.serverAdmin.users.nameRequired') }]}
              style={{ flex: 1 }}
            >
              <Input
                placeholder={t('workbench.serverAdmin.users.displayNamePlaceholder')}
                maxLength={64}
                data-testid="server-admin-add-name"
              />
            </Form.Item>
            <Form.Item name="email" style={{ flex: 1 }}>
              <Input placeholder={t('workbench.serverAdmin.users.emailPlaceholder')} maxLength={128} />
            </Form.Item>
            {seatBlocked && (
              <Form.Item name="personalLicense" style={{ flex: 1, minWidth: 220 }}>
                <Input
                  placeholder={t('workbench.serverAdmin.users.seatKeyPlaceholder')}
                  data-testid="server-admin-personal-license"
                />
              </Form.Item>
            )}
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={adding} data-testid="server-admin-add-user">
                {t('workbench.serverAdmin.users.addUser')}
              </Button>
            </Form.Item>
          </Form>
          {seatBlocked && (
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 12 }}>
              {t('workbench.serverAdmin.users.seatLimit')} {t('workbench.serverAdmin.users.seatsSoldAt')}{' '}
              <Typography.Link
                href="https://openheaders.com/pricing"
                target="_blank"
                onClick={() => trackProductTelemetryEvent({ name: 'upgrade_cta_clicked', surface: 'seat-gate' })}
              >
                openheaders.com/pricing
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
              {t('workbench.serverAdmin.users.emptyDirectory')}
            </Typography.Text>
          ) : (
            <List
              size="small"
              dataSource={[...users].sort((a, b) => b.createdAt - a.createdAt)}
              renderItem={(u) => {
                const deactivated = u.deactivatedAt !== null;
                return (
                  <List.Item
                    data-testid={`server-admin-user-${u.userId}`}
                    actions={
                      deactivated
                        ? [
                            <Tag key="deactivated" color="default">
                              {t('workbench.serverAdmin.users.deactivatedOn', {
                                date: formatTimestamp(locale, u.deactivatedAt),
                              })}
                            </Tag>,
                          ]
                        : [
                            ...(u.admission
                              ? [
                                  <Popconfirm
                                    key="absorb"
                                    title={t('workbench.serverAdmin.seat.absorbTitle')}
                                    description={t('workbench.serverAdmin.seat.absorbDescription')}
                                    okText={t('workbench.serverAdmin.seat.absorbOk')}
                                    cancelText={t('workbench.serverAdmin.cancel')}
                                    onConfirm={() => void handleAbsorbSeat(u.userId)}
                                  >
                                    <Button type="link" size="small">
                                      {t('workbench.serverAdmin.seat.absorbCta')}
                                    </Button>
                                  </Popconfirm>,
                                ]
                              : []),
                            <Button
                              key="password"
                              type="link"
                              size="small"
                              onClick={() => setPasswordUser(u)}
                              data-testid={`server-admin-password-${u.userId}`}
                            >
                              {u.hasPassword
                                ? t('workbench.serverAdmin.password.resetCta')
                                : t('workbench.serverAdmin.password.setCta')}
                            </Button>,
                            <Button
                              key="gitEmail"
                              type="link"
                              size="small"
                              onClick={() => setGitEmailUser(u)}
                              data-testid={`server-admin-git-email-${u.userId}`}
                            >
                              {u.gitEmail !== null
                                ? t('workbench.serverAdmin.gitEmail.changeCta')
                                : t('workbench.serverAdmin.gitEmail.setCta')}
                            </Button>,
                            <Popconfirm
                              key="deactivate"
                              title={t('workbench.serverAdmin.deactivate.title')}
                              description={t('workbench.serverAdmin.deactivate.description')}
                              okText={t('workbench.serverAdmin.deactivate.cta')}
                              cancelText={t('workbench.serverAdmin.cancel')}
                              okButtonProps={{ danger: true }}
                              onConfirm={() => void handleDeactivate(u.userId)}
                            >
                              <Button type="link" size="small" danger>
                                {t('workbench.serverAdmin.deactivate.cta')}
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
                            {t('workbench.serverAdmin.users.addedOn', { date: formatTimestamp(locale, u.createdAt) })}
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
      {gitEmailUser && (
        <GitEmailModal user={gitEmailUser} onClose={() => setGitEmailUser(null)} onSetGitEmail={handleSetGitEmail} />
      )}

      {/* Git bindings (the git-sync plan §11.5) — the settings Git card over
          the gated dispatch wire; paths and repos live on the daemon.
          No native picker here: binds go through the path input. */}
      <section style={{ marginBottom: 12 }}>
        <SectionHeader
          title={t('workbench.serverAdmin.git.sectionTitle')}
          hint={t('workbench.serverAdmin.git.sectionHint')}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '0 2px' }}>
          <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
            {t('workbench.serverAdmin.git.workspaceLabel')}
          </span>
          <Select
            size="small"
            value={gitWorkspaceId}
            onChange={(value) => setGitWorkspaceId(value)}
            style={{ minWidth: 220 }}
            options={workspaceOptions}
            data-testid="server-admin-git-workspace"
          />
        </div>
        {gitWorkspaceId !== null && (
          <GitWorkspacePane transport={adminGitTransport} workspaceId={gitWorkspaceId} allowFolderPicker={false} />
        )}
      </section>

      {/* Tokens + pairing — the settings section rides the same
          oh.daemon.* channels, so it works here over the wire unchanged
          (its Pair-a-device modal included). */}
      <BackendTokensSection />

      {/* Audit reports — actor names resolve through the directory
          loaded above, at view time (§9.3). */}
      <ServerAuditReports
        users={(users ?? []).map((u) => ({ userId: u.userId, displayName: u.displayName }))}
        workspaceName={workspaceName}
        workspaceOptions={workspaceOptions}
      />

      {/* The server build's own release notes — served by the daemon
          from its build-embedded entry; hidden on entry-less builds and
          hosts that embed none (the desktop). */}
      <ServerReleaseNotesCard />
    </div>
  );
};

export default ServerAdminConsole;
