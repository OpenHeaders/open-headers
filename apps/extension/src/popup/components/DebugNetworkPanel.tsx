import { BugFilled, CheckCircleFilled, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import DockSlotIcon from '@/shared/dock-layout/DockSlotIcon';
import LayoutMenuIcon from '@/shared/dock-layout/LayoutMenuIcon';

const { Text } = Typography;

interface DebugNetworkPanelProps {
  open: boolean;
  onClose: () => void;
}

interface DevtoolsShortcut {
  keys: string[];
  platform: string;
}

interface BrowserCopy {
  name: string;
  shortcut: DevtoolsShortcut;
  alternative: string;
  menuHint?: string;
}

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

function detectBrowser(): BrowserCopy {
  const ua = navigator.userAgent;
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isSafari = !isFirefox && /Safari/.test(ua) && !/Chrome|Chromium/.test(ua);

  const macShortcut: DevtoolsShortcut = { keys: ['⌘', '⌥', 'I'], platform: 'macOS' };
  const pcShortcut: DevtoolsShortcut = { keys: ['Ctrl', 'Shift', 'I'], platform: 'Windows / Linux' };
  const shortcut = isMac ? macShortcut : pcShortcut;

  if (isFirefox) return { name: 'Firefox', shortcut, alternative: 'F12' };
  if (isSafari) {
    return {
      name: 'Safari',
      shortcut: macShortcut,
      alternative: 'F12',
      menuHint: 'Enable Develop first — Safari → Settings → Advanced → "Show features for web developers".',
    };
  }
  if (isEdge) return { name: 'Edge', shortcut, alternative: 'F12' };
  return { name: 'Chrome', shortcut, alternative: 'F12' };
}

const DebugNetworkPanel: React.FC<DebugNetworkPanelProps> = ({ open, onClose }) => {
  const { token } = theme.useToken();
  const browser = useMemo(detectBrowser, []);

  const kbdStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 24,
    padding: '0 6px',
    borderRadius: 4,
    border: `1px solid ${token.colorBorder}`,
    background: token.colorBgElevated,
    color: token.colorText,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '22px',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.15)',
  };

  const plusStyle: React.CSSProperties = { margin: '0 3px', color: token.colorTextTertiary, fontSize: 11 };

  const stepCard: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
  };

  const stepIndex: React.CSSProperties = {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: token.colorPrimary,
    color: token.colorTextLightSolid,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 11,
    marginTop: 1,
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="Got it"
      cancelButtonProps={{ style: { display: 'none' } }}
      width={460}
      centered
      styles={{
        body: { maxHeight: 'min(70vh, 460px)', overflowY: 'auto', paddingRight: 4 },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BugFilled style={{ fontSize: 18, color: token.colorPrimary }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Debug Network</span>
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            Like it should be
          </Text>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Reach the super-charged network panel in 4 steps.
        </Text>

        <div style={stepCard}>
          <span style={stepIndex}>1</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              Open {browser.name} developer tools
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {browser.shortcut.keys.map((k, i) => (
                <span key={`${k}-${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={kbdStyle}>{k}</span>
                  {i < browser.shortcut.keys.length - 1 && <span style={plusStyle}>+</span>}
                </span>
              ))}
              <Text type="secondary" style={{ fontSize: 11 }}>
                on {browser.shortcut.platform}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                · or
              </Text>
              <span style={{ ...kbdStyle, fontSize: 11 }}>{browser.alternative}</span>
            </div>
            {browser.menuHint && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: token.colorInfoBg,
                  color: token.colorInfoText,
                }}
              >
                <InfoCircleOutlined style={{ marginTop: 2, fontSize: 11 }} />
                <Text style={{ fontSize: 11, color: token.colorInfoText }}>{browser.menuHint}</Text>
              </div>
            )}
          </div>
        </div>

        <div style={stepCard}>
          <span style={stepIndex}>2</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              On a regular webpage
            </Text>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Not{' '}
                <Text code style={{ fontSize: 11 }}>
                  chrome://
                </Text>{' '}
                or the new tab — extensions are blocked there.
              </Text>
            </div>
          </div>
        </div>

        <div style={stepCard}>
          <span style={stepIndex}>3</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              Click the{' '}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: token.colorPrimaryBg,
                  color: token.colorPrimaryText,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1 }}>🟦</span>
                Open Headers
              </span>{' '}
              tab
            </Text>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Last tab — may hide in the{' '}
                <Text code style={{ fontSize: 11 }}>
                  »
                </Text>{' '}
                overflow menu.
              </Text>
            </div>
          </div>
        </div>

        <div style={stepCard}>
          <span style={stepIndex}>4</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              Super-charge your debugging
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>Modify headers, requests & responses</Text>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    height: 16,
                    padding: '0 5px',
                    borderRadius: 3,
                    background: token.colorPrimary,
                    color: '#fff',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Add/Override
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>Multi-tab request metadata panels</Text>
                <LayoutMenuIcon kind="close-tabs-left" size={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>Advanced search & filter</Text>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <SearchOutlined style={{ fontSize: 11, color: token.colorTextSecondary }} />
                  {['Aa', 'ab', '.*'].map((label) => (
                    <span
                      key={label}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 16,
                        height: 16,
                        padding: '0 3px',
                        fontSize: 9,
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        border: `1px solid ${token.colorBorder}`,
                        borderRadius: 3,
                        color: token.colorTextSecondary,
                        background: token.colorBgElevated,
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>Drag & drop sidebar panels</Text>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <DockSlotIcon slot="left-top" size={16} />
                  <DockSlotIcon slot="right-bottom" size={16} />
                  <DockSlotIcon slot="bottom-left" size={16} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DebugNetworkPanel;
