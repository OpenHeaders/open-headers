/**
 * WorkspaceManager — full-page workspace administration (workbench.html
 * only). Lives in its own tab mode; invoked from the WorkspaceSwitcher
 * dropdown's "Manage workspaces…" item or the command palette.
 *
 * Responsibilities:
 *   - List every workspace with name, color, created timestamp
 *   - Create / rename / delete / duplicate (via the bridge RPCs
 *     exposed on `UseWorkspacesApi`)
 *   - Drag-to-reorder via @dnd-kit — writes `sortIndex` back through
 *     `reorderWorkspaces`
 *   - Color picker per workspace (neutral + 8 presets)
 *
 * Business logic lives in the hook; this component renders + delegates.
 * Delete of the last remaining workspace is disabled at the UI level in
 * addition to being rejected by the orchestrator.
 */

import {
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  LogoutOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getCapability } from '@openheaders/core/capabilities';
import { type OrgDescriptor, orgCatalogue } from '@openheaders/core/identity';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import { usePublishTargets } from '@openheaders/ui/shared/backend';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import type { UseWorkspacesApi } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { orgChoiceCatalogue } from '@openheaders/ui/shared/workspace-org/org-choice';
import { useOrgPlace } from '@openheaders/ui/shared/workspace-org/use-org-place';
import { OrgIcon } from '@openheaders/ui/shared/workspace-org/OrgIcon';
import { App as AntApp, Button, Checkbox, Form, Input, Modal, Select, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import HomeOrgIdentityCard from './HomeOrgIdentityCard';
import PublishWorkspaceModal from './PublishWorkspaceModal';
import WorkspaceIdentityPicker, { type WorkspaceIdentity } from './WorkspaceIdentityPicker';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import { DEFAULT_WORKSPACE_ICON } from './workspace-colors';
import { renderWorkspacePrefix } from './workspace-prefix';

const { Title, Text } = Typography;

interface WorkspaceManagerProps {
  api: UseWorkspacesApi;
  /**
   * Editing-scope workspace id — what the active surface considers
   * "active" right now. In global mode this equals the oracle's active
   * workspace id; in per-window-or-tab mode it's the surface's bound
   * workspace, which may differ from the oracle.
   */
  activeWorkspaceId: string | null;
  /**
   * Mode-aware switch gesture. In global mode it writes the oracle; in
   * per-window-or-tab mode it writes only the surface's slice. Sourced
   * from the App-level handler so the dirty-draft confirmation runs.
   */
  onSwitch: (id: string) => void;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ api, activeWorkspaceId, onSwitch }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message, modal } = AntApp.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExtensionWorkspace | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ExtensionWorkspace | null>(null);
  const [publishSource, setPublishSource] = useState<ExtensionWorkspace | null>(null);
  const [membersTarget, setMembersTarget] = useState<ExtensionWorkspace | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const canDelete = api.workspaces.length > 1;

  const snapshot = useIdentitySnapshot();
  const catalogue = useMemo(() => orgCatalogue(snapshot), [snapshot]);
  // Org-choice surfaces (Duplicate-into; the new-workspace placement
  // row lives on Backup and Sync › Sync) offer the clamped set — server
  // Orgs only on the joined web host; the grouped LIST below keeps the
  // full catalogue, since a workspace that exists still needs its Org
  // section rendered.
  const orgChoices = useMemo(() => orgChoiceCatalogue(catalogue), [catalogue]);

  // Publish = Duplicate-into pointed at a joined Org. A workspace's own
  // Org is not a target (that's plain Duplicate); with no joined Orgs
  // there is no publish surface at all.
  const publishTargets = usePublishTargets();
  const publishTargetsFor = useCallback(
    (workspace: ExtensionWorkspace) => publishTargets.filter((t) => t.orgId !== workspace.orgId),
    [publishTargets],
  );

  // Org is the top-level container — group the workspace list by Org so a
  // foreign-Org workspace never reads as belonging to the home-Org card.
  // `null` (flat list) until the identity holds more than one Org.
  const groups = useMemo(() => {
    if (catalogue.length <= 1) return null;
    const byOrg = new Map<string, ExtensionWorkspace[]>();
    for (const w of api.workspaces) {
      const arr = byOrg.get(w.orgId);
      if (arr) arr.push(w);
      else byOrg.set(w.orgId, [w]);
    }
    const ordered: Array<{ orgId: string; descriptor: OrgDescriptor | null; items: ExtensionWorkspace[] }> = [];
    for (const descriptor of catalogue) {
      const items = byOrg.get(descriptor.id);
      if (items && items.length > 0) ordered.push({ orgId: descriptor.id, descriptor, items });
      byOrg.delete(descriptor.id);
    }
    // Workspaces whose Org isn't in the catalogue still get a group.
    for (const [orgId, items] of byOrg) ordered.push({ orgId, descriptor: null, items });
    return ordered;
  }, [catalogue, api.workspaces]);

  // The SortableContext id order must match render order.
  const orderedIds = useMemo(
    () => (groups ? groups.flatMap((g) => g.items.map((w) => w.id)) : api.workspaces.map((w) => w.id)),
    [groups, api.workspaces],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = orderedIds.indexOf(String(active.id));
      const newIndex = orderedIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      void api.reorderWorkspaces(arrayMove(orderedIds, oldIndex, newIndex));
    },
    [api, orderedIds],
  );

  const handleDelete = useCallback(
    (workspace: ExtensionWorkspace) => {
      modal.confirm({
        title: t('workbench.workspace.deleteTitle', { name: workspace.name }),
        content: t('workbench.workspace.deleteBody'),
        okText: t('workbench.workspace.deleteOk'),
        okButtonProps: { danger: true },
        onOk: async () => {
          const result = await api.deleteWorkspace(workspace.id);
          if (!result.success) message.error(result.error ?? t('workbench.workspace.deleteFailed'));
          else message.success(t('workbench.workspace.deletedToast', { name: workspace.name }));
        },
      });
    },
    [api, modal, message, t],
  );

  const handleDuplicate = useCallback((workspace: ExtensionWorkspace) => {
    setDuplicateTarget(workspace);
  }, []);

  // Self-service leave (QD) — registered only by hosts whose listed
  // workspaces are grant-held (the served web tab). On success the
  // server's retraction push evicts the workspace from every open tab
  // of this user, so no local removal follows the call.
  const leaveWorkspace = getCapability('leaveWorkspace');
  // Owner self-service member management (F4) — same host posture; the
  // server gates mutations on the caller's owner role per call, so the
  // affordance renders for every row and the modal is honest about
  // what the caller may change.
  const workspaceMembers = getCapability('workspaceMembers');
  const handleLeave = useCallback(
    (workspace: ExtensionWorkspace) => {
      if (!leaveWorkspace) return;
      modal.confirm({
        title: t('workbench.workspace.leaveTitle', { name: workspace.name }),
        content: t('workbench.workspace.leaveBody'),
        okText: t('workbench.workspace.leaveOk'),
        okButtonProps: { danger: true },
        onOk: async () => {
          const result = await leaveWorkspace(workspace.id);
          if (!result.ok) message.error(result.error ?? t('workbench.workspace.leaveFailed'));
          else message.success(t('workbench.workspace.leftToast', { name: workspace.name }));
        },
      });
    },
    [leaveWorkspace, modal, message, t],
  );

  const renderRow = (w: ExtensionWorkspace): React.ReactNode => (
    <SortableRow
      key={w.id}
      workspace={w}
      isActive={w.id === activeWorkspaceId}
      canDelete={canDelete}
      onEdit={() => setEditTarget(w)}
      onDelete={() => handleDelete(w)}
      onDuplicate={() => handleDuplicate(w)}
      onPublish={publishTargetsFor(w).length > 0 ? () => setPublishSource(w) : null}
      onMembers={workspaceMembers ? () => setMembersTarget(w) : null}
      onLeave={leaveWorkspace ? () => handleLeave(w) : null}
      onSwitch={() => onSwitch(w.id)}
      onIdentityChange={(identity) => {
        // Coerce undefined icon → null so the backend's "clear" path
        // runs instead of "leave unchanged".
        void api.updateWorkspace(w.id, { color: identity.color, icon: identity.icon ?? null });
      }}
      tokenColorBorder={token.colorBorderSecondary}
      tokenColorBg={token.colorBgContainer}
      tokenColorPrimary={token.colorPrimary}
    />
  );

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: '0 auto', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('workbench.workspace.title')}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('workbench.workspace.newWorkspace')}
        </Button>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {t('workbench.workspace.intro')}
      </Text>

      <HomeOrgIdentityCard />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {groups
              ? groups.map((group) => (
                  <div key={group.orgId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* The home Org is already headed by HomeOrgIdentityCard
                        above; every other Org gets its own section header. */}
                    {!group.descriptor?.isHome && <OrgGroupHeader descriptor={group.descriptor} />}
                    {group.items.map(renderRow)}
                  </div>
                ))
              : api.workspaces.map(renderRow)}
          </div>
        </SortableContext>
      </DndContext>

      <WorkspaceFormModal
        open={createOpen}
        title={t('workbench.workspace.newWorkspace')}
        okText={t('workbench.workspace.createOk')}
        onCancel={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          const ws = await api.createWorkspace(values);
          if (!ws) {
            message.error(t('workbench.workspace.createFailed'));
            return false;
          }
          message.success(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' }}>
              {t('workbench.workspace.createdToastPrefix')}
              {renderWorkspacePrefix({ icon: ws.icon, color: ws.color }, token, { size: 16 })}
              {ws.name}
            </span>,
          );
          return true;
        }}
      />

      <DuplicateWorkspaceModal
        source={duplicateTarget}
        catalogue={orgChoices}
        onCancel={() => setDuplicateTarget(null)}
        onSubmit={async (values) => {
          if (!duplicateTarget) return false;
          const created = await api.duplicateWorkspace(duplicateTarget.id, values);
          if (!created) {
            message.error(t('workbench.workspace.duplicateFailed'));
            return false;
          }
          message.success(t('workbench.workspace.duplicatedToast', { source: duplicateTarget.name, name: created.name }));
          return true;
        }}
      />

      <WorkspaceMembersModal
        // Live row lookup: a visibility flip lands through the mirror,
        // and the open modal must show the post-write value rather than
        // the record captured when the modal opened.
        workspace={membersTarget ? (api.workspaces.find((w) => w.id === membersTarget.id) ?? membersTarget) : null}
        onClose={() => setMembersTarget(null)}
        onVisibilityChange={async (visibility) => {
          if (!membersTarget) return false;
          const result = await api.updateWorkspace(membersTarget.id, { visibility });
          return result.success;
        }}
      />

      <PublishWorkspaceModal
        source={publishSource}
        targets={publishSource ? publishTargetsFor(publishSource) : []}
        onCancel={() => setPublishSource(null)}
        onSubmit={async (values) => {
          if (!publishSource) return false;
          const created = await api.duplicateWorkspace(publishSource.id, values);
          if (!created) {
            message.error(t('workbench.workspace.publishFailed'));
            return false;
          }
          const target = publishTargets.find((pt) => pt.orgId === values.targetOrgId);
          message.success(
            t('workbench.workspace.publishedToast', {
              name: created.name,
              org: target?.orgName ?? t('workbench.workspace.selectedOrgFallback'),
            }),
          );
          return true;
        }}
      />

      <WorkspaceFormModal
        open={editTarget !== null}
        title={t('workbench.workspace.editTitle')}
        okText={t('workbench.workspace.saveOk')}
        initial={editTarget ?? undefined}
        onCancel={() => setEditTarget(null)}
        onSubmit={async (values) => {
          if (!editTarget) return false;
          // Explicit null clears the icon on the backend — the picker
          // emits `undefined` when the user selects "No icon", so
          // coerce undefined to null here to distinguish "no change"
          // (field not in the patch) from "clear it" (null).
          const result = await api.updateWorkspace(editTarget.id, { ...values, icon: values.icon ?? null });
          if (result.success) {
            message.success(t('workbench.workspace.updatedToast', { name: result.workspace.name }));
            return true;
          }
          if (result.reason === 'not-found') {
            message.error(t('workbench.workspace.deletedElsewhere'));
            setEditTarget(null);
            return false;
          }
          message.error(
            'message' in result
              ? t('workbench.workspace.updateFailedWithMessage', { message: result.message })
              : t('workbench.workspace.updateFailed'),
          );
          return false;
        }}
      />
    </div>
  );
};

