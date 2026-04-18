/**
 * WorkspaceManager — full-page workspace administration (workspace.html
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

import { CopyOutlined, DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { V5 } from '@openheaders/core/types';
import { App as AntApp, Button, Form, Input, Modal, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import type { UseWorkspacesApi } from '@/hooks/useWorkspaces';
import WorkspaceIdentityPicker, { type WorkspaceIdentity } from './WorkspaceIdentityPicker';
import { DEFAULT_WORKSPACE_ICON } from './workspace-colors';

const { Title, Text } = Typography;

interface WorkspaceManagerProps {
  api: UseWorkspacesApi;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ api }) => {
  const { token } = theme.useToken();
  const { message, modal } = AntApp.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<V5.ExtensionWorkspace | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const canDelete = api.workspaces.length > 1;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = api.workspaces.map((w) => w.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(ids, oldIndex, newIndex);
      void api.reorderWorkspaces(next);
    },
    [api],
  );

  const handleDelete = useCallback(
    (workspace: V5.ExtensionWorkspace) => {
      modal.confirm({
        title: `Delete "${workspace.name}"?`,
        content:
          'This permanently deletes the workspace and all its rules, collections, folders, templates, variables, and test run history. This action cannot be undone.',
        okText: 'Delete',
        okButtonProps: { danger: true },
        onOk: async () => {
          const result = await api.deleteWorkspace(workspace.id);
          if (!result.success) message.error(result.error ?? 'Failed to delete workspace');
          else message.success(`Deleted "${workspace.name}"`);
        },
      });
    },
    [api, modal, message],
  );

  const handleDuplicate = useCallback(
    async (workspace: V5.ExtensionWorkspace) => {
      const created = await api.duplicateWorkspace(workspace.id);
      if (created) message.success(`Duplicated "${workspace.name}"`);
      else message.error('Failed to duplicate workspace');
    },
    [api, message],
  );

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: '0 auto', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Workspaces
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New workspace
        </Button>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Each workspace holds its own rules, collections, folders, templates, variables, and test run history. Drag to
        reorder.
      </Text>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={api.workspaces.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {api.workspaces.map((w) => (
              <SortableRow
                key={w.id}
                workspace={w}
                isActive={w.id === api.activeWorkspaceId}
                canDelete={canDelete}
                onEdit={() => setEditTarget(w)}
                onDelete={() => handleDelete(w)}
                onDuplicate={() => void handleDuplicate(w)}
                onSwitch={() => void api.setActiveWorkspace(w.id)}
                onIdentityChange={(identity) =>
                  // Coerce undefined icon → null so the backend's
                  // "clear" path runs instead of "leave unchanged".
                  void api.updateWorkspace(w.id, {
                    color: identity.color,
                    icon: identity.icon ?? null,
                  })
                }
                tokenColorBorder={token.colorBorderSecondary}
                tokenColorBg={token.colorBgContainer}
                tokenColorPrimary={token.colorPrimary}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <WorkspaceFormModal
        open={createOpen}
        title="New workspace"
        okText="Create"
        onCancel={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          const ws = await api.createWorkspace(values);
          if (!ws) {
            message.error('Failed to create workspace');
            return false;
          }
          message.success(`Created "${ws.name}"`);
          return true;
        }}
      />

      <WorkspaceFormModal
        open={editTarget !== null}
        title="Edit workspace"
        okText="Save"
        initial={editTarget ?? undefined}
        onCancel={() => setEditTarget(null)}
        onSubmit={async (values) => {
          if (!editTarget) return false;
          // Explicit null clears the icon on the backend — the picker
          // emits `undefined` when the user selects "No icon", so
          // coerce undefined to null here to distinguish "no change"
          // (field not in the patch) from "clear it" (null).
          const ws = await api.updateWorkspace(editTarget.id, {
            ...values,
            icon: values.icon ?? null,
          });
          if (!ws) {
            message.error('Failed to update workspace');
            return false;
          }
          message.success(`Updated "${ws.name}"`);
          return true;
        }}
      />
    </div>
  );
};

// ── Sortable row ─────────────────────────────────────────────────────

interface SortableRowProps {
  workspace: V5.ExtensionWorkspace;
  isActive: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
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
  onSwitch,
  onIdentityChange,
  tokenColorBorder,
  tokenColorBg,
  tokenColorPrimary,
}) => {
  const { token } = theme.useToken();
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
      <span
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ cursor: 'grab', color: token.colorTextTertiary, display: 'inline-flex', alignItems: 'center' }}
      >
        <HolderOutlined />
      </span>

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
              Active
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
            Switch
          </Button>
        )}
        <Button size="small" icon={<EditOutlined />} onClick={onEdit} aria-label="Rename workspace" />
        <Button size="small" icon={<CopyOutlined />} onClick={onDuplicate} aria-label="Duplicate workspace" />
        <Button
          size="small"
          icon={<DeleteOutlined />}
          danger
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete workspace"
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
  initial?: V5.ExtensionWorkspace;
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
      destroyOnClose
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
          <Form.Item label="Prefix" style={{ marginBottom: 0 }} shouldUpdate>
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
            label="Name"
            rules={[
              { required: true, message: 'Name is required' },
              { max: 60, message: 'Keep names under 60 characters' },
            ]}
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Input autoFocus placeholder="My Workspace" />
          </Form.Item>
        </div>

        {/* Hidden fields — the picker writes both through setFieldsValue. */}
        <Form.Item name="icon" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="color" hidden>
          <Input />
        </Form.Item>

        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} maxLength={240} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkspaceManager;
