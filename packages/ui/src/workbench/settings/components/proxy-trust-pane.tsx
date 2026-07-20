/**
 * ProxyTrustPane — right-pane renderer for the Proxy category (desktop
 * + served web admin). The consent surface over the
 * `oh.daemon.proxy.trust.*` admin RPCs (PROXY_SECURITY.md §2.3): a
 * wizard that names what is installed, what it enables, and how it is
 * removed — nothing is installed before the explicit commit; per-store
 * outcomes render exactly as reported (§5 refuse-rather-than-half-
 * trust), and an elevation denial is surfaced, never retried. Trust
 * state is re-probed by the daemon on every read, so the pane holds no
 * remembered flags of its own.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { ProxyCaPublicInfo, ProxyTrustChange, ProxyTrustStoreId, ProxyTrustStoreState } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Alert, App as AntApp, Button, Checkbox, Modal, Popconfirm, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { resolveLabel, resolveOptionalDescription } from '../localize';
import type { CategoryPaneProps } from '../types';

interface TrustStatus {
  ca: ProxyCaPublicInfo | null;
  stores: ReadonlyArray<ProxyTrustStoreState>;
  changes: ReadonlyArray<ProxyTrustChange>;
  systemKeychainTrustSupported: boolean;
}

interface StoreResult {
  store: ProxyTrustStoreId;
  ref: string;
  ok: boolean;
  error?: string;
  elevationRequired?: boolean;
  residue?: boolean;
}

type HelperRegistration = 'enabled' | 'requiresApproval' | 'notRegistered' | 'notFound' | 'unknown';

interface HelperInfo {
  present: boolean;
  available: boolean;
  reason?: string;
  registration: HelperRegistration | null;
}

const HELPER_STATE_TEXT: Record<HelperRegistration, MessageKey> = {
  enabled: 'workbench.settings.proxyTrustPane.helper.state.enabled',
  requiresApproval: 'workbench.settings.proxyTrustPane.helper.state.requiresApproval',
  notRegistered: 'workbench.settings.proxyTrustPane.helper.state.notRegistered',
  notFound: 'workbench.settings.proxyTrustPane.helper.state.notFound',
  unknown: 'workbench.settings.proxyTrustPane.helper.state.unknown',
};

const HELPER_STATE_COLOR: Record<HelperRegistration, string | undefined> = {
  enabled: 'green',
  requiresApproval: 'gold',
  notRegistered: undefined,
  notFound: 'red',
  unknown: undefined,
};

/**
 * Firefox rows are per-profile — profile dirs are `<salt>.<name>`, so
 * the name part tells them apart ("default", "default-release"); the
 * full path stays in the row tooltip.
 */
function storeRefName(store: ProxyTrustStoreId, ref: string): string {
  if (store !== 'nss-firefox') return ref;
  const basename = ref.split('/').pop() ?? ref;
  const dot = basename.indexOf('.');
  return dot > 0 ? basename.slice(dot + 1) : basename;
}

type WizardStep = { step: 'explain' } | { step: 'choose' } | { step: 'results'; results: ReadonlyArray<StoreResult> };

const STORE_LABEL: Record<ProxyTrustStoreId, MessageKey> = {
  'macos-login-keychain': 'workbench.settings.proxyTrustPane.stores.loginKeychain',
  'macos-system-keychain': 'workbench.settings.proxyTrustPane.stores.systemKeychain',
  'nss-firefox': 'workbench.settings.proxyTrustPane.stores.firefoxProfile',
};

const STATE_TEXT: Record<ProxyTrustStoreState['state'], MessageKey> = {
  trusted: 'workbench.settings.proxyTrustPane.stores.state.trusted',
  absent: 'workbench.settings.proxyTrustPane.stores.state.absent',
  untrusted: 'workbench.settings.proxyTrustPane.stores.state.untrusted',
  mismatch: 'workbench.settings.proxyTrustPane.stores.state.mismatch',
  unavailable: 'workbench.settings.proxyTrustPane.stores.state.unavailable',
  covered: 'workbench.settings.proxyTrustPane.stores.state.covered',
  optedOut: 'workbench.settings.proxyTrustPane.stores.state.optedOut',
};

