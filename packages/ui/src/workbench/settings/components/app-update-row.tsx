/**
 * App-update row — custom editor for `updates.state`
 * (`docs/UPDATES_PLAN.md`). Mirrors the main process's updater over
 * `oh.updates.getState` + the `appUpdateState` broadcast, and drives it
 * with the three consent actions: Check now, Download, Restart to
 * install. Nothing here installs implicitly — the row only ever calls
 * the RPC matching the button the user pressed.
 */

import { DownloadOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import type { AppUpdateState, BridgeRpcType } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, Progress, Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import FieldRow from '../fields/FieldRow';
import type { SettingDef } from '../types';

const { Text } = Typography;

function formatLastChecked(lastCheckedAt: number | null): string | null {
  if (lastCheckedAt === null) return null;
  return `Last checked ${new Date(lastCheckedAt).toLocaleString()}`;
}

const AppUpdateRow: React.FC<{ def: SettingDef }> = ({ def }) => {
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
        // Host without the updater RPC — the row renders its
        // unsupported copy off the null state below.
      });
    const unsubscribe = bridge.subscribe('appUpdateState', setState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const run = (type: BridgeRpcType & `oh.updates.${string}`): void => {
    const bridge = getHostBridge();
    if (!bridge) return;
    void bridge.call(type).then(setState);
  };

  const releaseNotesLink =
    state?.releaseNotesUrl !== null && state?.releaseNotesUrl !== undefined ? (
      <Button
        type="link"
        size="small"
        style={{ padding: 0, height: 'auto' }}
        onClick={() => {
          const url = state.releaseNotesUrl;
          if (url === null) return;
          const openUrl = getCapability('openExternalUrl');
          if (openUrl) void openUrl(url);
          else window.open(url, '_blank', 'noopener');
        }}
      >
        Release notes
      </Button>
    ) : null;

  let body: React.ReactNode;
  if (state === null || !state.supported) {
    body = <Text type="secondary">Updates are handled by your install channel in this build.</Text>;
  } else {
    switch (state.phase) {
      case 'checking':
        body = (
          <Text type="secondary">
            <SyncOutlined spin /> Checking for updates…
          </Text>
        );
        break;
      case 'available':
        body = (
          <>
            {state.belowSafeFloor ? (
              <Text type="danger">
                {`Version ${state.availableVersion} fixes a security issue affecting this version.`}
              </Text>
            ) : (
              <Text>Version {state.availableVersion} is available.</Text>
            )}
            <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => run('oh.updates.download')}>
              Download
            </Button>
            {releaseNotesLink}
          </>
        );
        break;
      case 'downloading':
        body = (
          <div style={{ width: '100%', maxWidth: 320 }}>
            <Text type="secondary">Downloading {state.availableVersion}…</Text>
            <Progress percent={state.progressPercent ?? 0} size="small" />
          </div>
        );
        break;
      case 'downloaded':
        body = (
          <>
            <Text>Version {state.availableVersion} is ready to install.</Text>
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={() => run('oh.updates.install')}>
              Restart to install
            </Button>
            {releaseNotesLink}
          </>
        );
        break;
      case 'error':
        body = (
          <>
            <Text type="danger">Update check failed: {state.errorMessage}</Text>
            <Button size="small" onClick={() => run('oh.updates.checkNow')}>
              Retry
            </Button>
          </>
        );
        break;
      default:
        body = (
          <>
            <Text type="secondary">You're on the latest version ({state.currentVersion}).</Text>
            <Button size="small" onClick={() => run('oh.updates.checkNow')}>
              Check now
            </Button>
          </>
        );
    }
  }

  const lastChecked = state?.supported ? formatLastChecked(state.lastCheckedAt) : null;

  return (
    <FieldRow settingKey={def.key} label={def.label} description={def.description} block>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>{body}</div>
      {lastChecked && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {lastChecked}
        </Text>
      )}
    </FieldRow>
  );
};

export default AppUpdateRow;
