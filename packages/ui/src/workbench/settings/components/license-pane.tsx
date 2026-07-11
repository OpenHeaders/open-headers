/**
 * LicensePane — right-pane renderer for the License category (desktop
 * + served web; the extension carries no license plumbing). Renders the
 * entitlement snapshot the host's license slot pushes (`licenseUpdated`)
 * and drives the `oh.daemon.license.*` admin RPCs. The UI renders state
 * and never gates — degradation itself lives in the seat gate
 * (LICENSING_PLAN.md §3.3/§4).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { FREE_SEAT_LIMIT, type LicenseInvalidReason, type LicenseSnapshot } from '@openheaders/core/licensing';
import { Alert, App as AntApp, Button, Input, Popconfirm, Tag, theme, Upload } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { CategoryPaneProps } from '../types';

const INVALID_REASON_TEXT: Record<LicenseInvalidReason, string> = {
  malformed: 'The installed file is not a license key.',
  'schema-mismatch': 'The installed license does not match any schema this version supports.',
  'unknown-kid': 'The installed license is signed with a key this build does not trust.',
  'bad-signature': 'The installed license failed signature verification — the text was altered after signing.',
};

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

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
        message.success('License installed');
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
      message.success('License removed — back on the free tier');
    } catch (err) {
      message.error(`Failed to remove license: ${(err as Error).message}`);
    }
  };

  const licensed = snapshot !== null && snapshot.status !== 'unlicensed' && snapshot.status !== 'invalid';

  return (
    <div style={{ padding: '14px 18px 20px', maxWidth: 760 }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.label}
        </h2>
        {category.description && (
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>{category.description}</p>
        )}
      </header>

      {snapshot === null ? null : (
        <>
          {snapshot.status === 'unlicensed' && (
            <Alert
              type="info"
              showIcon
              message={<span style={{ fontSize: 12 }}>Free tier</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  Every feature is included — the free tier admits up to {FREE_SEAT_LIMIT} active users per daemon.
                  Install a license key to raise the seat limit.
                </span>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {snapshot.status === 'invalid' && (
            <Alert
              type="error"
              showIcon
              message={<span style={{ fontSize: 12 }}>Installed license is not usable</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  {INVALID_REASON_TEXT[snapshot.reason]} The app keeps running on the free tier (up to{' '}
                  {FREE_SEAT_LIMIT} active users). Paste a fresh key below or contact support.
                </span>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {snapshot.status === 'grace' && (
            <Alert
              type="warning"
              showIcon
              message={<span style={{ fontSize: 12 }}>License expired — grace period active</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  This license expired on {formatDay(snapshot.validUntil)}. Renew before{' '}
                  {formatDay(snapshot.graceEndsAt)} — after that, creating or reactivating users falls back to the
                  free limit of {FREE_SEAT_LIMIT}. Existing users keep logging in and no data is ever affected.
                </span>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {snapshot.status === 'expired' && (
            <Alert
              type="error"
              showIcon
              message={<span style={{ fontSize: 12 }}>License and grace period have ended</span>}
              description={
                <span style={{ fontSize: 12 }}>
                  New user creation and reactivation now follow the free limit of {FREE_SEAT_LIMIT} active users.
                  Existing users keep logging in, existing workspaces keep working, and no data is ever affected.
                  Install a renewed key to restore the licensed seat count.
                </span>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {licensed && (
            <section style={{ marginBottom: 14 }}>
              <div className="settings-card" style={{ padding: '8px 14px' }}>
                <DetailRow label="Licensed to">
                  {snapshot.licensee.name}
                  {snapshot.licensee.org ? ` — ${snapshot.licensee.org}` : ''}
                </DetailRow>
                {snapshot.licensee.email && <DetailRow label="Contact">{snapshot.licensee.email}</DetailRow>}
                <DetailRow label="Seats">{snapshot.seats}</DetailRow>
                <DetailRow label="Valid until">
                  {formatDay(snapshot.validUntil)}
                  {snapshot.status === 'licensed' && (
                    <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>
                      Active
                    </Tag>
                  )}
                  {snapshot.offline && (
                    <Tag style={{ marginLeft: 8, fontSize: 11 }}>Offline license</Tag>
                  )}
                </DetailRow>
                <DetailRow label="License id">
                  <span style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5 }}>{snapshot.licenseId}</span>
                </DetailRow>
                <div style={{ padding: '8px 0 4px' }}>
                  <Popconfirm
                    title="Remove this license?"
                    description={`The app reverts to the free tier (up to ${FREE_SEAT_LIMIT} active users). No data is affected.`}
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void remove()}
                  >
                    <Button danger size="small">
                      Remove license
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="settings-card" style={{ padding: '10px 14px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 6 }}>
                {licensed ? 'Replace license' : 'Install a license'}
              </div>
              <Input.TextArea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setInstallError(null);
                }}
                placeholder="Paste your license key (oh-license.…)"
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
                  Install
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
                  <Button size="small">Load from file…</Button>
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
