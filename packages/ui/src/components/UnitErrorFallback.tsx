/**
 * UnitErrorFallback — ring 2 of the containment design: the fallback a
 * tab, a tool window or a dock pane shows inside its OWN area when its
 * subtree threw. The tab bar, the other tabs, the sidebars and the
 * menus keep working; the person chooses Retry (remount) or closes the
 * unit. A boundary resets only on that click, never on a timer.
 */

import { WarningOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import { useT } from '../context/LocaleContext';

export type UnitErrorKind = 'tab' | 'window';

interface UnitErrorFallbackProps {
  kind: UnitErrorKind;
  error: Error;
  onRetry: () => void;
  onClose: () => void;
  /**
   * Runs once when the fallback mounts — the moment the unit's content
   * is gone. A tab's shell forgets the editor's save function here, so
   * the close guard offers no Save for a crashed tab.
   */
  onCrashed?: () => void;
}

const UnitErrorFallback: React.FC<UnitErrorFallbackProps> = ({ kind, error, onRetry, onClose, onCrashed }) => {
  const t = useT();
  useEffect(() => {
    onCrashed?.();
  }, [onCrashed]);
  return (
    <div
      role="alert"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 24,
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <WarningOutlined style={{ fontSize: 28 }} />
      <Typography.Text strong>
        {kind === 'tab' ? t('shared.errorBoundary.unit.tabTitle') : t('shared.errorBoundary.unit.windowTitle')}
      </Typography.Text>
      <Typography.Text type="secondary">{t('shared.errorBoundary.unit.hint')}</Typography.Text>
      <Typography.Text type="secondary" code>
        {`${error.name}: ${error.message}`}
      </Typography.Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button type="primary" onClick={onRetry}>
          {t('shared.errorBoundary.retry')}
        </Button>
        <Button onClick={onClose}>
          {kind === 'tab' ? t('shared.errorBoundary.unit.closeTab') : t('shared.errorBoundary.unit.hideWindow')}
        </Button>
      </div>
    </div>
  );
};

export default UnitErrorFallback;
