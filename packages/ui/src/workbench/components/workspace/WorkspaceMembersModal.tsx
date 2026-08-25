/**
 * WorkspaceMembersModal — owner self-service member management on one
 * server workspace (the access-foundation plan §8 F4), opened from the
 * WorkspaceManager row's Members button on hosts that register the
 * `workspaceMembers` capability (the served web tab).
 *
 * Any granted user sees the member list (the `workspace.read` floor —
 * you may see who else can see what you see); mutation affordances
 * render only when the server says the caller is an OWNER, and only on
 * rows the plane can touch: owner rows, the operator's row, managed
 * (`origin`-stamped) rows, and unknown future roles all render as
 * plain immutable tags (the forward-tolerant decode law — verbatim,
 * never a refusal). The server re-gates every call regardless; a
 * refusal's error string renders verbatim.
 */

import { DeleteOutlined, UserAddOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import type { WorkspaceMemberCandidate, WorkspaceMemberRow } from '@openheaders/core/capabilities';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { App as AntApp, Button, Modal, Popconfirm, Select, Space, Spin, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

const ROLE_LABELS: Record<'owner' | 'editor' | 'viewer', MessageKey> = {
  owner: 'workbench.serverAdmin.grants.roleOwner',
  editor: 'workbench.serverAdmin.grants.roleEditor',
  viewer: 'workbench.serverAdmin.grants.roleViewer',
};

type AssignableRole = 'editor' | 'viewer';

const ASSIGNABLE_ROLES: readonly AssignableRole[] = ['editor', 'viewer'];

function isAssignableRole(value: string): value is AssignableRole {
  return value === 'editor' || value === 'viewer';
}

interface WorkspaceMembersModalProps {
  /** Null closes the modal. */
  workspace: ExtensionWorkspace | null;
  onClose: () => void;
}

interface MembersState {
  loading: boolean;
  error: string | null;
  callerRole: string | null;
  members: readonly WorkspaceMemberRow[];
  candidates: readonly WorkspaceMemberCandidate[];
}

const EMPTY_STATE: MembersState = { loading: true, error: null, callerRole: null, members: [], candidates: [] };

const WorkspaceMembersModal: React.FC<WorkspaceMembersModalProps> = ({ workspace, onClose }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  // Resolved once per mount: capabilities are installed at boot, and a
  // per-render resolve would let an implementation returning a fresh
  // object retrigger the load effect on every render.
  const api = useMemo(() => getCapability('workspaceMembers')?.(), []);
  const [state, setState] = useState<MembersState>(EMPTY_STATE);
  const [addUserId, setAddUserId] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<AssignableRole>('editor');
  const [busy, setBusy] = useState(false);

  const workspaceId = workspace?.id ?? null;

  const load = useCallback(async () => {
    if (!api || !workspaceId) return;
    setState((prev) => ({ ...prev, loading: true }));
    const result = await api.list(workspaceId).catch(() => null);
    if (!result || !result.ok) {
      setState({
        loading: false,
        error: result?.error ?? t('workbench.workspace.members.loadFailed'),
        callerRole: null,
        members: [],
        candidates: [],
      });
      return;
    }
    setState({
      loading: false,
      error: null,
      callerRole: result.callerRole ?? null,
      members: result.members ?? [],
      candidates: result.candidates ?? [],
    });
  }, [api, workspaceId, t]);

  useEffect(() => {
    if (workspaceId === null) return;
    setState(EMPTY_STATE);
    setAddUserId(null);
    setAddRole('editor');
    void load();
  }, [workspaceId, load]);

  const isOwner = state.callerRole === 'owner';

  const runMutation = useCallback(
    async (mutate: () => Promise<{ ok: boolean; error?: string }>, successText: string): Promise<boolean> => {
      setBusy(true);
      try {
        const result = await mutate().catch(() => null);
        if (!result || !result.ok) {
          message.error(result?.error ?? t('workbench.workspace.members.updateFailed'));
          return false;
        }
        message.success(successText);
        await load();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [load, message, t],
  );

  const roleTag = (role: string): string =>
    role === 'owner' || role === 'editor' || role === 'viewer' ? t(ROLE_LABELS[role]) : role;

  const renderMember = (member: WorkspaceMemberRow): React.ReactNode => {
    // The plane touches only manual editor/viewer rows of directory
    // principals — everything else renders as an immutable tag.
    const mutable =
      isOwner &&
      !member.operator &&
      member.origin === undefined &&
      isAssignableRole(member.role) &&
      api !== undefined &&
      workspaceId !== null;
    return (
      <div
        key={member.userId}
        data-testid={`workspace-members-row-${member.userId}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 4px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={6}>
            <Text strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {member.displayName}
            </Text>
            {member.operator && <Tag color="gold">{t('workbench.workspace.members.operatorTag')}</Tag>}
            {member.kind === 'service' && <Tag color="geekblue">{t('workbench.serverAdmin.users.serviceTag')}</Tag>}
            {member.origin !== undefined && (
              <Tooltip title={t('workbench.workspace.members.managedTooltip')}>
                <Tag>{t('workbench.workspace.members.managedTag')}</Tag>
              </Tooltip>
            )}
          </Space>
          {member.email && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {member.email}
              </Text>
            </div>
          )}
        </div>
        {mutable ? (
          <Space>
            <Select
              size="small"
              value={member.role}
              disabled={busy}
              style={{ width: 110 }}
              data-testid={`workspace-members-role-${member.userId}`}
              onChange={(role: string) => {
                if (!isAssignableRole(role)) return;
                void runMutation(
                  () => api.grant(workspaceId, member.userId, role),
                  t('workbench.workspace.members.updatedToast', { name: member.displayName }),
                );
              }}
              options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: t(ROLE_LABELS[r]) }))}
            />
            <Popconfirm
              title={t('workbench.workspace.members.removeConfirm', { name: member.displayName })}
              okText={t('workbench.workspace.members.removeOk')}
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                void runMutation(
                  () => api.revoke(workspaceId, member.userId),
                  t('workbench.workspace.members.removedToast', { name: member.displayName }),
                )
              }
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={busy}
                data-testid={`workspace-members-remove-${member.userId}`}
                aria-label={t('workbench.workspace.members.removeAria')}
              />
            </Popconfirm>
          </Space>
        ) : (
          <Tag style={{ marginInlineEnd: 0 }}>{roleTag(member.role)}</Tag>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={workspace !== null}
      title={workspace ? t('workbench.workspace.members.title', { name: workspace.name }) : ''}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {state.loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : state.error !== null ? (
        <Text type="danger">{state.error}</Text>
      ) : (
        <>
          <div>{state.members.map(renderMember)}</div>
          {isOwner ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {state.candidates.length > 0 ? (
                <>
                  <Select
                    showSearch
                    placeholder={t('workbench.workspace.members.addPlaceholder')}
                    value={addUserId}
                    disabled={busy}
                    style={{ flex: 1, minWidth: 0 }}
                    data-testid="workspace-members-add-select"
                    onChange={(userId: string) => setAddUserId(userId)}
                    optionFilterProp="label"
                    options={state.candidates.map((c) => ({
                      value: c.userId,
                      label: c.email ? `${c.displayName} — ${c.email}` : c.displayName,
                    }))}
                  />
                  <Select
                    value={addRole}
                    disabled={busy}
                    style={{ width: 110 }}
                    data-testid="workspace-members-add-role"
                    onChange={(role: AssignableRole) => setAddRole(role)}
                    options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: t(ROLE_LABELS[r]) }))}
                  />
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    disabled={busy || addUserId === null || !api || workspaceId === null}
                    data-testid="workspace-members-add-btn"
                    onClick={() => {
                      if (!api || workspaceId === null || addUserId === null) return;
                      const candidate = state.candidates.find((c) => c.userId === addUserId);
                      void runMutation(
                        () => api.grant(workspaceId, addUserId, addRole),
                        t('workbench.workspace.members.addedToast', {
                          name: candidate?.displayName ?? addUserId,
                        }),
                      ).then((ok) => {
                        if (ok) setAddUserId(null);
                      });
                    }}
                  >
                    {t('workbench.workspace.members.addButton')}
                  </Button>
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('workbench.workspace.members.noneToAdd')}
                </Text>
              )}
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
              {t('workbench.workspace.members.readOnlyHint')}
            </Text>
          )}
        </>
      )}
    </Modal>
  );
};

export default WorkspaceMembersModal;
