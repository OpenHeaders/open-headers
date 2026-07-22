/**
 * DesktopWatchPill — the popup's privacy indicator for the telemetry
 * consent gate (OBSERVABILITY_PLAN.md §8 Phase 7): visible only while
 * the paired desktop app actively holds at least one watch session on
 * this browser (traffic, storage, or console). Reads the service
 * worker's `OH.desktopWatchActivity` ledger reactively — chrome.storage
 * is the popup's authoritative reactive plane. Clicking opens Settings,
 * where `backend.allowDesktopWatch` is the revocation lever.
 */

import { EyeOutlined } from '@ant-design/icons';
import { hostStorage, OH } from '@openheaders/core/storage';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

interface DesktopWatchPillProps {
  /** Open the workbench settings surface (the consent toggle's home). */
  onOpenSettings: () => void;
}

const DesktopWatchPill: React.FC<DesktopWatchPillProps> = ({ onOpenSettings }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [sessions, setSessions] = useState(0);

  useEffect(() => {
    let disposed = false;
    void hostStorage.get(OH.desktopWatchActivity).then((value) => {
      if (!disposed) setSessions(value?.sessions ?? 0);
    });
    const unsubscribe = hostStorage.subscribe(OH.desktopWatchActivity, (next) => {
      setSessions(next?.sessions ?? 0);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  if (sessions <= 0) return null;

  return (
    <Tooltip title={t('popup.desktopWatch.tooltip')}>
      <button
        type="button"
        className="rules-statusbar-item"
        data-testid="popup-desktop-watch-pill"
        aria-label={t('popup.desktopWatch.aria')}
        onClick={onOpenSettings}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          border: 'none',
          background: token.colorPrimaryBg,
          color: token.colorPrimary,
          borderRadius: 10,
          padding: '1px 8px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        <EyeOutlined style={{ fontSize: 11 }} />
        {t('popup.desktopWatch.label')}
      </button>
    </Tooltip>
  );
};

export default DesktopWatchPill;
