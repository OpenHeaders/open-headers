/**
 * LicensePane — right-pane renderer for the License category (desktop
 * + served web; the extension carries no license plumbing). Renders the
 * entitlement snapshot the host's license slot pushes (`licenseUpdated`)
 * and drives the `oh.daemon.license.*` admin RPCs. The UI renders state
 * and never gates — degradation itself lives in the seat gate
 * (the licensing plan §3.3/§4).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { FREE_SEAT_LIMIT, type LicenseInvalidReason, type LicenseSnapshot } from '@openheaders/core/licensing';
import type { TelemetryMonetizationSurface } from '@openheaders/core/telemetry';
import type { MessageKey } from '@openheaders/i18n';
import { Alert, App as AntApp, Button, Input, Popconfirm, Tag, theme, Upload } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { noteUpgradeCtaShown, trackProductTelemetryEvent } from '../../../shared/product-telemetry';
import { resolveLabel, resolveOptionalDescription } from '../localize';
import type { CategoryPaneProps } from '../types';

const INVALID_REASON_TEXT: Record<LicenseInvalidReason, MessageKey> = {
  malformed: 'workbench.settings.licensePane.invalid.malformed',
  'schema-mismatch': 'workbench.settings.licensePane.invalid.schema-mismatch',
  'unknown-kid': 'workbench.settings.licensePane.invalid.unknown-kid',
  'bad-signature': 'workbench.settings.licensePane.invalid.bad-signature',
};

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const PRICING_URL = 'https://openheaders.com/pricing';

/**
 * Upgrade CTA on the free-tier/grace/expired alerts — desktop only:
 * the pricing page is an external destination (the desktop-teaser
 * download CTA carve-out), and the monetization emitters are desktop-
 * scoped by law (served web is telemetry hard-off; teased hosts render
 * no license pane at all).
 */
const UpgradeCta: React.FC<{ surface: TelemetryMonetizationSurface; label: string }> = ({ surface, label }) => {
  useEffect(() => {
    noteUpgradeCtaShown(surface);
  }, [surface]);
  const open = (): void => {
    trackProductTelemetryEvent({ name: 'upgrade_cta_clicked', surface });
    const openUrl = getCapability('openExternalUrl');
    if (openUrl) void openUrl(PRICING_URL);
    else window.open(PRICING_URL, '_blank', 'noopener');
  };
  return (
    <Button size="small" onClick={open} data-testid={`license-upgrade-cta-${surface}`}>
      {label}
    </Button>
  );
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 12 }}>
      <span style={{ width: 110, flex: 'none', color: token.colorTextSecondary }}>{label}</span>
      <span style={{ color: token.colorText }}>{children}</span>
    </div>
  );
};

