import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, UI } from '@openheaders/core/storage';
import ErrorBoundary from '@openheaders/ui/components/ErrorBoundary';
import {
  EnvironmentProvider,
  FilesProvider,
  LiveVariablesProvider,
  LiveWorkflowsProvider,
  OAuthBundlesProvider,
  PauseMarkersProvider,
  RequestsProvider,
  RuleProvider,
  useTheme,
  VaultProvider,
  WorkspaceVariablesProvider,
} from '@openheaders/ui/context';
import { AwarenessIdentityProvider, type SurfaceIdentityHandle } from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import {
  useAppUpdateNotification,
  useSeedNotifications,
  useUpdatedNotification,
} from '@openheaders/ui/shared/notifications';
import { useSurface } from '@openheaders/ui/shared/surface';
import { VariablePopoverProvider } from '@openheaders/ui/workbench/components/template-input/VariablePopoverHost';
import WhatsNewModal from '@openheaders/ui/workbench/components/whats-new/WhatsNewModal';
import { EnvSwitcherProvider } from '@openheaders/ui/workbench/services/env-switcher';
import { Layout } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Footer from './components/Footer';
import Header from './components/Header';
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay';
import OnboardingTour from './components/OnboardingTour';
import RulesList from './components/RulesList';
import { KeyboardNavProvider, useKeyboardNav } from './shortcuts/KeyboardNavContext';

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

  // Populate the local notifications store so the header bell's unseen
  // dot reflects the same pending nudges/updates as the workbench —
  // cross-surface acknowledge rides the shared localStorage ack keys.
  useAppUpdateNotification();
  useSeedNotifications();
  // Store-updated hosts: the post-update timeline entry. "See what's
  // new" opens the bundled notes in a modal, in-surface.
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const openWhatsNew = useCallback(() => setWhatsNewOpen(true), []);
  useUpdatedNotification(openWhatsNew);

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
      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </div>
  );
};

interface AppContentProps {
  /**
   * Host-supplied surface identity resolver. The popup and side panel
   * share this component but each entry point binds its own resolver
   * (`resolvePopupIdentity` / `resolveSidePanelIdentity`) — the chrome
   * tab/window lookups live in the extension host, not here.
   */
  resolveIdentity: () => SurfaceIdentityHandle;
}

const AppContent: React.FC<AppContentProps> = ({ resolveIdentity }) => {
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
    void hostStorage.get(UI.activePopupTab).then((saved) => {
      setActiveTab(saved ?? 'all-workbench');
    });
  }, []);

  // Persist tab changes
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    void hostStorage.set(UI.activePopupTab, key);
  }, []);

  useEffect(() => {
    // Presence port: the background's tab-listeners watches for either
    // 'popup' or 'sidepanel' port to disconnect so it can refresh the
    // badge when the surface closes. `hostBridge.presence` owns the full
    // lifecycle.
    const disposePresence = hostBridge.presence(surface.presenceName);

    // Tell the host this surface just mounted so it rebroadcasts
    // current state in one round-trip. Fire-and-forget: the periodic
    // poll in RuleContext will refresh if this first call loses the
    // race. Hosts that don't register the capability (e.g. desktop —
    // mirror snapshots already cover the resync) cleanly skip.
    getCapability('announceSurfaceReady')?.().catch((error: Error) => {
      logger.info(surface.mode, 'announceSurfaceReady failed:', error.message);
    });

    return disposePresence;
  }, [surface]);

  // Identity is per-mount: the popup and side panel share this App
  // module but each entry mounts it in its own JS realm, so the
  // host-supplied resolver runs exactly once per surface lifetime.
  const identity = useMemo(() => resolveIdentity(), [resolveIdentity]);
  const ruleSurfaceId = surface.mode === 'sidepanel' ? 'sidepanel' : 'popup';
  // Active workspace drives the lifeline `bind` message so the SW
  // refcount-acquires this surface's `WorkspaceServiceState` while the
  // popup / side panel is open (design § 4.0.7). Both surfaces always
  // read Active per § 4.0.3 — no per-tab editing scope here.
  const lifelineWorkspaceId = useActiveWorkspaceId();

  return (
    <ErrorBoundary>
      <AwarenessIdentityProvider value={identity} workspaceId={lifelineWorkspaceId}>
        <PauseMarkersProvider surfaceId={ruleSurfaceId}>
          <RuleProvider surfaceId={ruleSurfaceId}>
            <EnvironmentProvider surfaceId={ruleSurfaceId}>
              <WorkspaceVariablesProvider surfaceId={ruleSurfaceId}>
                <VaultProvider surfaceId={ruleSurfaceId}>
                  <LiveVariablesProvider surfaceId={ruleSurfaceId}>
                    <LiveWorkflowsProvider surfaceId={ruleSurfaceId}>
                      <RequestsProvider surfaceId={ruleSurfaceId}>
                        <FilesProvider>
                          <OAuthBundlesProvider surfaceId={ruleSurfaceId}>
                            <KeyboardNavProvider
                              activeTab={activeTab}
                              onTabChange={handleTabChange}
                              onCycleTheme={cycleTheme}
                              onToggleCompactMode={toggleCompactMode}
                              onOpenTour={handleOpenTour}
                            >
                              <EnvSwitcherProvider>
                                <VariablePopoverProvider>
                                  <AppInner tourOpen={tourOpen} onTourClose={handleTourClose} />
                                </VariablePopoverProvider>
                              </EnvSwitcherProvider>
                            </KeyboardNavProvider>
                          </OAuthBundlesProvider>
                        </FilesProvider>
                      </RequestsProvider>
                    </LiveWorkflowsProvider>
                  </LiveVariablesProvider>
                </VaultProvider>
              </WorkspaceVariablesProvider>
            </EnvironmentProvider>
          </RuleProvider>
        </PauseMarkersProvider>
      </AwarenessIdentityProvider>
    </ErrorBoundary>
  );
};

export default AppContent;
