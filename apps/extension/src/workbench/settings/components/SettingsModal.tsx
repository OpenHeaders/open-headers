/**
 * SettingsModal — Ant Modal wrapping the shell.
 *
 * Header toolbar (right-aligned):
 *   - ⛶ Maximize — expand the modal to ~95vw/95vh
 *   - ↗ Open in Editor — reserved for Phase 2 (tab promotion). Disabled
 *     today with a tooltip so the affordance is visible but non-blocking.
 *
 * The shell is destroyed on close so each open applies its deep-link
 * target (`initialSettingKey` / `initialCategoryId`) cleanly. The cost
 * is losing scroll/search state across opens, which the command palette
 * and per-setting deep links make unnecessary.
 */

import { CloseOutlined, ExportOutlined, FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import { Button, Modal, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import SettingsShell from './SettingsShell';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSettingKey?: string;
  initialCategoryId?: string;
  /** Start in maximized mode when driven by `general.settingsOpenMode`. */
  initialMaximized?: boolean;
  /**
   * Phase 2 hook: when provided, clicking "Open in Editor" closes the
   * modal and calls this to mount the shell inside an editor tab. Left
   * undefined until the tab-promotion wiring lands.
   */
  onPromoteToTab?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  initialSettingKey,
  initialCategoryId,
  initialMaximized = false,
  onPromoteToTab,
}) => {
  const { token } = theme.useToken();
  const [maximized, setMaximized] = useState(initialMaximized);
  useEffect(() => {
    if (open) setMaximized(initialMaximized);
  }, [open, initialMaximized]);

  // Maximized: pin to top with explicit margin and compute body height
  // so it never exceeds the viewport. Centered + top + tall heights
  // conflict in Ant Modal — the modal ends up centered at one edge while
  // its body length pushes the other edge off-screen.
  const width = maximized ? '95vw' : 960;
  const height = maximized ? 'calc(100vh - 40px)' : '80vh';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      destroyOnHidden
      width={width}
      centered={!maximized}
      style={{ padding: 0, top: maximized ? 20 : undefined, paddingBottom: 0 }}
      styles={{
        body: { padding: 0, height, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
      className="settings-modal"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>Settings</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tooltip title={onPromoteToTab ? 'Open in Editor' : 'Open in Editor (coming soon)'}>
            <Button
              size="small"
              type="text"
              icon={<ExportOutlined />}
              disabled={!onPromoteToTab}
              onClick={() => {
                if (onPromoteToTab) {
                  onClose();
                  onPromoteToTab();
                }
              }}
            />
          </Tooltip>
          <Tooltip title={maximized ? 'Restore' : 'Maximize'}>
            <Button
              size="small"
              type="text"
              icon={maximized ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setMaximized((m) => !m)}
            />
          </Tooltip>
          <Tooltip title="Close">
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
          </Tooltip>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SettingsShell initialSettingKey={initialSettingKey} initialCategoryId={initialCategoryId} />
      </div>
    </Modal>
  );
};

export default SettingsModal;
