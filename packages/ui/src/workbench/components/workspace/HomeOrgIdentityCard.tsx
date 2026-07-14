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
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

const HomeOrgIdentityCard: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
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
          aria-label={t('workbench.workspace.org.logoAria')}
        >
          {t('workbench.workspace.org.logoButton')}
        </Button>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => setRenameOpen(true)}
          aria-label={t('workbench.workspace.org.renameAria')}
        >
          {t('workbench.workspace.org.renameButton')}
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
  const t = useT();
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
      message.success(t('workbench.workspace.org.nameUpdated'));
      form.resetFields();
      onClose();
      return;
    }
    if (result.reason === 'empty-name') {
      form.setFields([{ name: 'name', errors: [t('workbench.workspace.nameRequired')] }]);
    } else {
      message.error(t('workbench.workspace.org.identityLoading'));
    }
  }, [form, message, onClose, t]);

  return (
    <Modal
      open={open}
      title={
        hint
          ? t('workbench.workspace.org.renameTitle', { hint: hint.toLowerCase() })
          : t('workbench.workspace.org.renameTitleFallback')
      }
      okText={t('workbench.workspace.saveOk')}
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
          label={t('workbench.workspace.nameLabel')}
          extra={t('workbench.workspace.org.renameExtra')}
          rules={[
            { required: true, message: t('workbench.workspace.nameRequired') },
            { max: MAX_ORG_NAME_LENGTH, message: t('workbench.workspace.org.nameTooLong', { max: MAX_ORG_NAME_LENGTH }) },
          ]}
        >
          <Input autoFocus maxLength={MAX_ORG_NAME_LENGTH} placeholder={t('workbench.workspace.org.namePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ── Logo modal ───────────────────────────────────────────────────────

const LOGO_REJECT_KEYS: Record<OrgLogoRejectReason, MessageKey> = {
  'not-a-data-uri': 'workbench.workspace.org.logoReject.notImage',
  'not-base64': 'workbench.workspace.org.logoReject.notImage',
  'corrupt-image': 'workbench.workspace.org.logoReject.corruptImage',
  'unsupported-format': 'workbench.workspace.org.logoReject.unsupportedFormat',
  'too-large': 'workbench.workspace.org.logoReject.tooLarge',
  'unsafe-svg': 'workbench.workspace.org.logoReject.unsafeSvg',
};

const LOGO_MAX_KB = Math.round(ORG_LOGO_MAX_BYTES / 1024);

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
  const t = useT();
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
          message.error(t(LOGO_REJECT_KEYS[validation.reason], { kb: LOGO_MAX_KB }));
          return;
        }
        const result = await setHomeOrgLogo(dataUri);
        if (!result.ok) {
          message.error(
            result.reason === 'no-identity'
              ? t('workbench.workspace.org.identityLoading')
              : t(LOGO_REJECT_KEYS[result.reason], { kb: LOGO_MAX_KB }),
          );
          return;
        }
        message.success(t('workbench.workspace.org.logoUpdated'));
      } catch {
        message.error(t('workbench.workspace.org.fileReadFailed'));
      } finally {
        setBusy(false);
      }
    },
    [message, t],
  );

  const removeLogo = useCallback(async () => {
    setBusy(true);
    try {
      const result = await setHomeOrgLogo(null);
      if (result.ok) {
        message.success(t('workbench.workspace.org.logoRemoved'));
      } else {
        message.error(t('workbench.workspace.org.identityLoading'));
      }
    } finally {
      setBusy(false);
    }
  }, [message, t]);

  return (
    <Modal
      open={open}
      title={
        hint
          ? t('workbench.workspace.org.logoTitle', { hint })
          : t('workbench.workspace.org.logoTitleFallback')
      }
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
            <img
              src={currentLogo}
              alt={t('workbench.workspace.org.logoAlt')}
              width={40}
              height={40}
              style={{ objectFit: 'contain' }}
            />
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
                {currentLogo ? t('workbench.workspace.org.replace') : t('workbench.workspace.org.upload')}
              </Button>
            </Upload>
            {currentLogo && (
              <Button icon={<DeleteOutlined />} danger disabled={busy} onClick={() => void removeLogo()}>
                {t('workbench.workspace.org.remove')}
              </Button>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.workspace.org.logoHint', { kb: LOGO_MAX_KB })}
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default HomeOrgIdentityCard;
