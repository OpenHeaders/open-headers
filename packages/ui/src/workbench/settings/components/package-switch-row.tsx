/**
 * Package-switch row — custom editor for `updates.installType` on
 * Application › Updates: a classic Windows install switching to the
 * Windows package, over the `packageSwitch` capability only that install
 * registers.
 *
 * The row names the install type and offers the switch. Whether it may
 * begin is the host's answer, read when the row opens: where it may not,
 * the button is off and one line under it says why. The button opens one
 * dialog that says what happens and what is kept; its Switch starts the
 * installer program, whose own window shows the progress — the row only
 * says it is at work. A switch that stops leaves one line here.
 */

import { SyncOutlined } from '@ant-design/icons';
import type { PackageSwitchState } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, Modal, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';
import { packageSwitchReasonKey, packageSwitchStopKey } from './package-switch-lines';

/** What the row knows of the host's answer: none yet, none to be had, or the state. */
type Reading = 'checking' | 'unanswered' | PackageSwitchState;

const PackageSwitchRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [reading, setReading] = useState<Reading>('checking');
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);

  const read = useCallback((): void => {
    const packageSwitch = getCapability('packageSwitch')?.();
    if (!packageSwitch) return;
    setReading('checking');
    packageSwitch.read().then(setReading, () => setReading('unanswered'));
  }, []);

  useEffect(() => {
    read();
    return getHostBridge()?.subscribe('packageSwitchState', setReading);
  }, [read]);

  const start = async (): Promise<void> => {
    const packageSwitch = getCapability('packageSwitch')?.();
    if (!packageSwitch) return;
    setStarting(true);
    try {
      setReading(await packageSwitch.start());
    } catch {
      // The host did not answer: a switch that never began, said as one that stopped.
      setReading((was) =>
        typeof was === 'object' && was.phase === 'idle' ? { ...was, lastStop: { code: null } } : was,
      );
    }
    setStarting(false);
    setConfirming(false);
  };

  const idle = typeof reading === 'object' && reading.phase === 'idle' ? reading : null;
  const working = typeof reading === 'object' && reading.phase === 'working';
  const version = idle?.verdict.eligible ? idle.verdict.version : null;
  const blocker = idle !== null && !idle.verdict.eligible ? idle.verdict.blocker : null;
  const unread = reading === 'unanswered' || blocker === 'feed-unread';
  const stopKey = idle?.lastStop ? packageSwitchStopKey(idle.lastStop.code) : null;
  const channel = idle ? t(`workbench.settings.def.updates.channel.option.${idle.channel}.label`) : '';

  const reason =
    reading === 'unanswered'
      ? t(packageSwitchReasonKey('feed-unread'))
      : blocker !== null && idle !== null
        ? t(packageSwitchReasonKey(blocker), {
            path: idle.packageDataDir,
            channel,
            version: idle.offeredVersion ?? '',
          })
        : null;

  const lineStyle: React.CSSProperties = { fontSize: 12, color: token.colorTextSecondary };
  const busyLine = (label: string, testId: string): React.ReactNode => (
    <span style={lineStyle} data-testid={testId}>
      <SyncOutlined spin style={{ marginInlineEnd: 6 }} />
      {label}
    </span>
  );

  const close = (): void => {
    if (!starting) setConfirming(false);
  };

  return (
    <>
      <FieldRow
        settingKey={def.key}
        label={resolveLabel(def, t)}
        description={resolveDescription(def, t)}
        resettable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: token.colorText }} data-testid="package-switch-value">
              {t('workbench.settings.def.updates.installType.value.classic')}
            </span>
            <Button
              size="small"
              disabled={version === null}
              onClick={() => setConfirming(true)}
              data-testid="package-switch-open"
            >
              {t('workbench.settings.def.updates.installType.action.label')}
            </Button>
          </div>
          {reading === 'checking' &&
            busyLine(t('workbench.settings.def.updates.installType.checking'), 'package-switch-checking')}
          {working && busyLine(t('workbench.settings.def.updates.installType.working'), 'package-switch-working')}
          {stopKey !== null && (
            <span style={{ fontSize: 12, color: token.colorError }} data-testid="package-switch-stopped">
              {t(stopKey)}
            </span>
          )}
          {reason !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ ...lineStyle, wordBreak: 'break-word' }} data-testid="package-switch-reason">
                {reason}
              </span>
              {unread && (
                <Button size="small" onClick={read} data-testid="package-switch-retry">
                  {t('workbench.settings.updatesRow.retry')}
                </Button>
              )}
            </div>
          )}
        </div>
      </FieldRow>
      <Modal
        title={t('workbench.settings.def.updates.installType.confirm.title')}
        open={confirming}
        onCancel={close}
        closable={!starting}
        maskClosable={!starting}
        keyboard={!starting}
        destroyOnHidden
        width={480}
        footer={
          <>
            <Button onClick={close} disabled={starting} data-testid="package-switch-cancel">
              {t('shared.action.cancel')}
            </Button>
            <Button type="primary" loading={starting} onClick={() => void start()} data-testid="package-switch-confirm">
              {t('workbench.settings.def.updates.installType.confirm.ok')}
            </Button>
          </>
        }
      >
        <div style={{ fontSize: 12, color: token.colorText }}>
          <p style={{ margin: '8px 0 0' }}>
            {t('workbench.settings.def.updates.installType.confirm.does', { version: version ?? '' })}
          </p>
          <p style={{ margin: '8px 0 0', color: token.colorTextSecondary }}>
            {t('workbench.settings.def.updates.installType.confirm.kept')}
          </p>
        </div>
      </Modal>
    </>
  );
};

export default PackageSwitchRow;
