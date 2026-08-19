/**
 * PanelOnboardingTour — first-open guided tour of the DevTools panel.
 *
 * Mirrors the popup's OnboardingTour idioms (antd Tour, selector
 * targets, storage-key gate) with panel-specific steps. Gated on
 * `UI.panelOnboardingCompleted` — a key that never existed before this
 * feature — so existing installs see the tour once on their first panel
 * open after the update, not just fresh installs. The finale lands on
 * the footer's Debug mode toggle: with `inspection.cdpEnabled` off by
 * default, the tour is where the reduced-capture default gets explained.
 *
 * Keyboard is rc-tour's own: it binds ArrowLeft/ArrowRight on window
 * through its portal, so the arrow hints on the buttons come for free —
 * no listener here (a second one double-steps every keypress). Esc never
 * reaches the panel document — DevTools claims it for its drawer toggle —
 * so the close affordance is a plain X with no Esc hint anywhere.
 */

import {
  CloseOutlined,
  DatabaseOutlined,
  ExperimentTwoTone,
  FileTextOutlined,
  GlobalOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { hostStorage, UI } from '@openheaders/core/storage';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Space, Tour, type TourProps, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const logoUrl = hostAssets.resolveUrl('images/logo-pixel.svg');

const { Text } = Typography;

const TOTAL_STEPS = 6;

interface PanelOnboardingTourProps {
  /** null = self-gated auto-show; boolean = controlled (gear-menu replay). */
  open: boolean | null;
  onClose: () => void;
}

function getTarget(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

const Kbd: React.FC<{ children: string }> = ({ children }) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      fontSize: 10,
      fontFamily: 'inherit',
      border: '1px solid var(--ant-color-border)',
      borderRadius: 3,
      background: 'var(--ant-color-bg-elevated)',
      color: 'var(--ant-color-text-secondary)',
      verticalAlign: 'middle',
    }}
  >
    {children}
  </kbd>
);

const StepRow: React.FC<{ label: string; hint: string }> = ({ label, hint }) => (
  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
    <Text strong style={{ fontSize: 12 }}>
      {label}
    </Text>{' '}
    <Text type="secondary" style={{ fontSize: 12 }}>
      {hint}
    </Text>
  </div>
);

const StepDescription: React.FC<{ subtitle: string; children?: React.ReactNode }> = ({ subtitle, children }) => (
  <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>
    <Text type="secondary" style={{ fontSize: 12 }}>
      {subtitle}
    </Text>
    {children && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>{children}</div>}
  </div>
);

