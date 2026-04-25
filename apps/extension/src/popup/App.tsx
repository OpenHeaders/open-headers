import ErrorBoundary from '@components/ErrorBoundary';
import { KeyboardNavProvider, useKeyboardNav } from '@context/KeyboardNavContext';
import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { call, presence } from '@utils/bridge';
import { logger } from '@utils/logger';
import { Layout } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { extensionStorage, UI } from '@/shared/storage';
import { useSurface } from '@/shared/surface';
import Footer from './components/Footer';
import Header from './components/Header';
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay';
import OnboardingTour from './components/OnboardingTour';
import RulesList from './components/RulesList';

const { Content } = Layout;

const THEME_CYCLE = ['light', 'dark', 'auto'] as const;

interface AppInnerProps {
  tourOpen: boolean | null;
  onTourClose: () => void;
}

const AppInner: React.FC<AppInnerProps> = ({ tourOpen, onTourClose }) => {
  const { isDarkMode } = useTheme();
  const surface = useSurface();
  const { containerRef, isShortcutsOverlayVisible, setIsShortcutsOverlayVisible } = useKeyboardNav();

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      data-surface={surface.mode}
      className={`oh-surface oh-surface-${surface.mode}`}
      style={{ outline: 'none', height: '100%' }}
    >
      <Layout className="app-container" data-theme={isDarkMode ? 'dark' : 'light'}>
        <Header />
        <Content className="content">
          <div className="entries-list">
            <RulesList />
          </div>
        </Content>
        <Footer />
      </Layout>
      <KeyboardShortcutsOverlay
        visible={isShortcutsOverlayVisible}
        onClose={() => setIsShortcutsOverlayVisible(false)}
      />
      <OnboardingTour open={tourOpen} onClose={onTourClose} />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { themeMode, setThemeMode, toggleCompactMode } = useTheme();
  const surface = useSurface();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState<boolean | null>(null);
  const handleTourClose = useCallback(() => setTourOpen(null), []);
  const handleOpenTour = useCallback(() => setTourOpen(true), []);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_CYCLE.indexOf(themeMode as (typeof THEME_CYCLE)[number]);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    setThemeMode(THEME_CYCLE[nextIndex]);
  }, [themeMode, setThemeMode]);

  // Load persisted tab on mount
  useEffect(() => {
    void extensionStorage.get(UI.activePopupTab).then((saved) => {
      setActiveTab(saved ?? 'all-workbench');
    });
  }, []);

  // Persist tab changes
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    void extensionStorage.set(UI.activePopupTab, key);
  }, []);

  useEffect(() => {
    // Presence port: the background's tab-listeners watches for either
    // 'popup' or 'sidepanel' port to disconnect so it can refresh the
    // badge when the surface closes. Bridge.presence owns the full
    // lifecycle.
    const disposePresence = presence(surface.presenceName);

    // Announce popupOpen so the SW reports connection status + rule set
    // in one round-trip. Fire-and-forget: the periodic poll in
    // RuleContext will refresh if this first call loses the race.
    call('popupOpen').catch((error: Error) => {
      logger.info(surface.mode, 'popupOpen RPC failed:', error.message);
    });

    return disposePresence;
  }, [surface]);

  return (
    <ErrorBoundary>
      <RuleProvider>
        <KeyboardNavProvider
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCycleTheme={cycleTheme}
          onToggleCompactMode={toggleCompactMode}
          onOpenTour={handleOpenTour}
        >
          <AppInner tourOpen={tourOpen} onTourClose={handleTourClose} />
        </KeyboardNavProvider>
      </RuleProvider>
    </ErrorBoundary>
  );
};

export default AppContent;
