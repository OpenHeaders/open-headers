import { BugFilled, CheckCircleFilled, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { DockSlotIcon, LayoutMenuIcon } from '@openheaders/ui/shared/dock-layout';
import { detectBrowser } from './debug-network-copy';
import { DevtoolsMenuGlyph } from './DevtoolsMenuGlyph';
import { DevtoolsTabGlyph } from './DevtoolsTabGlyph';

const { Text } = Typography;

interface DebugNetworkPanelProps {
  open: boolean;
  onClose: () => void;
}

const DebugNetworkPanel: React.FC<DebugNetworkPanelProps> = ({ open, onClose }) => {
  const { token } = theme.useToken();
  const t = useT();
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
    gap: 8,
    padding: 8,
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

  const subStepIndex: React.CSSProperties = {
    flexShrink: 0,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
    border: `1px solid ${token.colorPrimaryBorder}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 9,
    marginTop: 1,
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      centered
      styles={{
        body: { maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'none', paddingRight: 4 },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BugFilled style={{ fontSize: 18, color: token.colorPrimary }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{t('popup.debug.title')}</span>
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            {t('popup.footer.tagline')}
          </Text>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <div style={stepCard}>
          <span style={stepIndex}>1</span>
          <div className="oh-debug-step-body" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ fontSize: 13 }}>
                {t('popup.debug.step1')}
              </Text>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                <span style={subStepIndex}>a</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('popup.debug.step1a')}{' '}
                    <Text code style={{ fontSize: 11 }}>
                      https://example.com
                    </Text>
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('popup.debug.notPrefix')}{' '}
                      <Text code style={{ fontSize: 11 }}>
                        chrome://
                      </Text>{' '}
                      {t('popup.debug.notSuffix')}
                    </Text>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={subStepIndex}>b</span>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  {browser.shortcut.keys.map((k, i) => (
                    <span key={`${k}-${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <span style={kbdStyle}>{k}</span>
                      {i < browser.shortcut.keys.length - 1 && <span style={plusStyle}>+</span>}
                    </span>
                  ))}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('popup.debug.onPlatform', { platform: browser.shortcut.platform })}
                  </Text>
                </div>
              </div>
              {browser.menuHintKey && (
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
                  <Text style={{ fontSize: 11, color: token.colorInfoText }}>{t(browser.menuHintKey)}</Text>
                </div>
              )}
            </div>
            <div className="oh-debug-glyph">
              <DevtoolsMenuGlyph />
            </div>
          </div>
        </div>

        <div style={stepCard}>
          <span style={stepIndex}>2</span>
          <div className="oh-debug-step-body" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              {t('popup.debug.clickThePrefix')}{' '}
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
              {t('popup.debug.clickTheSuffix')}
            </Text>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('popup.debug.overflowPrefix')}{' '}
                <Text code style={{ fontSize: 11 }}>
                  »
                </Text>{' '}
                {t('popup.debug.overflowSuffix')}
              </Text>
            </div>
            </div>
            <div className="oh-debug-glyph">
              <DevtoolsTabGlyph />
            </div>
          </div>
        </div>

        <div style={stepCard}>
          <span style={stepIndex}>3</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              {t('popup.debug.step3')}
            </Text>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: 8,
                maxWidth: 380,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureModify')}</Text>
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
                  {t('popup.devtools.addOverride')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureTabs')}</Text>
                <LayoutMenuIcon kind="close-tabs-left" size={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureSearch')}</Text>
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
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureDock')}</Text>
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
