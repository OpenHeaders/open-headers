/**
 * HomeOrgIdentityCard — the home-Org identity row at the top of the
 * WorkspaceManager. Shows the Org's host-kind icon, its renameable name
 * (`orgIdentityLabel`), and the second-person host-kind hint
 * (`orgHostKindHint`), with a pencil that opens a small modal calling
 * `renameHomeOrg`.
 *
 * Only the home Org is renameable here — a joined backend's Org is owned
 * by that backend and re-propagates its own name on the next handshake.
 * The card renders nothing until the identity snapshot has hydrated.
 *
 * The write goes straight to `renameHomeOrg` (a core helper over host
 * storage); the SW's `OH.syntheticIdentity` reactor + `useIdentitySnapshot`
 * re-hydration make the new name appear with no extra wiring.
 */

import { EditOutlined } from '@ant-design/icons';
import {
  MAX_ORG_NAME_LENGTH,
  orgCatalogue,
  orgHostKindHint,
  orgIdentityLabel,
  renameHomeOrg,
} from '@openheaders/core/identity';
import { useBackendReach } from '@openheaders/ui/shared/hooks/useBackendReach';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { OrgIcon } from '@openheaders/ui/shared/workspace-org/OrgIcon';
import { App as AntApp, Button, Form, Input, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';

const { Text } = Typography;

const HomeOrgIdentityCard: React.FC = () => {
  const { token } = theme.useToken();
  const snapshot = useIdentitySnapshot();
  const reach = useBackendReach();
  const [renameOpen, setRenameOpen] = useState(false);

  const home = useMemo(() => orgCatalogue(snapshot).find((d) => d.isHome) ?? null, [snapshot]);
  if (!home) return null;

  const hint = orgHostKindHint(home, reach);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          marginBottom: 16,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
          borderRadius: 6,
        }}
      >
        <OrgIcon descriptor={home} size={22} style={{ color: token.colorTextSecondary }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            strong
            style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={orgIdentityLabel(home)}
          >
            {orgIdentityLabel(home)}
          </Text>
          {hint && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {hint}
            </Text>
          )}
        </div>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => setRenameOpen(true)}
          aria-label="Rename this organization"
        >
          Rename
        </Button>
      </div>

      <RenameHomeOrgModal
        open={renameOpen}
        currentName={home.name}
        hint={hint}
        onClose={() => setRenameOpen(false)}
      />
    </>
  );
};

// ── Rename modal ─────────────────────────────────────────────────────

interface RenameHomeOrgModalProps {
  open: boolean;
  currentName: string;
  /** Second-person host-kind hint, e.g. "This browser" — names the modal. */
  hint: string | null;
  onClose: () => void;
}

const RenameHomeOrgModal: React.FC<RenameHomeOrgModalProps> = ({ open, currentName, hint, onClose }) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<{ name: string }>();

  const handleOk = useCallback(async () => {
    let name: string;
    try {
      ({ name } = await form.validateFields());
    } catch {
      return; // validation error — keep modal open
    }
    const result = await renameHomeOrg(name);
    if (result.ok) {
      message.success('Name updated');
      form.resetFields();
      onClose();
      return;
    }
    if (result.reason === 'empty-name') {
      form.setFields([{ name: 'name', errors: ['Name is required'] }]);
    } else {
      message.error('Identity is still loading — try again in a moment');
    }
  }, [form, message, onClose]);

  return (
    <Modal
      open={open}
      title={hint ? `Rename ${hint.toLowerCase()}` : 'Rename'}
      okText="Save"
      destroyOnClose
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={handleOk}
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={{ name: currentName }}>
        <Form.Item
          name="name"
          label="Name"
          extra="Shown in the workspace switcher and to anyone you share workspaces with."
          rules={[
            { required: true, message: 'Name is required' },
            { max: MAX_ORG_NAME_LENGTH, message: `Keep names under ${MAX_ORG_NAME_LENGTH} characters` },
          ]}
        >
          <Input autoFocus maxLength={MAX_ORG_NAME_LENGTH} placeholder="My Work Laptop" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default HomeOrgIdentityCard;
