/**
 * App-update row — custom editor for `updates.state`
 * (the updates plan). Mirrors the main process's updater over
 * `oh.updates.getState` + the `appUpdateState` broadcast, and drives it
 * with the consent actions: Check now, Update & Restart (download if
 * needed, then restart into the update), Restart to install. Nothing
 * here installs implicitly — the row only ever calls the RPC matching
 * the button the user pressed.
 */

import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import type { AppUpdateState, BridgeRpcType } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, Progress, Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const AppUpdateRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
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
        {t('workbench.settings.updatesRow.releaseNotes')}
      </Button>
    ) : null;

  let body: React.ReactNode;
  if (state === null || !state.supported) {
    body = <Text type="secondary">{t('workbench.settings.updatesRow.unsupported')}</Text>;
  } else {
    switch (state.phase) {
      case 'checking':
        body = (
          <Text type="secondary">
            <SyncOutlined spin /> {t('workbench.settings.updatesRow.checking')}
          </Text>
        );
        break;
      case 'available':
        body = (
          <>
            {state.belowSafeFloor ? (
              <Text type="danger">
                {t('workbench.settings.updatesRow.securityFix', { version: state.availableVersion ?? '' })}
              </Text>
            ) : (
              <Text>{t('workbench.settings.updatesRow.available', { version: state.availableVersion ?? '' })}</Text>
            )}
            {state.installMethod === 'packageManager' ? (
              // deb/rpm installs: the package manager owns the install —
              // the row informs instead of offering Update & Restart.
              <Text type="secondary">{t('workbench.settings.updatesRow.packageManager')}</Text>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => run('oh.updates.updateAndRestart')}
              >
                {t('workbench.settings.updatesRow.updateAndRestart')}
              </Button>
            )}
            {releaseNotesLink}
          </>
        );
        break;
      case 'downloading':
        body = (
          <div style={{ width: '100%', maxWidth: 320 }}>
            <Text type="secondary">
              {t('workbench.settings.updatesRow.downloading', { version: state.availableVersion ?? '' })}
            </Text>
            <Progress percent={state.progressPercent ?? 0} size="small" />
          </div>
        );
        break;
      case 'downloaded':
        body = (
          <>
            <Text>{t('workbench.settings.updatesRow.readyToInstall', { version: state.availableVersion ?? '' })}</Text>
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={() => run('oh.updates.install')}>
              {t('workbench.settings.updatesRow.restartToInstall')}
            </Button>
            {releaseNotesLink}
          </>
        );
        break;
      case 'error':
        body = (
          <>
            <Text type="danger">
              {t('workbench.settings.updatesRow.checkFailed', { message: state.errorMessage ?? '' })}
            </Text>
            <Button size="small" onClick={() => run('oh.updates.checkNow')}>
              {t('workbench.settings.updatesRow.retry')}
            </Button>
          </>
        );
        break;
      default:
        body = (
          <>
            <Text type="secondary">
              {t('workbench.settings.updatesRow.upToDate', { version: state.currentVersion })}
            </Text>
            <Button size="small" onClick={() => run('oh.updates.checkNow')}>
              {t('workbench.settings.updatesRow.checkNow')}
            </Button>
          </>
        );
    }
  }

  const lastChecked =
    state?.supported && state.lastCheckedAt !== null
      ? t('workbench.settings.updatesRow.lastChecked', { when: new Date(state.lastCheckedAt).toLocaleString() })
      : null;

  return (
    <FieldRow settingKey={def.key} label={resolveLabel(def, t)} description={resolveDescription(def, t)} block>
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
