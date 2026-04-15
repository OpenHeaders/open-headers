import ErrorBoundary from '@components/ErrorBoundary';
import { KeyboardNavProvider, useKeyboardNav } from '@context/KeyboardNavContext';
import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { call, presence } from '@utils/bridge';
import { logger } from '@utils/logger';
import { Layout } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getBrowserAPI } from '@/types/browser';
import Footer from './components/Footer';
import Header from './components/Header';
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay';
import OnboardingTour from './components/OnboardingTour';
import RulesList from './components/RulesList';

const { Content } = Layout;

const THEME_CYCLE = ['light', 'dark', 'auto'] as const;

const AppInner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { containerRef, isShortcutsOverlayVisible, setIsShortcutsOverlayVisible } = useKeyboardNav();
  const [tourOpen, setTourOpen] = useState<boolean | null>(null);
  const handleTourClose = useCallback(() => setTourOpen(null), []);

  return (
    <div ref={containerRef} tabIndex={-1} style={{ outline: 'none', height: '100%' }}>
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
      <OnboardingTour open={tourOpen} onClose={handleTourClose} />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { themeMode, setThemeMode, toggleCompactMode } = useTheme();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_CYCLE.indexOf(themeMode as (typeof THEME_CYCLE)[number]);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    setThemeMode(THEME_CYCLE[nextIndex]);
  }, [themeMode, setThemeMode]);

  // Load persisted tab on mount
  useEffect(() => {
    const browserAPI = getBrowserAPI();
    browserAPI.storage.local.get(['activeRulesTab'], (result: Record<string, unknown>) => {
      setActiveTab((result.activeRulesTab as string) || 'all-rules');
    });
  }, []);

  // Persist tab changes
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    const browserAPI = getBrowserAPI();
    browserAPI.storage.local.set({ activeRulesTab: key });
  }, []);

  useEffect(() => {
    // Presence port: the background's tab-listeners watches for this
    // port to disconnect so it can refresh the badge when the popup
    // closes. Bridge.presence owns the full lifecycle.
    const disposePresence = presence('popup');

    // Announce popupOpen so the SW reports connection status + rule set
    // in one round-trip. Fire-and-forget: the periodic poll in
    // RuleContext will refresh if this first call loses the race.
    call('popupOpen').catch((error: Error) => {
      logger.info('Popup', 'popupOpen RPC failed:', error.message);
    });

    return disposePresence;
  }, []);

  return (
    <ErrorBoundary>
      <RuleProvider>
        <KeyboardNavProvider
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCycleTheme={cycleTheme}
          onToggleCompactMode={toggleCompactMode}
        >
          <AppInner />
        </KeyboardNavProvider>
      </RuleProvider>
    </ErrorBoundary>
  );
};

export default AppContent;
