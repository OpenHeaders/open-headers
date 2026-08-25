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
import type {
  WorkspaceMemberCandidate,
  WorkspaceMemberRow,
  WorkspacePublicShareApi,
} from '@openheaders/core/capabilities';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import {
  App as AntApp,
  Button,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import PublicShareReviewModal from './PublicShareReviewModal';

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
  /**
   * Write the workspace's visibility (the access-foundation plan §8
   * F5). Absent = no access section renders. The server owner-gates
   * the flip regardless; the control renders mutable only when the
   * members list says the caller is an owner. `public` is offered only
   * on hosts that register the `workspacePublicShare` capability
   * (F5b) — elsewhere the value renders as a verbatim immutable tag.
   */
  onVisibilityChange?: (visibility: 'private' | 'internal' | 'public') => Promise<boolean>;
}

interface MembersState {
  loading: boolean;
  error: string | null;
  callerRole: string | null;
  members: readonly WorkspaceMemberRow[];
  candidates: readonly WorkspaceMemberCandidate[];
}

const EMPTY_STATE: MembersState = { loading: true, error: null, callerRole: null, members: [], candidates: [] };

const WorkspaceMembersModal: React.FC<WorkspaceMembersModalProps> = ({ workspace, onClose, onVisibilityChange }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  // Resolved once per mount: capabilities are installed at boot, and a
  // per-render resolve would let an implementation returning a fresh
  // object retrigger the load effect on every render.
  const api = useMemo(() => getCapability('workspaceMembers')?.(), []);
  // Public snapshot plane (F5b) — present only on hosts whose server
  // answers the share verbs; gates the `public` Segmented option AND
  // the Public-link section below the access control.
  const publicShare = useMemo(() => getCapability('workspacePublicShare')?.(), []);
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

  // Access section (F5/F5b). The stored value is a plain string (the
  // forward-tolerant decode law): the known authoring values get the
  // owner Segmented — `public` counts as known only where the host
  // registers the share plane — and anything else renders verbatim as
  // an immutable tag, never coerced.
  const rawVisibility = workspace?.visibility;
  // Absent defaults per `resolveWorkspaceVisibility`'s law: private.
  const knownVisibility: 'private' | 'internal' | 'public' | null =
    rawVisibility === undefined
      ? 'private'
      : rawVisibility === 'private' || rawVisibility === 'internal'
        ? rawVisibility
        : rawVisibility === 'public' && publicShare !== undefined
          ? 'public'
          : null;
  const visibilityOptions: ReadonlyArray<'private' | 'internal' | 'public'> = publicShare
    ? ['private', 'internal', 'public']
    : ['private', 'internal'];
  const VISIBILITY_LABELS: Record<'private' | 'internal' | 'public', MessageKey> = {
    private: 'workbench.workspace.members.visibilityPrivate',
    internal: 'workbench.workspace.members.visibilityInternal',
    public: 'workbench.workspace.members.visibilityPublic',
  };
  const VISIBILITY_HINTS: Record<'private' | 'internal' | 'public', MessageKey> = {
    private: 'workbench.workspace.members.visibilityPrivateHint',
    internal: 'workbench.workspace.members.visibilityInternalHint',
    public: 'workbench.workspace.members.visibilityPublicHint',
  };
  const visibilityLabel = (value: 'private' | 'internal' | 'public'): string => t(VISIBILITY_LABELS[value]);

  const renderVisibilitySection = (): React.ReactNode => {
    if (!onVisibilityChange) return null;
    return (
      <div
        data-testid="workspace-members-visibility"
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
      >
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.workspace.members.visibilityLabel')}
        </Text>
        {isOwner && knownVisibility !== null ? (
          <Segmented
            size="small"
            value={knownVisibility}
            disabled={busy}
            data-testid="workspace-members-visibility-segmented"
            onChange={(value) => {
              const next = value === 'internal' || value === 'public' ? value : 'private';
              if (next === knownVisibility) return;
              void runMutation(
                () => onVisibilityChange(next).then((ok) => ({ ok })),
                t('workbench.workspace.members.visibilityUpdatedToast'),
              );
            }}
            options={visibilityOptions.map((value) => ({ value, label: visibilityLabel(value) }))}
          />
        ) : (
          <Tag data-testid="workspace-members-visibility-tag">
            {knownVisibility !== null ? visibilityLabel(knownVisibility) : rawVisibility}
          </Tag>
        )}
        {knownVisibility !== null && (
          <Text type="secondary" style={{ fontSize: 12, width: '100%' }}>
            {t(VISIBILITY_HINTS[knownVisibility])}
          </Text>
        )}
      </div>
    );
  };

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
          {renderVisibilitySection()}
          {publicShare !== undefined && isOwner && knownVisibility === 'public' && workspace !== null && (
            <PublicShareSection api={publicShare} workspaceId={workspace.id} workspaceName={workspace.name} />
          )}
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

// ── Public link section (F5b) ───────────────────────────────────────
//
// Rendered only for an OWNER on a `public`-visibility workspace where
// the host registers the share plane. The server is the single truth:
// the section re-reads status after every mutation, and the review
// modal (the decision-d moment) fronts both the first share and every
// re-share. Wording law: "Share publicly", never "Publish".

interface PublicShareSectionProps {
  api: WorkspacePublicShareApi;
  workspaceId: string;
  workspaceName: string;
}

interface PublicShareState {
  loading: boolean;
  error: string | null;
  enabled: boolean;
  publishedAt: string | null;
  path: string | null;
}

const PUBLIC_SHARE_EMPTY: PublicShareState = {
  loading: true,
  error: null,
  enabled: false,
  publishedAt: null,
  path: null,
};

const PublicShareSection: React.FC<PublicShareSectionProps> = ({ api, workspaceId, workspaceName }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [state, setState] = useState<PublicShareState>(PUBLIC_SHARE_EMPTY);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const result = await api.status(workspaceId).catch(() => null);
    if (!result || !result.ok) {
      setState({ ...PUBLIC_SHARE_EMPTY, loading: false, error: result?.error ?? t('workbench.workspace.publicShare.loadFailed') });
      return;
    }
    setState({
      loading: false,
      error: null,
      enabled: result.enabled === true,
      publishedAt: result.publishedAt ?? null,
      path: result.path ?? null,
    });
  }, [api, workspaceId, t]);

  useEffect(() => {
    setState(PUBLIC_SHARE_EMPTY);
    void load();
  }, [load]);

  const stopSharing = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.unpublish(workspaceId).catch(() => null);
      if (!result || !result.ok) {
        message.error(result?.error ?? t('workbench.workspace.members.updateFailed'));
        return;
      }
      message.success(t('workbench.workspace.publicShare.stoppedToast'));
      await load();
    } finally {
      setBusy(false);
    }
  }, [api, workspaceId, load, message, t]);

  const isShared = state.publishedAt !== null;
  const url = state.path !== null ? `${window.location.origin}${state.path}` : null;

  const renderBody = (): React.ReactNode => {
    if (state.loading) return <Spin size="small" />;
    if (state.error !== null) return <Text type="danger">{state.error}</Text>;
    if (!state.enabled) {
      return (
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="public-share-disabled-hint">
          {t('workbench.workspace.publicShare.disabledHint')}
        </Text>
      );
    }
    return (
      <>
        {isShared && url !== null ? (
          <>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {t('workbench.workspace.publicShare.sharedAt', {
                when: new Date(state.publishedAt ?? '').toLocaleString(),
              })}
            </Text>
            <Text
              style={{ fontFamily: token.fontFamilyCode, fontSize: 12, display: 'block' }}
              data-testid="public-share-url"
              copyable={{
                text: url,
                tooltips: [t('workbench.workspace.publicShare.copyLink'), t('workbench.workspace.publicShare.copiedToast')],
              }}
            >
              {url}
            </Text>
            <Space style={{ marginTop: 6 }}>
              <Button size="small" disabled={busy} data-testid="public-share-update" onClick={() => setReviewOpen(true)}>
                {t('workbench.workspace.publicShare.updateButton')}
              </Button>
              <Popconfirm
                title={t('workbench.workspace.publicShare.stopConfirm')}
                okText={t('workbench.workspace.publicShare.stopOk')}
                okButtonProps={{ danger: true }}
                onConfirm={() => void stopSharing()}
              >
                <Button size="small" danger disabled={busy} data-testid="public-share-stop">
                  {t('workbench.workspace.publicShare.stopButton')}
                </Button>
              </Popconfirm>
            </Space>
          </>
        ) : (
          <>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {t('workbench.workspace.publicShare.notShared')}
            </Text>
            <Button
              size="small"
              type="primary"
              disabled={busy}
              style={{ marginTop: 6 }}
              data-testid="public-share-open-review"
              onClick={() => setReviewOpen(true)}
            >
              {t('workbench.workspace.publicShare.shareButton')}
            </Button>
          </>
        )}
      </>
    );
  };

  return (
    <div
      data-testid="workspace-public-share"
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: '8px 12px',
        marginBottom: 12,
      }}
    >
      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
        {t('workbench.workspace.publicShare.heading')}
      </Text>
      {renderBody()}
      <PublicShareReviewModal
        open={reviewOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        isUpdate={isShared}
        api={api}
        onClose={() => setReviewOpen(false)}
        onShared={() => void load()}
      />
    </div>
  );
};

export default WorkspaceMembersModal;
