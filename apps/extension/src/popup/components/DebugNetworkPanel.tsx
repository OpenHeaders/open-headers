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

const RegularPageGlyph: React.FC = () => {
  const BG_CONTAINER = 'var(--ant-color-bg-container)';
  const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
  const FILL_TERTIARY = 'var(--ant-color-fill-tertiary)';
  const BORDER = 'var(--ant-color-border)';
  const GREY = 'var(--ant-color-text-tertiary)';
  const TEXT = 'var(--ant-color-text)';

  const FX = 4;
  const FY = 4;
  const FW = 172;
  const FH = 78;
  const titleH = 12;
  const tabsH = 14;
  const titleY = FY;
  const tabsY = titleY + titleH;
  const bodyY = tabsY + tabsH;

  return (
    <svg
      viewBox="0 0 180 86"
      width={180}
      height={86}
      role="img"
      aria-label="Regular webpage browser frame"
      style={{ flexShrink: 0 }}
    >
      <rect x={FX} y={FY} width={FW} height={FH} rx={5} fill={BG_CONTAINER} stroke={BORDER} />

      {/* Title bar — traffic lights */}
      <rect x={FX} y={titleY} width={FW} height={titleH} rx={5} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={FX + 7 + i * 6} cy={titleY + titleH / 2} r={2} fill={GREY} />
      ))}

      {/* Tab strip */}
      <rect x={FX} y={tabsY} width={FW} height={tabsH} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect x={FX + 5} y={tabsY + 2} width={90} height={tabsH - 2} rx={3} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={FX + 10} y={tabsY + tabsH / 2 + 3} fontSize={7} fontWeight={700} fill={TEXT}>
        example.com
      </text>
      <text x={FX + FW - 6} y={tabsY + tabsH / 2 + 3} textAnchor="end" fontSize={9} fill={GREY}>
        +
      </text>

      {/* Body — faded placeholder rows representing page content */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={FX + 8}
          y={bodyY + 8 + i * 8}
          width={FW - 16 - i * 14}
          height={3}
          rx={1.5}
          fill={FILL_TERTIARY}
          opacity={0.7}
        />
      ))}
    </svg>
  );
};

