/**
 * Local-data removal row — custom editor for `data.removeLocalData` on
 * Application › Data: a Windows package removing its own data folder and
 * capture trust, over the `removeLocalData` capability only a package
 * registers. Two steps and no typed word: the row's button opens a
 * dialog that says what goes and what stays, and the dialog's danger
 * button runs it — the app then closes.
 *
 * A trust store that keeps the certificate stops the run with nothing
 * else changed; the dialog lists it and takes the person's second word.
 * The app starts itself again through its launch alias to delete the
 * folder, so the row says so while that alias is switched off.
 */

import { Alert, App as AntApp, Button, Modal, Tag, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { LocalDataRemovalRefusedStore } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { usePackageAliases } from '@openheaders/ui/shared/hooks/usePackageAliases';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';
import { storeLabelKey, storeRefName } from './proxy-trust-stores';

type Step =
  | { kind: 'confirm' }
  | { kind: 'refused'; stores: ReadonlyArray<LocalDataRemovalRefusedStore>; error?: string };

const LocalDataRemovalRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const aliases = usePackageAliases();
  const [step, setStep] = useState<Step | null>(null);
  const [running, setRunning] = useState(false);
  const aliasOff = aliases !== null && !aliases.app.on;

  const run = async (force: boolean): Promise<void> => {
    const remove = getCapability('removeLocalData');
    if (!remove) return;
    setRunning(true);
    try {
      const result = await remove({ force });
      // The app is closing: the dialog stays busy until its window goes.
      if (result.outcome === 'restarting') return;
      setRunning(false);
      if (result.outcome === 'trust-refused') {
        setStep({
          kind: 'refused',
          stores: result.stores,
          ...(result.error !== undefined ? { error: result.error } : {}),
        });
        return;
      }
      setStep(null);
      if (result.outcome === 'alias-off') {
        message.warning(t('workbench.settings.def.data.removeLocalData.aliasOff', { name: result.name }));
      } else {
        message.error(t('workbench.settings.def.data.removeLocalData.failed', { reason: result.reason }));
      }
    } catch (err) {
      setRunning(false);
      setStep(null);
      message.error(
        t('workbench.settings.def.data.removeLocalData.failed', {
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  const close = (): void => {
    if (!running) setStep(null);
  };

  return (
    <>
      <FieldRow
        settingKey={def.key}
        label={resolveLabel(def, t)}
        description={resolveDescription(def, t)}
        resettable={false}
      >
        <Button
          danger
          disabled={aliasOff}
          onClick={() => setStep({ kind: 'confirm' })}
          data-testid="local-data-remove"
        >
          {t('workbench.settings.def.data.removeLocalData.action.label')}
        </Button>
      </FieldRow>
      {aliasOff && (
        <Alert
          type="warning"
          showIcon
          data-testid="local-data-remove-alias-off"
          title={
            <span style={{ fontSize: 12 }}>
              {t('workbench.settings.def.data.removeLocalData.aliasOff', { name: aliases.app.name })}
            </span>
          }
          action={
            <Button size="small" onClick={aliases.openSettings} data-testid="local-data-remove-alias-open">
              {t('shared.action.openWindowsSettings')}
            </Button>
          }
          style={{ margin: '4px 0 8px' }}
        />
      )}
      <Modal
        title={t('workbench.settings.def.data.removeLocalData.confirm.title')}
        open={step !== null}
        onCancel={close}
        closable={!running}
        maskClosable={!running}
        keyboard={!running}
        destroyOnHidden
        width={480}
        footer={
          step?.kind === 'refused' ? (
            <>
              <Button onClick={close} disabled={running} data-testid="local-data-remove-keep">
                {t('workbench.settings.def.data.removeLocalData.keepEverything')}
              </Button>
              <Button
                danger
                type="primary"
                loading={running}
                onClick={() => void run(true)}
                data-testid="local-data-remove-anyway"
              >
                {t('workbench.settings.def.data.removeLocalData.removeAnyway')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={close} disabled={running} data-testid="local-data-remove-cancel">
                {t('shared.action.cancel')}
              </Button>
              <Button
                danger
                type="primary"
                loading={running}
                onClick={() => void run(false)}
                data-testid="local-data-remove-confirm"
              >
                {t('workbench.settings.def.data.removeLocalData.confirm.ok')}
              </Button>
            </>
          )
        }
      >
        {step?.kind === 'confirm' && (
          <div style={{ fontSize: 12, color: token.colorText }}>
            <p style={{ margin: '8px 0 0' }}>{t('workbench.settings.def.data.removeLocalData.confirm.goes')}</p>
            <p style={{ margin: '8px 0 0', color: token.colorTextSecondary }}>
              {t('workbench.settings.def.data.removeLocalData.confirm.stays')}
            </p>
          </div>
        )}
        {step?.kind === 'refused' && (
          <div style={{ fontSize: 12, color: token.colorText }} data-testid="local-data-remove-refused">
            <p style={{ margin: '8px 0 6px' }}>{t('workbench.settings.def.data.removeLocalData.trustRefused')}</p>
            {step.stores.map((store) => (
              <div
                key={`${store.store}:${store.ref}`}
                title={store.ref}
                style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0' }}
              >
                <Tag color="red" style={{ fontSize: 11, flex: 'none' }}>
                  {t(storeLabelKey(store.store, store.ref))}
                </Tag>
                <span style={{ wordBreak: 'break-word' }}>
                  {store.error !== undefined
                    ? `${storeRefName(store.store, store.ref)} — ${store.error}`
                    : storeRefName(store.store, store.ref)}
                </span>
              </div>
            ))}
            {step.error !== undefined && (
              <p style={{ margin: '4px 0 0', color: token.colorError, wordBreak: 'break-word' }}>{step.error}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default LocalDataRemovalRow;