const STATE_COLOR: Record<ProxyTrustStoreState['state'], string | undefined> = {
  trusted: 'green',
  absent: undefined,
  untrusted: 'gold',
  mismatch: 'red',
  unavailable: 'orange',
  covered: 'green',
  optedOut: 'gold',
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 12 }}>
      <span style={{ width: 130, flex: 'none', color: token.colorTextSecondary }}>{label}</span>
      <span style={{ color: token.colorText, wordBreak: 'break-all' }}>{children}</span>
    </div>
  );
};

const ProxyTrustPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState<TrustStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardStep | null>(null);
  const [selected, setSelected] = useState<ReadonlyArray<ProxyTrustStoreId>>([]);
  const [installing, setInstalling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeResults, setRemoveResults] = useState<ReadonlyArray<StoreResult>>([]);
  const [helperInfo, setHelperInfo] = useState<HelperInfo | null>(null);
  const [helperBusy, setHelperBusy] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const resp = await hostBridge.call('oh.daemon.proxy.trust.status');
      setStatus({
        ca: resp.ca,
        stores: resp.stores,
        changes: resp.changes,
        systemKeychainTrustSupported: resp.systemKeychainTrustSupported,
      });
      setLoadError(null);
    } catch (err) {
      setStatus(null);
      setLoadError((err as Error).message);
    }
    try {
      setHelperInfo(await hostBridge.call('oh.daemon.proxy.trust.helper'));
    } catch {
      setHelperInfo(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openWizard = (): void => {
    setSelected([]);
    setWizard({ step: 'explain' });
  };

  const install = async (): Promise<void> => {
    setInstalling(true);
    try {
      const result = await hostBridge.call('oh.daemon.proxy.trust.install', { stores: selected });
      if (result.ok) {
        setWizard({ step: 'results', results: result.results });
      } else {
        message.error(t('workbench.settings.proxyTrustPane.wizard.installFailed', { message: result.error }));
      }
    } catch (err) {
      message.error(t('workbench.settings.proxyTrustPane.wizard.installFailed', { message: (err as Error).message }));
    } finally {
      setInstalling(false);
      void reload();
    }
  };

  const remove = async (): Promise<void> => {
    setRemoving(true);
    try {
      const result = await hostBridge.call('oh.daemon.proxy.trust.remove', {});
      setRemoveResults(result.results.filter((r) => !r.ok));
      if (result.ok) {
        message.success(t('workbench.settings.proxyTrustPane.removed'));
      } else {
        message.warning(t('workbench.settings.proxyTrustPane.removePartial'));
      }
    } catch (err) {
      message.error(t('workbench.settings.proxyTrustPane.removeFailed', { message: (err as Error).message }));
    } finally {
      setRemoving(false);
      void reload();
    }
  };

  const deleteCa = async (): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.daemon.proxy.trust.remove', { dropCa: true });
      if (result.ok) {
        message.success(t('workbench.settings.proxyTrustPane.ca.deleted'));
      } else {
        message.error(
          t('workbench.settings.proxyTrustPane.ca.deleteFailed', {
            message: result.error ?? result.results.find((r) => !r.ok)?.error ?? '',
          }),
        );
      }
    } catch (err) {
      message.error(t('workbench.settings.proxyTrustPane.ca.deleteFailed', { message: (err as Error).message }));
    }
    void reload();
  };

  const runHelperVerb = async (
    verb: 'oh.daemon.proxy.trust.helperRegister' | 'oh.daemon.proxy.trust.helperUnregister',
  ): Promise<void> => {
    setHelperBusy(true);
    try {
      const result = await hostBridge.call(verb);
      if (!result.ok) {
        message.error(t('workbench.settings.proxyTrustPane.helper.actionFailed', { message: result.error ?? '' }));
      }
    } catch (err) {
      message.error(t('workbench.settings.proxyTrustPane.helper.actionFailed', { message: (err as Error).message }));
    } finally {
      setHelperBusy(false);
      void reload();
    }
  };

  const openLoginItems = async (): Promise<void> => {
    try {
      await hostBridge.call('oh.daemon.proxy.trust.helperLoginItems');
    } catch (err) {
      message.error(t('workbench.settings.proxyTrustPane.helper.actionFailed', { message: (err as Error).message }));
    }
  };

  const toggleStore = (store: ProxyTrustStoreId, checked: boolean): void => {
    setSelected((prev) => (checked ? [...prev.filter((s) => s !== store), store] : prev.filter((s) => s !== store)));
  };

  const stores = status?.stores ?? [];
  const changes = status?.changes ?? [];
  const hasMismatch = stores.some((s) => s.state === 'mismatch');
  const hasFirefoxProfiles = stores.some((s) => s.store === 'nss-firefox');
  // Profiles whose probe answers `unavailable` (certutil missing,
  // unreadable db) cannot be written either — offering them would only
  // manufacture a failed install.
  const hasUsableFirefoxProfiles = stores.some((s) => s.store === 'nss-firefox' && s.state !== 'unavailable');
  const hasKeychains = stores.some((s) => s.store === 'macos-login-keychain' || s.store === 'macos-system-keychain');
  const systemTrustSupported = status?.systemKeychainTrustSupported ?? false;
  const failedResults = wizard?.step === 'results' ? wizard.results.filter((r) => !r.ok) : [];

  const storeOption = (
    store: ProxyTrustStoreId,
    noteKey: MessageKey,
    available: boolean,
    unavailableNoteKey?: MessageKey,
  ): React.ReactNode => (
    <label
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', cursor: available ? 'pointer' : 'not-allowed' }}
    >
      <Checkbox
        data-testid={`proxy-trust-opt-${store}`}
        checked={selected.includes(store)}
        disabled={!available}
        onChange={(e) => toggleStore(store, e.target.checked)}
      />
      <span style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: available ? token.colorText : token.colorTextDisabled }}>
          {t(STORE_LABEL[store])}
        </span>
        <span style={{ display: 'block', color: token.colorTextSecondary }}>
          {!available && unavailableNoteKey ? t(unavailableNoteKey) : t(noteKey)}
        </span>
      </span>
    </label>
  );

  const resultRows = (results: ReadonlyArray<StoreResult>): React.ReactNode => (
    <div>
      {results.map((r) => (
        <div key={`${r.store}:${r.ref}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0', fontSize: 12 }}>
          <Tag color={r.ok ? 'green' : 'red'} style={{ fontSize: 11 }}>
            {t(STORE_LABEL[r.store])}
          </Tag>
          <span style={{ color: r.ok ? token.colorText : token.colorError, wordBreak: 'break-word' }}>
            {r.ok
              ? t('workbench.settings.proxyTrustPane.wizard.results.ok')
              : r.residue
                ? `${t('workbench.settings.proxyTrustPane.wizard.results.residue')}${r.error !== undefined ? ` (${r.error})` : ''}`
                : r.elevationRequired
                  ? t('workbench.settings.proxyTrustPane.wizard.results.elevation')
                  : t('workbench.settings.proxyTrustPane.wizard.results.failed', { message: r.error ?? '' })}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '14px 18px 20px', maxWidth: 760 }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {resolveLabel(category, t)}
        </h2>
        {resolveOptionalDescription(category, t) && (
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
            {resolveOptionalDescription(category, t)}
          </p>
        )}
      </header>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: token.colorTextSecondary }}>
        {t('workbench.settings.proxyTrustPane.intro')}
      </p>

      {loadError !== null && (
        <Alert
          type="error"
          showIcon
          message={
            <span style={{ fontSize: 12 }}>
              {t('workbench.settings.proxyTrustPane.loadFailed', { message: loadError })}
            </span>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {hasMismatch && (
        <Alert
          type="error"
          showIcon
          message={<span style={{ fontSize: 12 }}>{t('workbench.settings.proxyTrustPane.mismatchAlert.title')}</span>}
          description={<span style={{ fontSize: 12 }}>{t('workbench.settings.proxyTrustPane.mismatchAlert.body')}</span>}
          style={{ marginBottom: 12 }}
        />
      )}

      {removeResults.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={<span style={{ fontSize: 12 }}>{t('workbench.settings.proxyTrustPane.removePartial')}</span>}
          description={resultRows(removeResults)}
          style={{ marginBottom: 12 }}
        />
      )}

      <section style={{ marginBottom: 14 }}>
        <div className="settings-card" style={{ padding: '8px 14px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, padding: '4px 0 2px' }}>
            {t('workbench.settings.proxyTrustPane.ca.title')}
          </div>
          {status !== null && status.ca === null && (
            <p style={{ margin: '4px 0', fontSize: 12, color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.ca.none')}
            </p>
          )}
          {status?.ca && (
            <>
              <DetailRow label={t('workbench.settings.proxyTrustPane.ca.subject')}>{status.ca.subject}</DetailRow>
              <DetailRow label={t('workbench.settings.proxyTrustPane.ca.fingerprint')}>
                <span style={{ fontFamily: token.fontFamilyCode, fontSize: 11 }}>{status.ca.fingerprintSha256}</span>
              </DetailRow>
              <DetailRow label={t('workbench.settings.proxyTrustPane.ca.validity')}>
                {t('workbench.settings.proxyTrustPane.ca.validityRange', {
                  from: formatDay(status.ca.notBeforeIso),
                  until: formatDay(status.ca.notAfterIso),
                })}
              </DetailRow>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0 4px' }}>
            <Button data-testid="proxy-trust-setup" type="primary" size="small" onClick={openWizard}>
              {t('workbench.settings.proxyTrustPane.installButton')}
            </Button>
            {changes.length > 0 && (
              <Popconfirm
                title={t('workbench.settings.proxyTrustPane.removeConfirm.title')}
                description={t('workbench.settings.proxyTrustPane.removeConfirm.body')}
                okText={t('workbench.settings.proxyTrustPane.removeConfirm.ok')}
                okButtonProps={{ danger: true }}
                styles={{ root: { maxWidth: 380 } }}
                onConfirm={() => void remove()}
              >
                <Button data-testid="proxy-trust-remove" danger size="small" loading={removing}>
                  {t('workbench.settings.proxyTrustPane.removeButton')}
                </Button>
              </Popconfirm>
            )}
            {status?.ca && changes.length === 0 && (
              <Popconfirm
                title={t('workbench.settings.proxyTrustPane.ca.deleteConfirm.title')}
                description={t('workbench.settings.proxyTrustPane.ca.deleteConfirm.body')}
                okText={t('workbench.settings.proxyTrustPane.ca.deleteConfirm.ok')}
                okButtonProps={{ danger: true }}
                styles={{ root: { maxWidth: 380 } }}
                onConfirm={() => void deleteCa()}
              >
                <Button data-testid="proxy-trust-delete-ca" danger size="small">
                  {t('workbench.settings.proxyTrustPane.ca.deleteButton')}
                </Button>
              </Popconfirm>
            )}
            {changes.length > 0 && (
              <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                {t('workbench.settings.proxyTrustPane.recordedCount', { count: changes.length })}
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="settings-card" style={{ padding: '8px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 2px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: token.colorText, flex: 1 }}>
              {t('workbench.settings.proxyTrustPane.stores.title')}
            </span>
            <Button data-testid="proxy-trust-refresh" size="small" onClick={() => void reload()}>
              {t('workbench.settings.proxyTrustPane.refresh')}
            </Button>
          </div>
          {status !== null && stores.length === 0 && (
            <p style={{ margin: '4px 0', fontSize: 12, color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.stores.empty')}
            </p>
          )}
          {stores.map((s) => (
            <div
              key={`${s.store}:${s.ref}`}
              data-testid={`proxy-trust-store-${s.store}`}
              style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', fontSize: 12 }}
            >
              <span style={{ width: 130, flex: 'none', color: token.colorText, fontWeight: 500 }}>
                {t(STORE_LABEL[s.store])}
              </span>
              <Tag color={STATE_COLOR[s.state]} style={{ fontSize: 11, flex: 'none' }}>
                {t(STATE_TEXT[s.state])}
              </Tag>
              <span
                title={s.detail !== undefined ? `${s.ref} — ${s.detail}` : s.ref}
                style={{
                  color: token.colorTextSecondary,
                  fontSize: 11.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.detail !== undefined ? `${storeRefName(s.store, s.ref)} — ${s.detail}` : storeRefName(s.store, s.ref)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {helperInfo !== null && hasKeychains && (
        <section style={{ marginTop: 14 }}>
          <div className="settings-card" style={{ padding: '8px 14px 10px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, padding: '4px 0 2px' }}>
              {t('workbench.settings.proxyTrustPane.helper.title')}
            </div>
            <p style={{ margin: '2px 0 4px', fontSize: 12, color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.helper.blurb')}
            </p>
            {!helperInfo.present && (
              <p style={{ margin: '4px 0', fontSize: 12, color: token.colorTextSecondary }}>
                {t('workbench.settings.proxyTrustPane.helper.notPresent')}
              </p>
            )}
            {helperInfo.present && (
              <>
                <DetailRow label={t('workbench.settings.proxyTrustPane.helper.registrationLabel')}>
                  <Tag
                    color={helperInfo.registration !== null ? HELPER_STATE_COLOR[helperInfo.registration] : undefined}
                    style={{ fontSize: 11 }}
                  >
                    {helperInfo.registration !== null
                      ? t(HELPER_STATE_TEXT[helperInfo.registration])
                      : t('workbench.settings.proxyTrustPane.helper.state.unknown')}
                  </Tag>
                </DetailRow>
                <DetailRow label={t('workbench.settings.proxyTrustPane.helper.daemonLabel')}>
                  <Tag color={helperInfo.available ? 'green' : 'orange'} style={{ fontSize: 11 }}>
                    {helperInfo.available
                      ? t('workbench.settings.proxyTrustPane.helper.probe.ok')
                      : t('workbench.settings.proxyTrustPane.helper.probe.down')}
                  </Tag>
                  {!helperInfo.available && helperInfo.reason !== undefined && (
                    <span style={{ color: token.colorTextSecondary }}>({helperInfo.reason})</span>
                  )}
                </DetailRow>
                {helperInfo.registration === 'requiresApproval' && (
                  <p style={{ margin: '4px 0', fontSize: 12, color: token.colorTextSecondary }}>
                    {t('workbench.settings.proxyTrustPane.helper.approvalHint')}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0 4px' }}>
                  {helperInfo.registration !== 'enabled' && helperInfo.registration !== 'requiresApproval' && (
                    <Button
                      data-testid="proxy-trust-helper-register"
                      type="primary"
                      size="small"
                      loading={helperBusy}
                      onClick={() => void runHelperVerb('oh.daemon.proxy.trust.helperRegister')}
                    >
                      {t('workbench.settings.proxyTrustPane.helper.registerButton')}
                    </Button>
                  )}
                  {helperInfo.registration === 'requiresApproval' && (
                    <Button
                      data-testid="proxy-trust-helper-login-items"
                      type="primary"
                      size="small"
                      onClick={() => void openLoginItems()}
                    >
                      {t('workbench.settings.proxyTrustPane.helper.loginItemsButton')}
                    </Button>
                  )}
                  {(helperInfo.registration === 'enabled' || helperInfo.registration === 'requiresApproval') && (
                    <Button
                      data-testid="proxy-trust-helper-unregister"
                      danger
                      size="small"
                      loading={helperBusy}
                      onClick={() => void runHelperVerb('oh.daemon.proxy.trust.helperUnregister')}
                    >
                      {t('workbench.settings.proxyTrustPane.helper.unregisterButton')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <Modal
        title={t('workbench.settings.proxyTrustPane.wizard.title')}
        open={wizard !== null}
        onCancel={() => setWizard(null)}
        footer={null}
        width={520}
      >
        {wizard?.step === 'explain' && (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: token.colorText, marginTop: 8 }}>
              {t('workbench.settings.proxyTrustPane.wizard.explain.whatTitle')}
            </div>
            <p style={{ margin: '2px 0 0', color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.wizard.explain.whatBody')}
            </p>
            <div style={{ fontWeight: 600, color: token.colorText, marginTop: 10 }}>
              {t('workbench.settings.proxyTrustPane.wizard.explain.enablesTitle')}
            </div>
            <p style={{ margin: '2px 0 0', color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.wizard.explain.enablesBody')}
            </p>
            <div style={{ fontWeight: 600, color: token.colorText, marginTop: 10 }}>
              {t('workbench.settings.proxyTrustPane.wizard.explain.removeTitle')}
            </div>
            <p style={{ margin: '2px 0 0', color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.wizard.explain.removeBody')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button
                data-testid="proxy-trust-wizard-next"
                type="primary"
                size="small"
                onClick={() => setWizard({ step: 'choose' })}
              >
                {t('workbench.settings.proxyTrustPane.wizard.explain.next')}
              </Button>
            </div>
          </div>
        )}
        {wizard?.step === 'choose' && (
          <div style={{ fontSize: 12 }}>
            <p style={{ margin: '8px 0 4px', color: token.colorTextSecondary }}>
              {t('workbench.settings.proxyTrustPane.wizard.choose.blurb')}
            </p>
            {storeOption('macos-login-keychain', 'workbench.settings.proxyTrustPane.wizard.choose.loginNote', hasKeychains)}
            {storeOption(
              'macos-system-keychain',
              'workbench.settings.proxyTrustPane.wizard.choose.systemNote',
              hasKeychains && systemTrustSupported,
              'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable',
            )}
            {!hasKeychains &&
              storeOption(
                'nss-firefox',
                'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote',
                hasFirefoxProfiles && hasUsableFirefoxProfiles,
                hasFirefoxProfiles
                  ? 'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable'
                  : 'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone',
              )}
            {hasKeychains && hasFirefoxProfiles && (
              <p style={{ margin: '6px 0 0', color: token.colorTextSecondary }}>
                {t('workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote')}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button
                data-testid="proxy-trust-wizard-confirm"
                type="primary"
                size="small"
                disabled={selected.length === 0}
                loading={installing}
                onClick={() => void install()}
              >
                {t('workbench.settings.proxyTrustPane.wizard.choose.confirm', { count: selected.length })}
              </Button>
            </div>
          </div>
        )}
        {wizard?.step === 'results' && (
          <div style={{ fontSize: 12 }}>
            <Alert
              type={failedResults.length === 0 ? 'success' : 'warning'}
              showIcon
              message={
                <span style={{ fontSize: 12 }}>
                  {failedResults.length === 0
                    ? t('workbench.settings.proxyTrustPane.wizard.results.allOk')
                    : t('workbench.settings.proxyTrustPane.wizard.results.partial')}
                </span>
              }
              style={{ margin: '8px 0 10px' }}
            />
            {resultRows(wizard.results)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button data-testid="proxy-trust-wizard-done" type="primary" size="small" onClick={() => setWizard(null)}>
                {t('workbench.settings.proxyTrustPane.wizard.done')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProxyTrustPane;
