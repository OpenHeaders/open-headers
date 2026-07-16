import { BugOutlined } from '@ant-design/icons';
import { isFetchRealizableNow, isRuleComplete } from '@openheaders/core/utils';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DebugModeDormantNotice, DebugModePill } from '@openheaders/ui/shared/debug-mode';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import type { StatusPillProps } from '@openheaders/ui/shared/status';
import { productStatusExtras, productStatusInlineActions, StatusPill } from '@openheaders/ui/shared/status';
import { useSurface } from '@openheaders/ui/shared/surface';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { Button, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import DebugNetworkPanel from './DebugNetworkPanel';

const Footer: React.FC = () => {
  const { setFooterActions, setIsShortcutsOverlayVisible } = useKeyboardNav();
  const t = useT();
  const surface = useSurface();
  const { token } = theme.useToken();
  const { rules } = useRules();
  const [debugNetworkOpen, setDebugNetworkOpen] = useState(false);

  // Never-silent (C3·S3): does a live debug-tier rule exist whose extended
  // reach Debug mode could realize now? Gates the footer dormant-notice chip
  // so it stays silent when there's nothing to be dormant about.
  const hasRealizableDebugRule = useMemo(
    () => rules.some((r) => r.enabled && isRuleComplete(r) && isFetchRealizableNow(r)),
    [rules],
  );

  const helpLabel = usePopupShortcutLabel('toggle-shortcuts-help');
  const _workspaceLabel = usePopupShortcutLabel('open-workspace');

  const handleOpenWorkspace = useCallback(() => {
    void openWorkspace({ kind: 'open-workspace' }, surface.mode);
  }, [surface.mode]);

  const handleOpenSettings = useCallback(() => {
    void openWorkspace({ kind: 'open-settings' }, surface.mode);
  }, [surface.mode]);

  // Popup/sidepanel don't host the Docs panel — opening it there
  // would require round-tripping through a workspace-managed state
  // machine that isn't mounted. The navigator reuses an existing
  // workspace tab when one is open and creates a fresh one otherwise.
  const handleOpenDocs: StatusPillProps['onOpenDocs'] = (sectionId) => {
    void openWorkspace({ kind: 'open-docs', section: sectionId }, surface.mode);
  };

  useEffect(() => {
    setFooterActions({
      onOpenWorkspace: handleOpenWorkspace,
      onOpenSettings: handleOpenSettings,
    });
  }, [setFooterActions, handleOpenWorkspace, handleOpenSettings]);

  return (
    <div
      className="footer"
      style={{ backgroundColor: token.colorBgContainer, borderTop: `1px solid ${token.colorBorderSecondary}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Tooltip title={t('popup.footer.debugTooltip')}>
          <Button
            icon={<BugOutlined />}
            size="middle"
            onClick={() => setDebugNetworkOpen(true)}
            className="debug-network-button"
            style={{ height: '36px', padding: '0 14px', fontWeight: 500, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
          >
            <span className="oh-collapse-label">
              <span style={{ fontSize: 13 }}>{t('popup.footer.networkDebug')}</span>{' '}
              <span style={{ fontSize: 10, fontStyle: 'italic', color: token.colorTextSecondary }}>
                {t('popup.footer.tagline')}
              </span>
            </span>
          </Button>
        </Tooltip>
        <Tooltip title={<ShortcutHintTitle label={helpLabel}>{t('popup.footer.keyboardShortcuts')}</ShortcutHintTitle>}>
          <span
            className="kbd-key oh-help-shortcut"
            role="button"
            tabIndex={0}
            onClick={() => setIsShortcutsOverlayVisible((prev: boolean) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setIsShortcutsOverlayVisible((prev: boolean) => !prev);
            }}
            style={{ cursor: 'pointer' }}
          >
            ?
          </span>
        </Tooltip>
      </div>

      <div>
        <Space size={8} align="center">
          <DebugModeDormantNotice tabSource="active" hasRealizableRule={hasRealizableDebugRule} />
          <DebugModePill
            tabSource="active"
            className="rules-statusbar-item footer-debug-mode"
            placement="top"
            onOpenDocs={handleOpenDocs}
          />
          <StatusPill
            className="rules-statusbar-item footer-system-status"
            density="full"
            label={t('popup.footer.systemStatus')}
            placement="top"
            renderSubsystemExtras={productStatusExtras}
            renderSubsystemInlineAction={productStatusInlineActions}
            onOpenDocs={handleOpenDocs}
          />
        </Space>
      </div>
      <DebugNetworkPanel open={debugNetworkOpen} onClose={() => setDebugNetworkOpen(false)} />
    </div>
  );
};

export default Footer;
