/**
 * MigrateDesktopHandoffModal — the extension's migration entry
 * (MIGRATION_STATUS.md S5 addendum: the funnel is extension → desktop).
 *
 * The ladder itself — install detection, the data scan, the API-key
 * pull — needs filesystem access only the desktop app has, so this
 * surface never runs it. It routes honestly by connection state:
 *
 *   - desktop connected: point at the desktop app's own
 *     "Migrate from another tool" entry; once a run starts there, its
 *     progress mirrors here in the corner and the imported workspaces
 *     sync over automatically.
 *   - not connected: the desktop install pitch.
 */

import { CheckCircleFilled, DesktopOutlined } from '@ant-design/icons';
import { Modal, Typography, theme } from 'antd';
import type React from 'react';

const { Text, Paragraph } = Typography;

interface MigrateDesktopHandoffModalProps {
  open: boolean;
  onClose: () => void;
  /** Live desktop connection state — the standing backend WebSocket. */
  connected: boolean;
}

const MigrateDesktopHandoffModal: React.FC<MigrateDesktopHandoffModalProps> = ({ open, onClose, connected }) => {
  const { token } = theme.useToken();

  return (
    <Modal title="Migrate from another tool" open={open} onCancel={onClose} footer={null} width={520} destroyOnHidden>
      <Paragraph>
        Open Headers can bring your Postman, Insomnia, Thunder Client, and Bruno data over. The scan and import run in
        the desktop app — it can read the files those tools left on your computer, which a browser extension can’t.
      </Paragraph>
      {connected ? (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleFilled style={{ color: token.colorSuccess }} />
            <Text strong>Your desktop app is connected</Text>
          </span>
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            Open the Open Headers desktop app and choose “Migrate from another tool” — it’s on the empty-workspace
            screen and in the import menu. While the import runs, progress appears here in the corner, and everything
            lands in a workspace this browser shares.
          </Paragraph>
        </>
      ) : (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <DesktopOutlined />
            <Text strong>This needs the desktop app</Text>
          </span>
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            Install the Open Headers desktop app (or start it if it’s already installed). This browser connects to it
            automatically — then run the migration there, and the imported workspaces show up here.
          </Paragraph>
        </>
      )}
    </Modal>
  );
};

export default MigrateDesktopHandoffModal;
