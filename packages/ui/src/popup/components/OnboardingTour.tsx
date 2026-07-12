import {
  ApiTwoTone,
  BugTwoTone,
  CheckCircleFilled,
  CloseOutlined,
  ControlTwoTone,
  DashboardTwoTone,
  EditTwoTone,
  EyeTwoTone,
  LayoutTwoTone,
  LikeTwoTone,
  SearchOutlined,
  SmileTwoTone,
  StarTwoTone,
  ThunderboltTwoTone,
} from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { hostNavigation } from '@openheaders/core/navigation';
import { hostStorage, UI } from '@openheaders/core/storage';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DockSlotIcon, LayoutMenuIcon } from '@openheaders/ui/shared/dock-layout';
import { isFirefox } from '@openheaders/ui/shared/platform';
import { Space, Tour, type TourProps, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';

const logoUrl = hostAssets.resolveUrl('images/logo-pixel.svg');

const { Text } = Typography;

const TOTAL_STEPS = 7;

interface OnboardingTourProps {
  open: boolean | null;
  onClose: () => void;
}

function getTarget(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

const Kbd: React.FC<{ children: string; small?: boolean }> = ({ children, small }) => (
  <span
    className="kbd-key"
    style={{
      fontSize: small ? 9 : 11,
      verticalAlign: 'middle',
      ...(small ? { height: 16, minWidth: 16, padding: '0 3px' } : {}),
    }}
  >
    {children}
  </span>
);

const StepDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>{children}</div>
);

const OnboardingTour: React.FC<OnboardingTourProps> = ({ open, onClose }) => {
  const t = useT();
  const { setIsTourOpen } = useKeyboardNav();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // On mount, check if onboarding should auto-show (first time)
  useEffect(() => {
    if (open !== null) return;
    void hostStorage.get(UI.onboardingCompleted).then((done) => {
      if (!done) {
        // Set tour open immediately to hide ConnectionInfo, then show tour after brief layout settle
        setIsTourOpen(true);
        setTimeout(() => setIsVisible(true), 100);
      }
    });
  }, [open, setIsTourOpen]);

  // Controlled mode: open prop overrides
  useEffect(() => {
    if (open !== null) {
      setIsVisible(open);
      if (open) setCurrentStep(0);
    }
  }, [open]);

  // Sync tour visibility to keyboard nav context
  useEffect(() => {
    setIsTourOpen(isVisible);
  }, [isVisible, setIsTourOpen]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setCurrentStep(0);
    void hostStorage.set(UI.onboardingCompleted, true);
    onClose();
  }, [onClose]);

  const indicatorsRender: TourProps['indicatorsRender'] = useCallback(
    (current: number) => (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('popup.tour.stepIndicator', { current: current + 1, total: TOTAL_STEPS })}
      </Text>
    ),
    [t],
  );

  const btnRow: React.CSSProperties = useMemo(() => ({ display: 'inline-flex', alignItems: 'center', gap: 4 }), []);

  const sharedStepProps = useMemo(
    () => ({
      prevButtonProps: {
        children: (
          <span style={btnRow}>
            <Kbd small>{'\u2190'}</Kbd>
            <span>{t('popup.tour.previous')}</span>
          </span>
        ),
      },
      nextButtonProps: {
        children: (
          <span style={btnRow}>
            <span>{t('popup.tour.next')}</span>
            <Kbd small>{'\u2192'}</Kbd>
          </span>
        ),
      },
      closable: {
        // Firefox dismisses the popup/side panel on Esc before the page sees
        // the key, so the Esc hint would be a lie there — show a plain X.
        closeIcon: isFirefox ? (
          <CloseOutlined style={{ fontSize: 14 }} />
        ) : (
          <span className="kbd-key" style={{ fontSize: 13, height: 24, minWidth: 32, padding: '0 6px' }}>
            Esc
          </span>
        ),
      },
    }),
    [btnRow, t],
  );

  const lastStepProps = useMemo(
    () => ({
      ...sharedStepProps,
      nextButtonProps: {
        children: isFirefox ? (
          <span>{t('popup.tour.finish')}</span>
        ) : (
          <span style={btnRow}>
            <span>{t('popup.tour.finish')}</span>
            <Kbd small>Esc</Kbd>
          </span>
        ),
      },
    }),
    [sharedStepProps, btnRow, t],
  );

  const steps: TourProps['steps'] = useMemo(
    () => [
      {
        title: (
          <Space size={8}>
            <img src={logoUrl} alt="Open Headers" style={{ width: 20, height: 20 }} />
            <span>{t('popup.tour.welcomeTitle')}</span>
          </Space>
        ),
        styles: { section: { width: 380 } },
        description: (
          <StepDescription>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('popup.tour.welcomeSubtitle')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(22, 119, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <EditTwoTone style={{ fontSize: 16 }} />
                </div>
                <div>
                  <Text strong style={{ fontSize: 13 }}>
                    {t('popup.tour.modify')}
                  </Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('popup.tour.modifyDesc')}
                    </Text>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(114, 46, 209, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ApiTwoTone twoToneColor="#722ed1" style={{ fontSize: 16 }} />
                </div>
                <div>
                  <Text strong style={{ fontSize: 13 }}>
                    {t('popup.tour.route')}
                  </Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('popup.tour.routeDesc')}
                    </Text>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(82, 196, 26, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <EyeTwoTone twoToneColor="#52c41a" style={{ fontSize: 16 }} />
                </div>
                <div>
                  <Text strong style={{ fontSize: 13 }}>
                    {t('popup.tour.debug')}
                  </Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('popup.tour.debugDesc')}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </StepDescription>
        ),
        target: () => getTarget('.header')!,
        placement: 'bottom' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <LayoutTwoTone />
            <span>{t('popup.tour.tabsTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('popup.tour.tabsSubtitle')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              <Space size={6}>
                <Kbd>1</Kbd>
                <Text style={{ fontSize: 12 }}>
                  <Text strong>{t('popup.tabs.thisPage')}</Text> {t('popup.tour.thisPageHint')}
                </Text>
              </Space>
              <Space size={6}>
                <Kbd>2</Kbd>
                <Text style={{ fontSize: 12 }}>
                  <Text strong>{t('popup.tabs.allRules')}</Text> {t('popup.tour.allRulesHint')}
                </Text>
              </Space>
              <Space size={6}>
                <Kbd>3</Kbd>
                <Text style={{ fontSize: 12 }}>
                  <Text strong>{t('popup.tour.tagsLabel')}</Text> {t('popup.tour.tagsHint')}
                </Text>
              </Space>
            </div>
          </StepDescription>
        ),
        target: () => getTarget('.header-rules-tabs .ant-tabs-nav')!,
        placement: 'bottom' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <ControlTwoTone />
            <span>{t('popup.tour.navTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('popup.tour.navSubtitle')}
            </Text>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr',
                columnGap: 8,
                rowGap: 2,
                marginTop: 6,
                alignItems: 'center',
              }}
            >
              <Space size={2}>
                <Kbd>{'\u2191'}</Kbd>
                <Kbd>{'\u2193'}</Kbd>
              </Space>
              <Text style={{ fontSize: 11 }}>{t('popup.tour.keyMove')}</Text>
              <Space size={2}>
                <Kbd>{'\u2192'}</Kbd>
                <Kbd>{'\u2190'}</Kbd>
              </Space>
              <Text style={{ fontSize: 11 }}>{t('popup.tour.keyExpand')}</Text>
              <Kbd>Space</Kbd>
              <Text style={{ fontSize: 11 }}>{t('popup.tour.keyToggle')}</Text>
              <Kbd>e</Kbd>
              <Text style={{ fontSize: 11 }}>{t('popup.tour.keyEdit')}</Text>
              <Kbd>c</Kbd>
              <Text style={{ fontSize: 11 }}>{t('popup.tour.keyCopy')}</Text>
              <Space size={2}>
                <Kbd>d</Kbd>
                <Kbd>d</Kbd>
              </Space>
              <Text style={{ fontSize: 11 }}>{t('popup.tour.keyDelete')}</Text>
            </div>
          </StepDescription>
        ),
        target: () => getTarget('.ant-tabs-tabpane-active .header-rules-table')!,
        placement: 'top' as const,
        scrollIntoViewOptions: false,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <BugTwoTone />
            <span>{t('popup.tour.devtoolsTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription>
            <Text style={{ fontSize: 12 }}>
              {t('popup.tour.findThePrefix')}{' '}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: 'rgba(22, 119, 255, 0.08)',
                  color: 'var(--ant-color-primary-text)',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1 }}>🟦</span>
                Open Headers
              </span>{' '}
              {t('popup.tour.findTheSuffix')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: 'var(--ant-color-success)', fontSize: 11 }} />
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
                    background: 'var(--ant-color-primary)',
                    color: '#fff',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('popup.devtools.addOverride')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: 'var(--ant-color-success)', fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureTabs')}</Text>
                <LayoutMenuIcon kind="close-tabs-left" size={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: 'var(--ant-color-success)', fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureSearch')}</Text>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <SearchOutlined style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)' }} />
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
                        border: '1px solid var(--ant-color-border)',
                        borderRadius: 3,
                        color: 'var(--ant-color-text-secondary)',
                        background: 'var(--ant-color-bg-elevated)',
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleFilled style={{ color: 'var(--ant-color-success)', fontSize: 11 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{t('popup.devtools.featureDock')}</Text>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <DockSlotIcon slot="left-top" size={16} />
                  <DockSlotIcon slot="right-bottom" size={16} />
                  <DockSlotIcon slot="bottom-left" size={16} />
                </span>
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
              {t('popup.tour.devtoolsHint')}
            </Text>
          </StepDescription>
        ),
        target: () => getTarget('.debug-network-button')!,
        placement: 'top' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <ThunderboltTwoTone />
            <span>{t('popup.tour.shortcutsTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('popup.tour.shortcutsSubtitle')}
            </Text>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12 }}>{t('popup.tour.pressLabel')}</Text>
              <Kbd>?</Kbd>
              <Text style={{ fontSize: 12 }}>{t('popup.tour.shortcutsHint')}</Text>
            </div>
          </StepDescription>
        ),
        target: () => getTarget('.footer .kbd-key')!,
        placement: 'top' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <DashboardTwoTone />
            <span>{t('popup.tour.statusTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('popup.tour.statusSubtitle')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#52c41a' }}
                />
                <Text style={{ fontSize: 12 }}>
                  <Text strong>{t('popup.tour.statusGreen')}</Text> {t('popup.tour.statusGreenDesc')}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#faad14' }}
                />
                <Text style={{ fontSize: 12 }}>
                  <Text strong>{t('popup.tour.statusYellow')}</Text> {t('popup.tour.statusYellowDesc')}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ff4d4f' }}
                />
                <Text style={{ fontSize: 12 }}>
                  <Text strong>{t('popup.tour.statusRed')}</Text> {t('popup.tour.statusRedDesc')}
                </Text>
              </div>
            </div>
          </StepDescription>
        ),
        target: () => getTarget('.footer-system-status')!,
        placement: 'top' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <SmileTwoTone />
            <span>{t('popup.tour.growTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('popup.tour.growSubtitle')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StarTwoTone style={{ fontSize: 14 }} />
                <button
                  type="button"
                  onClick={() => {
                    hostNavigation.openUrl('https://github.com/OpenHeaders/open-headers-releases');
                  }}
                  style={{
                    cursor: 'pointer',
                    fontSize: 13,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--ant-color-link)',
                  }}
                >
                  {t('popup.tour.starGithub')}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LikeTwoTone style={{ fontSize: 14 }} />
                <Text style={{ fontSize: 13 }}>{t('popup.tour.recommend')}</Text>
              </div>
            </div>
          </StepDescription>
        ),
        target: () => getTarget('.github-star-button')!,
        placement: 'top' as const,
        ...lastStepProps,
      },
    ],
    [sharedStepProps, lastStepProps, t],
  );

  return (
    <Tour
      open={isVisible}
      current={currentStep}
      onChange={setCurrentStep}
      onClose={handleClose}
      steps={steps}
      indicatorsRender={indicatorsRender}
      disabledInteraction
      mask={{ color: 'rgba(0, 0, 0, 0.6)' }}
      scrollIntoViewOptions={false}
      getPopupContainer={() => document.getElementById('root') || document.body}
      styles={{
        section: { width: 360, minHeight: 160 },
      }}
      zIndex={3000}
    />
  );
};

export default OnboardingTour;
