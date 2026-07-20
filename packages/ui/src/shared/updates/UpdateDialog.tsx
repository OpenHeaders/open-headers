/**
 * UpdateDialog — the consent surface behind every "Update…" affordance.
 *
 * One compact modal: headline with the offered version, a release-notes
 * link, an "Updating X to Y" meta line with a Configure updates… link
 * into Settings, and Ignore / Remind Me Later / Update & Restart
 * actions. Update & Restart is one click end-to-end: it downloads if
 * nothing is staged yet, then restarts into the update — the dialog
 * stays open mirroring live updater state, so the primary button shows
 * Downloading… progress until the restart lands.
 *
 * Ignore This Update mutes the toast and gear dot for the offered
 * version only ({@link writeIgnoredVersion}); the updater state and the
 * Settings row are untouched.
 */

import { type AppUpdateState, getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { releasePageUrl, writeIgnoredVersion } from './release-notes';
import { closeUpdateDialog, useUpdateDialogOpen } from './store';

interface UpdateDialogProps {
  /** Route to the Settings update row (Configure updates…). */
  onConfigureUpdates: () => void;
}

const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 'inherit' };

const UpdateDialog: React.FC<UpdateDialogProps> = ({ onConfigureUpdates }) => {
  const t = useT();
  const { token } = theme.useToken();
  const open = useUpdateDialogOpen();
  const [state, setState] = useState<AppUpdateState | null>(null);

  useEffect(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    let cancelled = false;
    void bridge
      .call('oh.updates.getState')
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        // Host without the updater RPC — the dialog never opens.
      });
    const unsubscribe = bridge.subscribe('appUpdateState', setState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const version = state?.availableVersion ?? null;
  const phase = state?.phase;
  const pending = version !== null && (phase === 'available' || phase === 'downloading' || phase === 'downloaded');

  // The offer can evaporate while the dialog is up (install elsewhere,
  // feed error) — close instead of rendering a stale headline.
  useEffect(() => {
    if (open && state !== null && !pending) closeUpdateDialog();
  }, [open, state, pending]);

  if (!pending || state === null || version === null) return null;

  const openReleaseNotes = (): void => {
    const url = state.releaseNotesUrl ?? releasePageUrl(version);
    const openUrl = getCapability('openExternalUrl');
    if (openUrl) void openUrl(url);
    else window.open(url, '_blank', 'noopener');
  };

  const primary = (() => {
    const bridge = getHostBridge();
    switch (phase) {
      case 'downloading':
        return (
          <Button type="primary" loading disabled>
            {state.progressPercent !== null
              ? t('shared.chrome.updates.downloadingPercent', { percent: state.progressPercent })
              : t('shared.chrome.updates.downloading')}
          </Button>
        );
      default:
        // available and downloaded share the one-click action: download
        // if needed, then restart into the update. The dialog stays open
        // so the button mirrors download progress until the restart.
        return (
          <Button type="primary" onClick={() => void bridge?.call('oh.updates.updateAndRestart')}>
            {t('shared.chrome.updates.updateAndRestart')}
          </Button>
        );
    }
  })();

  return (
    <Modal
      open={open}
      onCancel={closeUpdateDialog}
      centered
      width={520}
      title={t('shared.chrome.updates.title')}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            onClick={() => {
              writeIgnoredVersion(version);
              closeUpdateDialog();
            }}
          >
            {t('shared.chrome.updates.ignore')}
          </Button>
          <div style={{ flex: 1 }} />
          <Button onClick={closeUpdateDialog}>{t('shared.chrome.updates.remindLater')}</Button>
          {primary}
        </div>
      }
    >
      <div style={{ fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>v{version}</strong> {t('shared.chrome.updates.nowAvailableSuffix')}
        </div>
        <div style={{ marginBottom: 14 }}>
          {t('shared.chrome.updates.moreDetailsPrefix')}{' '}
          <Button type="link" size="small" style={LINK_STYLE} onClick={openReleaseNotes}>
            {t('shared.chrome.updates.releaseNotes')}
          </Button>
          .
        </div>
        <div
          style={{
            fontSize: 12,
            color: token.colorTextSecondary,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            paddingTop: 10,
          }}
        >
          {t('shared.chrome.updates.updatingTo', { from: state.currentVersion, to: version })}{' '}
          <Button
            type="link"
            size="small"
            style={LINK_STYLE}
            onClick={() => {
              closeUpdateDialog();
              onConfigureUpdates();
            }}
          >
            {t('shared.chrome.updates.configure')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateDialog;