const PanelOnboardingTour: React.FC<PanelOnboardingTourProps> = ({ open, onClose }) => {
  const t = useT();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // On mount, auto-show when the completion flag has never been set.
  // The brief delay lets the dock layout settle so targets measure true.
  useEffect(() => {
    if (open !== null) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    void hostStorage.get(UI.panelOnboardingCompleted).then((done) => {
      if (!done && !cancelled) {
        timer = setTimeout(() => setIsVisible(true), 150);
      }
    });
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [open]);

  // Controlled mode: open prop overrides (gear-menu replay).
  useEffect(() => {
    if (open !== null) {
      setIsVisible(open);
      if (open) setCurrentStep(0);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setCurrentStep(0);
    void hostStorage.set(UI.panelOnboardingCompleted, true);
    onClose();
  }, [onClose]);

  const indicatorsRender: TourProps['indicatorsRender'] = useCallback(
    (current: number) => (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('panel.tour.stepIndicator', { current: current + 1, total: TOTAL_STEPS })}
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
            <Kbd>{'←'}</Kbd>
            <span>{t('panel.tour.previous')}</span>
          </span>
        ),
      },
      nextButtonProps: {
        children: (
          <span style={btnRow}>
            <span>{t('panel.tour.next')}</span>
            <Kbd>{'→'}</Kbd>
          </span>
        ),
      },
      closable: {
        // DevTools claims Esc for its own drawer toggle before the panel
        // document sees the key, so an Esc hint would be a lie — plain X.
        closeIcon: <CloseOutlined style={{ fontSize: 14 }} />,
      },
    }),
    [btnRow, t],
  );

  const lastStepProps = useMemo(
    () => ({
      ...sharedStepProps,
      nextButtonProps: {
        children: <span>{t('panel.tour.finish')}</span>,
      },
    }),
    [sharedStepProps, t],
  );

  const steps: TourProps['steps'] = useMemo(
    () => [
      {
        title: (
          <Space size={8}>
            <img src={logoUrl} alt="Open Headers" style={{ width: 20, height: 20 }} />
            <span>{t('panel.tour.welcomeTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription subtitle={t('panel.tour.welcomeSubtitle')}>
            <StepRow label={t('panel.tour.welcomeCapture')} hint={t('panel.tour.welcomeCaptureHint')} />
            <StepRow label={t('panel.tour.welcomeRules')} hint={t('panel.tour.welcomeRulesHint')} />
            <StepRow label={t('panel.tour.welcomeState')} hint={t('panel.tour.welcomeStateHint')} />
          </StepDescription>
        ),
        target: () => getTarget('.dt-header')!,
        placement: 'bottom' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <GlobalOutlined />
            <span>{t('panel.tour.networkTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription subtitle={t('panel.tour.networkSubtitle')}>
            <StepRow label={t('panel.tour.networkFilters')} hint={t('panel.tour.networkFiltersHint')} />
            <StepRow label={t('panel.tour.networkToolbar')} hint={t('panel.tour.networkToolbarHint')} />
            <StepRow label={t('panel.tour.networkExport')} hint={t('panel.tour.networkExportHint')} />
          </StepDescription>
        ),
        // `.rules-dock-body` qualifier: the sidebar tab strip carries the
        // same data-dock-slot and wins document order without it.
        target: () => getTarget('.rules-dock-body[data-dock-slot="left-top"]')!,
        placement: 'right' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <DatabaseOutlined />
            <span>{t('panel.tour.storageTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription subtitle={t('panel.tour.storageSubtitle')}>
            <StepRow label={t('panel.tour.storageAreas')} hint={t('panel.tour.storageAreasHint')} />
            <StepRow label={t('panel.tour.storageEdit')} hint={t('panel.tour.storageEditHint')} />
          </StepDescription>
        ),
        target: () => getTarget('.rules-dock-body[data-dock-slot="left-bottom"]')!,
        placement: 'right' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <FileTextOutlined />
            <span>{t('panel.tour.inspectorTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription subtitle={t('panel.tour.inspectorSubtitle')}>
            <StepRow label={t('panel.tour.inspectorTabs')} hint={t('panel.tour.inspectorTabsHint')} />
            <StepRow label={t('panel.tour.inspectorEdit')} hint={t('panel.tour.inspectorEditHint')} />
          </StepDescription>
        ),
        target: () => getTarget('.rules-region-editor')!,
        placement: 'left' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <LayoutOutlined />
            <span>{t('panel.tour.layoutTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription subtitle={t('panel.tour.layoutSubtitle')}>
            <StepRow label={t('panel.tour.layoutTools')} hint={t('panel.tour.layoutToolsHint')} />
            <StepRow label={t('panel.tour.layoutDrag')} hint={t('panel.tour.layoutDragHint')} />
          </StepDescription>
        ),
        target: () => getTarget('.rules-activity-bar--left')!,
        placement: 'right' as const,
        ...sharedStepProps,
      },
      {
        title: (
          <Space size={8}>
            <ExperimentTwoTone />
            <span>{t('panel.tour.debugTitle')}</span>
          </Space>
        ),
        description: (
          <StepDescription subtitle={t('panel.tour.debugSubtitle')}>
            <StepRow label={t('panel.tour.debugUnlocks')} hint={t('panel.tour.debugUnlocksHint')} />
            <StepRow label={t('panel.tour.debugBanner')} hint={t('panel.tour.debugBannerHint')} />
          </StepDescription>
        ),
        target: () => getTarget('.dt-footer-debug-cluster')!,
        placement: 'topRight' as const,
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
      getPopupContainer={() => document.querySelector<HTMLElement>('.dt-panel-root') || document.body}
      styles={{
        section: { width: 340, minHeight: 140 },
      }}
      zIndex={3000}
    />
  );
};

export default PanelOnboardingTour;
