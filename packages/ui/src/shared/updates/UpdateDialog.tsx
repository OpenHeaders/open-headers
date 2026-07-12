/**
 * UpdateDialog — the consent surface behind every "Update…" affordance.
 *
 * One compact modal: headline with the offered version, a release-notes
 * link, an "Updating X to Y" meta line with a Configure updates… link
 * into Settings, and Ignore / Remind Me Later / Download actions. The
 * dialog mirrors live updater state, so a download started here (or
 * anywhere else) advances the primary button through Downloading… to
 * Restart to Install without reopening.
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
import { releasePageUrl, writeIgnoredVersion } from './release-notes';
import { closeUpdateDialog, useUpdateDialogOpen } from './store';

interface UpdateDialogProps {
  /** Route to the Settings update row (Configure updates…). */
  onConfigureUpdates: () => void;
}

const LINK_STYLE: React.CSSProperties = { padding: 0, height: 'auto', fontSize: 'inherit' };

const UpdateDialog: React.FC<UpdateDialogProps> = ({ onConfigureUpdates }) => {
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
            {state.progressPercent !== null ? `Downloading… ${state.progressPercent}%` : 'Downloading…'}
          </Button>
        );
      case 'downloaded':
        return (
          <Button type="primary" onClick={() => void bridge?.call('oh.updates.install')}>
            Restart to Install
          </Button>
        );
      default:
        return (
          <Button
            type="primary"
            onClick={() => {
              closeUpdateDialog();
              void bridge?.call('oh.updates.download');
            }}
          >
            Download
          </Button>
        );
    }
  })();

  return (
    <Modal
      open={open}
      onCancel={closeUpdateDialog}
      centered
      width={440}
      title="Open Headers Update"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            onClick={() => {
              writeIgnoredVersion(version);
              closeUpdateDialog();
            }}
          >
            Ignore This Update
          </Button>
          <div style={{ flex: 1 }} />
          <Button onClick={closeUpdateDialog}>Remind Me Later</Button>
          {primary}
        </div>
      }
    >
      <div style={{ fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Open Headers {version}</strong> is now available!
        </div>
        <div style={{ marginBottom: 14 }}>
          For more details, see the{' '}
          <Button type="link" size="small" style={LINK_STYLE} onClick={openReleaseNotes}>
            release notes
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
          Updating {state.currentVersion} to {version}.{' '}
          <Button
            type="link"
            size="small"
            style={LINK_STYLE}
            onClick={() => {
              closeUpdateDialog();
              onConfigureUpdates();
            }}
          >
            Configure updates…
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateDialog;