// ── Org section header ──────────────────────────────────────────────

const OrgGroupHeader: React.FC<{ descriptor: OrgDescriptor | null }> = ({ descriptor }) => {
  const { token } = theme.useToken();
  const t = useT();
  const placeOf = useOrgPlace();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px 2px' }}>
      {descriptor && <OrgIcon descriptor={descriptor} size={14} style={{ color: token.colorTextTertiary }} />}
      <Text
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: token.colorTextTertiary,
        }}
      >
        {descriptor ? placeOf(descriptor) : t('workbench.workspace.otherWorkspaces')}
      </Text>
    </div>
  );
};

// ── Sortable row ─────────────────────────────────────────────────────

interface SortableRowProps {
  workspace: ExtensionWorkspace;
  isActive: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** Null when no publishable target exists — the button doesn't render. */
  onPublish: (() => void) | null;
  /** Null when the host has no members plane — the button doesn't render. */
  onMembers: (() => void) | null;
  /** Null when the host has no leave verb — the button doesn't render. */
  onLeave: (() => void) | null;
  onSwitch: () => void;
  onIdentityChange: (next: WorkspaceIdentity) => void;
  tokenColorBorder: string;
  tokenColorBg: string;
  tokenColorPrimary: string;
}

const SortableRow: React.FC<SortableRowProps> = ({
  workspace,
  isActive,
  canDelete,
  onEdit,
  onDelete,
  onDuplicate,
  onPublish,
  onMembers,
  onLeave,
  onSwitch,
  onIdentityChange,
  tokenColorBorder,
  tokenColorBg,
  tokenColorPrimary,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: workspace.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1px solid ${isActive ? tokenColorPrimary : tokenColorBorder}`,
        background: tokenColorBg,
        borderRadius: 6,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('workbench.workspace.dragToReorder')}
        style={{
          cursor: 'grab',
          color: token.colorTextTertiary,
          display: 'inline-flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
      >
        <HolderOutlined />
      </button>

      {/* Combined identity picker — clicking the icon opens the same
          popover as the create/edit modal, letting the user change
          icon + color inline. */}
      <WorkspaceIdentityPicker
        value={{ icon: workspace.icon, color: workspace.color ?? 'neutral' }}
        onChange={onIdentityChange}
        size={28}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text
            strong
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}
            title={workspace.name}
          >
            {workspace.name}
          </Text>
          {isActive && (
            <Text
              type="secondary"
              style={{
                fontSize: 11,
                padding: '1px 6px',
                border: `1px solid ${tokenColorPrimary}`,
                borderRadius: 4,
                color: tokenColorPrimary,
              }}
            >
              {t('workbench.workspace.activePill')}
            </Text>
          )}
        </div>
        {workspace.description ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {workspace.description}
          </Text>
        ) : null}
      </div>

      <Space>
        {!isActive && (
          <Button size="small" onClick={onSwitch}>
            {t('workbench.workspace.switch')}
          </Button>
        )}
        <Button size="small" icon={<EditOutlined />} onClick={onEdit} aria-label={t('workbench.workspace.renameAria')} />
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={onDuplicate}
          aria-label={t('workbench.workspace.duplicateAria')}
        />
        {onPublish && (
          <Button
            size="small"
            icon={<CloudUploadOutlined />}
            onClick={onPublish}
            aria-label={t('workbench.workspace.publishAria')}
          />
        )}
        {onMembers && (
          <Button
            size="small"
            icon={<TeamOutlined />}
            onClick={onMembers}
            data-testid={`workspace-members-open-${workspace.id}`}
            aria-label={t('workbench.workspace.members.openAria')}
          />
        )}
        {onLeave && (
          <Button
            size="small"
            icon={<LogoutOutlined />}
            danger
            onClick={onLeave}
            aria-label={t('workbench.workspace.leaveAria')}
          />
        )}
        <Button
          size="small"
          icon={<DeleteOutlined />}
          danger
          onClick={onDelete}
          disabled={!canDelete}
          aria-label={t('workbench.workspace.deleteAria')}
        />
      </Space>
    </div>
  );
};

// ── Create / edit modal ─────────────────────────────────────────────

interface WorkspaceFormValues {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface WorkspaceFormModalProps {
  open: boolean;
  title: string;
  okText: string;
  initial?: ExtensionWorkspace;
  onCancel: () => void;
  onSubmit: (values: WorkspaceFormValues) => Promise<boolean>;
}

const WorkspaceFormModal: React.FC<WorkspaceFormModalProps> = ({
  open,
  title,
  okText,
  initial,
  onCancel,
  onSubmit,
}) => {
  const t = useT();
  const [form] = Form.useForm<WorkspaceFormValues>();

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const ok = await onSubmit(values);
      if (ok) {
        form.resetFields();
        onCancel();
      }
    } catch {
      // validation error — keep modal open
    }
  }, [form, onSubmit, onCancel]);

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          initial
            ? {
                name: initial.name,
                description: initial.description,
                color: initial.color ?? 'neutral',
                // Preserve the absence of an icon (color-only mode)
                // on edit — only new workspaces inherit the default
                // icon.
                icon: initial.icon,
              }
            : { color: 'neutral', icon: DEFAULT_WORKSPACE_ICON }
        }
      >
        {/* Single prefix picker — user picks either a color (square)
            or a color + icon (tinted icon). Never both. The form
            keeps `icon` and `color` as separate fields so the backend
            patch contract stays unchanged. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
          <Form.Item label={t('workbench.workspace.prefixLabel')} style={{ marginBottom: 0 }} shouldUpdate>
            {({ getFieldValue, setFieldsValue }) => (
              <WorkspaceIdentityPicker
                value={{
                  icon: getFieldValue('icon') as string | undefined,
                  color: (getFieldValue('color') as string | undefined) ?? 'neutral',
                }}
                onChange={(next) => setFieldsValue(next)}
              />
            )}
          </Form.Item>
          <Form.Item
            name="name"
            label={t('workbench.workspace.nameLabel')}
            rules={[
              { required: true, message: t('workbench.workspace.nameRequired') },
              { max: 60, message: t('workbench.workspace.nameTooLong') },
            ]}
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Input autoFocus placeholder={t('workbench.workspace.namePlaceholder')} />
          </Form.Item>
        </div>

        {/* Hidden fields — the picker writes both through setFieldsValue. */}
        <Form.Item name="icon" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="color" hidden>
          <Input />
        </Form.Item>

        <Form.Item name="description" label={t('workbench.workspace.descriptionLabel')}>
          <Input.TextArea rows={2} maxLength={240} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ── Duplicate-into modal ─────────────────────────────────────────────
//
// Always-open dialog from the row's Duplicate button. Three controls:
// Name (pre-filled `Copy of {source}`), target Org (Select over the
// snapshot's catalogue; default = source's Org), and Include-vault
// checkbox (off by default — secrets re-entered in the duplicate).

interface DuplicateFormValues {
  name: string;
  targetOrgId: string;
  includeSecrets: boolean;
}

interface DuplicateWorkspaceModalProps {
  source: ExtensionWorkspace | null;
  catalogue: OrgDescriptor[];
  onCancel: () => void;
  onSubmit: (values: DuplicateFormValues) => Promise<boolean>;
}

const DuplicateWorkspaceModal: React.FC<DuplicateWorkspaceModalProps> = ({ source, catalogue, onCancel, onSubmit }) => {
  const t = useT();
  const placeOf = useOrgPlace();
  const [form] = Form.useForm<DuplicateFormValues>();

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const ok = await onSubmit(values);
      if (ok) {
        form.resetFields();
        onCancel();
      }
    } catch {
      // validation error — keep modal open
    }
  }, [form, onSubmit, onCancel]);

  return (
    <Modal
      open={source !== null}
      title={
        source
          ? t('workbench.workspace.duplicateTitle', { name: source.name })
          : t('workbench.workspace.duplicateTitleFallback')
      }
      okText={t('workbench.workspace.duplicateOk')}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      destroyOnHidden
    >
      {source && (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{
            name: t('workbench.workspace.copyOfName', { name: source.name }),
            // The source's own Org unless the choice clamp excludes it
            // (a local workspace duplicated on a joined web tab).
            targetOrgId: catalogue.some((d) => d.id === source.orgId) ? source.orgId : catalogue[0]?.id,
            includeSecrets: false,
          }}
          onFinish={handleOk}
        >
          <Form.Item
            name="name"
            label={t('workbench.workspace.nameLabel')}
            rules={[
              { required: true, message: t('workbench.workspace.nameRequired') },
              { max: 60, message: t('workbench.workspace.nameTooLong') },
            ]}
          >
            <Input autoFocus placeholder={t('workbench.workspace.copyOfPlaceholder')} />
          </Form.Item>

          <Form.Item name="targetOrgId" label={t('workbench.workspace.intoOrg')} rules={[{ required: true }]}>
            <Select
              options={catalogue.map((descriptor) => ({
                value: descriptor.id,
                label: (
                  <Space size={6}>
                    <OrgIcon descriptor={descriptor} size={13} />
                    {placeOf(descriptor)}
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item name="includeSecrets" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Checkbox>{t('workbench.workspace.includeSecrets')}</Checkbox>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.workspace.includeSecretsHint')}
          </Text>
        </Form>
      )}
    </Modal>
  );
};

export default WorkspaceManager;
