/**
 * HomeOrgIdentityCard — the home-Org identity row at the top of the
 * WorkspaceManager. Shows the Org's identity glyph, its renameable name
 * (`orgIdentityLabel`), and the second-person host-kind hint
 * (`orgHostKindHint`), with a pencil that opens a small modal calling
 * `renameHomeOrg` and a logo action that manages the Org's custom brand
 * mark via `setHomeOrgLogo`.
 *
 * Only the home Org is editable here — a joined backend's Org is owned
 * by that backend and re-propagates its own name + branding on the next
 * handshake. The card renders nothing until the identity snapshot has
 * hydrated.
 *
 * Writes go straight to the core helpers over host storage; the SW's
 * `OH.syntheticIdentity` reactor + `useIdentitySnapshot` re-hydration
 * make the new name/logo appear with no extra wiring. Logo candidates
 * are validated by `validateOrgLogoDataUri` (format allow-list, byte
 * cap, inert-SVG rules) BEFORE anything persists; the modal maps each
 * reject reason to actionable copy.
 */

import { DeleteOutlined, EditOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import {
  MAX_ORG_NAME_LENGTH,
  orgCatalogue,
  orgHostKindHint,
  orgIdentityLabel,
  renameHomeOrg,
  setHomeOrgLogo,
} from '@openheaders/core/identity';
import { ORG_LOGO_MAX_BYTES, type OrgLogoRejectReason, validateOrgLogoDataUri } from '@openheaders/core/utils';
import { useBackendReach } from '@openheaders/ui/shared/hooks/useBackendReach';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { OrgIcon } from '@openheaders/ui/shared/workspace-org/OrgIcon';
import { App as AntApp, Button, Form, Input, Modal, Typography, Upload, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';

const { Text } = Typography;

const HomeOrgIdentityCard: React.FC = () => {
  const { token } = theme.useToken();
  const snapshot = useIdentitySnapshot();
  // Home-Org host hint reads the host's OWN bind tier (self entry).
  const { self: reach } = useBackendReach();
  const [renameOpen, setRenameOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);

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
          icon={<PictureOutlined />}
          onClick={() => setLogoOpen(true)}
          aria-label="Change this organization's logo"
        >
          Logo
        </Button>
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
      <HomeOrgLogoModal open={logoOpen} currentLogo={home.logo ?? null} hint={hint} onClose={() => setLogoOpen(false)} />
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

// ── Logo modal ───────────────────────────────────────────────────────

const LOGO_REJECT_COPY: Record<OrgLogoRejectReason, string> = {
  'not-a-data-uri': 'That file could not be read as an image.',
  'not-base64': 'That file could not be read as an image.',
  'corrupt-image': 'That file is not a valid image of its declared type.',
  'unsupported-format': 'Use a PNG, JPEG, WebP, or SVG file.',
  'too-large': `Keep the logo under ${Math.round(ORG_LOGO_MAX_BYTES / 1024)} KB.`,
  'unsafe-svg': 'This SVG contains scripts or external references — export a plain, self-contained SVG.',
};

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

interface HomeOrgLogoModalProps {
  open: boolean;
  /** The currently persisted logo `data:` URI; null when unset. */
  currentLogo: string | null;
  /** Second-person host-kind hint, e.g. "This browser" — names the modal. */
  hint: string | null;
  onClose: () => void;
}

const HomeOrgLogoModal: React.FC<HomeOrgLogoModalProps> = ({ open, currentLogo, hint, onClose }) => {
  const { message } = AntApp.useApp();
  const { token } = theme.useToken();
  const [busy, setBusy] = useState(false);

  const applyFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const dataUri = await readFileAsDataUri(file);
        // Validate before the write for the fast, specific error copy —
        // setHomeOrgLogo re-validates, so the write path stays safe even
        // if a future caller skips this.
        const validation = validateOrgLogoDataUri(dataUri);
        if (!validation.ok) {
          message.error(LOGO_REJECT_COPY[validation.reason]);
          return;
        }
        const result = await setHomeOrgLogo(dataUri);
        if (!result.ok) {
          message.error(
            result.reason === 'no-identity'
              ? 'Identity is still loading — try again in a moment'
              : LOGO_REJECT_COPY[result.reason],
          );
          return;
        }
        message.success('Logo updated');
      } catch {
        message.error('That file could not be read.');
      } finally {
        setBusy(false);
      }
    },
    [message],
  );

  const removeLogo = useCallback(async () => {
    setBusy(true);
    try {
      const result = await setHomeOrgLogo(null);
      if (result.ok) {
        message.success('Logo removed');
      } else {
        message.error('Identity is still loading — try again in a moment');
      }
    } finally {
      setBusy(false);
    }
  }, [message]);

  return (
    <Modal
      open={open}
      title={hint ? `${hint} logo` : 'Organization logo'}
      footer={null}
      destroyOnClose
      onCancel={onClose}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
        <div
          style={{
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px dashed ${token.colorBorder}`,
            borderRadius: 8,
            background: token.colorFillQuaternary,
            flexShrink: 0,
          }}
        >
          {currentLogo ? (
            <img src={currentLogo} alt="Current organization logo" width={40} height={40} style={{ objectFit: 'contain' }} />
          ) : (
            <PictureOutlined style={{ fontSize: 22, color: token.colorTextQuaternary }} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Upload
              accept={LOGO_ACCEPT}
              showUploadList={false}
              beforeUpload={(file) => {
                void applyFile(file);
                return false; // never upload anywhere — the file stays local
              }}
            >
              <Button icon={<UploadOutlined />} loading={busy}>
                {currentLogo ? 'Replace…' : 'Upload…'}
              </Button>
            </Upload>
            {currentLogo && (
              <Button icon={<DeleteOutlined />} danger disabled={busy} onClick={() => void removeLogo()}>
                Remove
              </Button>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            PNG, JPEG, WebP, or SVG, up to {Math.round(ORG_LOGO_MAX_BYTES / 1024)} KB. Square images look best. Shown
            to everyone who syncs with this organization.
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default HomeOrgIdentityCard;