const LicensePane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const [snapshot, setSnapshot] = useState<LicenseSnapshot | null>(null);
  const [draft, setDraft] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void hostBridge
      .call('oh.daemon.license.status')
      .then((resp) => {
        if (mounted) setSnapshot(resp.snapshot);
      })
      .catch(() => {
        if (mounted) setSnapshot({ status: 'unlicensed' });
      });
    const unsubscribe = hostBridge.subscribe('licenseUpdated', (next) => setSnapshot(next));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const install = async (text: string): Promise<void> => {
    setInstalling(true);
    setInstallError(null);
    try {
      const result = await hostBridge.call('oh.daemon.license.install', { text });
      if (result.ok) {
        setSnapshot(result.snapshot);
        setDraft('');
        message.success(t('workbench.settings.licensePane.installed'));
      } else {
        setInstallError(result.error);
      }
    } catch (err) {
      setInstallError((err as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  const remove = async (): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.daemon.license.remove');
      setSnapshot(result.snapshot);
      message.success(t('workbench.settings.licensePane.removed'));
    } catch (err) {
      message.error(t('workbench.settings.licensePane.removeFailed', { message: (err as Error).message }));
    }
  };

  const licensed = snapshot !== null && snapshot.status !== 'unlicensed' && snapshot.status !== 'invalid';
  const upgradeCtaHost = getCurrentHost() === 'desktop';

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

      {snapshot === null ? null : (
        <>
          {snapshot.status === 'unlicensed' && (
            <Alert
              type="info"
              showIcon
              message={<span style={{ fontSize: 12 }}>{t('workbench.settings.licensePane.freeTier.title')}</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  {t('workbench.settings.licensePane.freeTier.body', { limit: FREE_SEAT_LIMIT })}
                </span>
              }
              action={
                upgradeCtaHost ? (
                  <UpgradeCta surface="license-pane" label={t('workbench.settings.licensePane.getLicenseCta')} />
                ) : undefined
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {snapshot.status === 'invalid' && (
            <Alert
              type="error"
              showIcon
              message={<span style={{ fontSize: 12 }}>{t('workbench.settings.licensePane.invalidAlert.title')}</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  {t(INVALID_REASON_TEXT[snapshot.reason])}{' '}
                  {t('workbench.settings.licensePane.invalidAlert.body', { limit: FREE_SEAT_LIMIT })}
                </span>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {snapshot.status === 'grace' && (
            <Alert
              type="warning"
              showIcon
              message={<span style={{ fontSize: 12 }}>{t('workbench.settings.licensePane.grace.title')}</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  {t('workbench.settings.licensePane.grace.body', {
                    expiredOn: formatDay(snapshot.validUntil),
                    graceEndsOn: formatDay(snapshot.graceEndsAt),
                    limit: FREE_SEAT_LIMIT,
                  })}
                </span>
              }
              action={
                upgradeCtaHost ? (
                  <UpgradeCta surface="grace-banner" label={t('workbench.settings.licensePane.renewLicenseCta')} />
                ) : undefined
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {snapshot.status === 'expired' && (
            <Alert
              type="error"
              showIcon
              message={<span style={{ fontSize: 12 }}>{t('workbench.settings.licensePane.expired.title')}</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  {t('workbench.settings.licensePane.expired.body', { limit: FREE_SEAT_LIMIT })}
                </span>
              }
              action={
                upgradeCtaHost ? (
                  <UpgradeCta surface="grace-banner" label={t('workbench.settings.licensePane.renewLicenseCta')} />
                ) : undefined
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {licensed && (
            <section style={{ marginBottom: 14 }}>
              <div className="settings-card" style={{ padding: '8px 14px' }}>
                <DetailRow label={t('workbench.settings.licensePane.detail.licensedTo')}>
                  {snapshot.licensee.name}
                  {snapshot.licensee.org ? ` — ${snapshot.licensee.org}` : ''}
                </DetailRow>
                {snapshot.licensee.email && (
                  <DetailRow label={t('workbench.settings.licensePane.detail.contact')}>
                    {snapshot.licensee.email}
                  </DetailRow>
                )}
                <DetailRow label={t('workbench.settings.licensePane.detail.seats')}>{snapshot.seats}</DetailRow>
                <DetailRow label={t('workbench.settings.licensePane.detail.validUntil')}>
                  {formatDay(snapshot.validUntil)}
                  {snapshot.status === 'licensed' && (
                    <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>
                      {t('workbench.settings.licensePane.tag.active')}
                    </Tag>
                  )}
                  {snapshot.offline && (
                    <Tag style={{ marginLeft: 8, fontSize: 11 }}>{t('workbench.settings.licensePane.tag.offline')}</Tag>
                  )}
                </DetailRow>
                <DetailRow label={t('workbench.settings.licensePane.detail.licenseId')}>
                  <span style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5 }}>{snapshot.licenseId}</span>
                </DetailRow>
                <div style={{ padding: '8px 0 4px' }}>
                  <Popconfirm
                    title={t('workbench.settings.licensePane.removeConfirm.title')}
                    description={t('workbench.settings.licensePane.removeConfirm.body', { limit: FREE_SEAT_LIMIT })}
                    okText={t('workbench.settings.licensePane.removeConfirm.ok')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void remove()}
                  >
                    <Button danger size="small">
                      {t('workbench.settings.licensePane.removeButton')}
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="settings-card" style={{ padding: '10px 14px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 6 }}>
                {licensed
                  ? t('workbench.settings.licensePane.replaceTitle')
                  : t('workbench.settings.licensePane.installTitle')}
              </div>
              <Input.TextArea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setInstallError(null);
                }}
                placeholder={t('workbench.settings.licensePane.pastePlaceholder')}
                autoSize={{ minRows: 3, maxRows: 6 }}
                style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5 }}
              />
              {installError && (
                <div style={{ marginTop: 6, fontSize: 12, color: token.colorError }}>{installError}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  loading={installing}
                  disabled={draft.trim() === ''}
                  onClick={() => void install(draft)}
                >
                  {t('workbench.settings.licensePane.installButton')}
                </Button>
                <Upload
                  accept=".key,.txt,text/plain"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void file.text().then((text) => {
                      setDraft(text.trim());
                      setInstallError(null);
                    });
                    return false;
                  }}
                >
                  <Button size="small">{t('workbench.settings.licensePane.loadFromFile')}</Button>
                </Upload>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default LicensePane;