const DevtoolsMenuGlyph: React.FC = () => {
  const BG_CONTAINER = 'var(--ant-color-bg-container)';
  const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
  const FILL_TERTIARY = 'var(--ant-color-fill-tertiary)';
  const BORDER = 'var(--ant-color-border)';
  const GREY = 'var(--ant-color-text-tertiary)';
  const TEXT = 'var(--ant-color-text)';
  const TEXT_DIM = 'var(--ant-color-text-secondary)';
  const PRIMARY = 'var(--ant-color-primary)';

  // Browser frame layout — mirrors step 1's RegularPageGlyph (popup stripped, menu overlaid)
  const FX = 4;
  const menuBarH = 8;
  const FY = 4 + menuBarH;
  const FW = 172;
  const FH = 78;
  const titleH = 12;
  const tabsH = 14;
  const titleY = FY;
  const tabsY = titleY + titleH;
  const bodyY = tabsY + tabsH;

  // Menu bar items — full names, positioned with width-aware spacing
  const menuItems = [
    { label: 'Edit', w: 14 },
    { label: 'View', w: 15, highlighted: true },
    { label: 'History', w: 23 },
    { label: 'Bookmarks', w: 30 },
    { label: 'Tab', w: 12 },
  ];
  let cursor = 4;
  const positionedMenu = menuItems.map((m) => {
    const x = cursor;
    cursor += m.w + 5;
    return { ...m, x };
  });
  const viewItem = positionedMenu.find((m) => m.highlighted);

  // Sub-dropdown layout
  const subX = 70;
  const subW = 74;

  return (
    <svg
      viewBox="0 0 180 94"
      width={180}
      height={94}
      role="img"
      aria-label="Open View menu → Developer → Developer Tools"
      style={{ flexShrink: 0 }}
    >
      {/* System menu bar (above the browser window) */}
      <rect x={0} y={0} width={180} height={menuBarH} fill={FILL_TERTIARY} />
      {positionedMenu.map((m) =>
        m.highlighted ? (
          <g key={m.label}>
            <rect x={m.x - 1} y={1} width={m.w + 2} height={menuBarH - 2} rx={1} fill={PRIMARY} />
            <text
              x={m.x + m.w / 2}
              y={6.5}
              textAnchor="middle"
              fontSize={5.5}
              fontWeight={700}
              fill="#fff"
            >
              {m.label}
            </text>
          </g>
        ) : (
          <text key={m.label} x={m.x} y={6.5} fontSize={5.5} fill={TEXT_DIM}>
            {m.label}
          </text>
        ),
      )}

      {/* Browser frame */}
      <rect x={FX} y={FY} width={FW} height={FH} rx={5} fill={BG_CONTAINER} stroke={BORDER} />
      {/* Title bar — traffic lights */}
      <rect x={FX} y={titleY} width={FW} height={titleH} rx={5} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={FX + 7 + i * 6} cy={titleY + titleH / 2} r={2} fill={GREY} />
      ))}
      {/* Tab strip */}
      <rect x={FX} y={tabsY} width={FW} height={tabsH} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect x={FX + 5} y={tabsY + 2} width={90} height={tabsH - 2} rx={3} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={FX + 10} y={tabsY + tabsH / 2 + 3} fontSize={7} fontWeight={700} fill={TEXT}>
        example.com
      </text>
      <text x={FX + FW - 6} y={tabsY + tabsH / 2 + 3} textAnchor="end" fontSize={9} fill={GREY}>
        +
      </text>
      {/* Body — faded placeholder rows (dimmed by the menu overlay above) */}
      <g opacity={0.4}>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={FX + 8}
            y={bodyY + 8 + i * 8}
            width={FW - 16 - i * 14}
            height={3}
            rx={1.5}
            fill={FILL_TERTIARY}
          />
        ))}
      </g>

      {/* Primary dropdown — hangs from "View" in the menu bar */}
      <rect x={viewItem ? viewItem.x - 2 : 12} y={menuBarH} width={48} height={50} rx={2} fill={BG_CONTAINER} stroke={BORDER} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`row-${i}`}
          x={(viewItem ? viewItem.x - 2 : 12) + 4}
          y={menuBarH + 4 + i * 7}
          width={36 - i * 4}
          height={2}
          rx={1}
          fill={FILL_TERTIARY}
        />
      ))}
      {/* "Developer ▸" highlighted row */}
      <rect x={viewItem ? viewItem.x - 2 : 12} y={menuBarH + 38} width={48} height={10} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={(viewItem ? viewItem.x - 2 : 12) + 4} y={menuBarH + 45} fontSize={6} fontWeight={700} fill={TEXT}>
        Developer
      </text>
      <text x={(viewItem ? viewItem.x - 2 : 12) + 44} y={menuBarH + 45} textAnchor="end" fontSize={7} fill={TEXT_DIM}>
        ▸
      </text>

      {/* Sub-dropdown — cascades to the right of "Developer" */}
      <rect x={subX} y={menuBarH + 34} width={subW} height={30} rx={2} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={subX} y={menuBarH + 37} width={subW} height={9} fill={PRIMARY} />
      <text x={subX + 4} y={menuBarH + 43.5} fontSize={6} fontWeight={700} fill="#fff">
        Developer Tools
      </text>
      {[0, 1].map((i) => (
        <rect
          key={`sub-${i}`}
          x={subX + 4}
          y={menuBarH + 49 + i * 5}
          width={42 - i * 8}
          height={1.8}
          rx={0.8}
          fill={FILL_TERTIARY}
        />
      ))}
    </svg>
  );
};

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
      width={600}
      centered
      styles={{
        body: { maxHeight: 'min(75vh, 500px)', overflowY: 'auto', paddingRight: 4 },
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
          Reach the super-charged network panel in 3 steps.
        </Text>

        <div style={stepCard}>
          <span style={stepIndex}>1</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  or the new tab
                  <br />— extensions are blocked there.
                </Text>
              </div>
            </div>
            <RegularPageGlyph />
          </div>
        </div>

        <div style={stepCard}>
          <span style={stepIndex}>2</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
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
            <DevtoolsMenuGlyph />
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
          <InfoCircleOutlined
            style={{
              flexShrink: 0,
              fontSize: 18,
              color: token.colorPrimary,
              marginTop: 1,
            }}
          />
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
