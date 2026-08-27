/**
 * TrustCertificateOffer — the node runtime's remedy for a verification
 * failure (`trust-certificate` hint), rendered under the response
 * error state. Probes the failed endpoint for the chain it presents
 * (a read-only dial, nothing sent), shows what a trust gesture would
 * pin — subject, issuer, validity, fingerprint, the verification code
 * — and offers the two scopes: pin the anchor on THIS device (the
 * self-signed localhost case, never synced) or add it to the workspace
 * (a private CA every peer should trust). Either commits on the
 * gesture and resends. A chain whose root the server never presents
 * cannot be pinned (the runtime needs an anchor that closes the
 * chain); the offer says so and points at Settings instead.
 */

import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { PresentedCertificateWire } from '@openheaders/core/bridge';
import type { TrustCertificateErrorHint } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  addDeviceTrustedCertificate,
  isNodeRequestRuntime,
  pinnableAnchorOf,
  useProbeServerCertificate,
} from '@openheaders/ui/shared/device-trust';
import { useTrustedRootsMutator } from '@openheaders/ui/shared/hooks/mutators/useTrustedRootsMutator';
import { App, Button, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../../hooks/EditingScopeWorkspaceContext';
import { useOpenSettings } from '../../../hooks/OpenSettingsContext';
import { formatFingerprint, subjectCommonName } from '../../trusted-roots/add-gate';
import { TRUSTED_ROOTS_SETTING_KEY } from '../../trusted-roots/TrustedRootsPicker';

const { Text } = Typography;

const SURFACE_ID = 'workbench';

interface TrustCertificateOfferProps {
  hint: TrustCertificateErrorHint;
  /** Resend the request after a trust gesture — the editor's Send. */
  onResend?: () => void;
}

const SummaryRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 8, fontSize: 12, textAlign: 'left' }}>
      <Text type="secondary">{label}</Text>
      <Text style={mono ? { fontFamily: token.fontFamilyCode, wordBreak: 'break-all' } : undefined}>{value}</Text>
    </div>
  );
};

const TrustCertificateOffer: React.FC<TrustCertificateOfferProps> = ({ hint, onResend }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const nodeHost = isNodeRequestRuntime();
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const openSettings = useOpenSettings();
  const { addRoot } = useTrustedRootsMutator({ workspaceId, surfaceId: SURFACE_ID });
  const target = nodeHost
    ? { host: hint.host, port: hint.port, ...(hint.servername !== undefined ? { servername: hint.servername } : {}) }
    : null;
  const { state, result, retry } = useProbeServerCertificate(target);
  const [busy, setBusy] = useState<'device' | 'workspace' | null>(null);

  const chain: PresentedCertificateWire[] = result?.ok ? result.chain : [];
  const leaf = chain[0];
  const anchor = pinnableAnchorOf(chain);
  const origin = `${hint.host}:${hint.port}`;
  const anchorName = anchor === null ? '' : subjectCommonName(anchor.summary.subject);

  const trustOnDevice = useCallback(async () => {
    if (anchor === null) return;
    setBusy('device');
    const added = await addDeviceTrustedCertificate({ certPem: anchor.pem, name: anchorName, origin });
    setBusy(null);
    if (!added.ok) {
      message.error(added.error);
      return;
    }
    onResend?.();
  }, [anchor, anchorName, origin, message, onResend]);

  const addToWorkspace = useCallback(async () => {
    if (anchor === null || !anchor.summary.isCa) return;
    setBusy('workspace');
    const added = await addRoot({ certPem: anchor.pem, name: anchorName });
    setBusy(null);
    if (!added.ok) {
      message.error(t('workbench.trustedRoots.saveFailed'));
      return;
    }
    onResend?.();
  }, [anchor, anchorName, addRoot, message, t, onResend]);

  return (
    <div
      data-testid="oh-trust-certificate-offer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginTop: 8,
        padding: 12,
        width: '100%',
        maxWidth: 520,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SafetyCertificateOutlined style={{ color: token.colorTextSecondary }} />
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.request.response.error.trust.title', { origin })}
        </Text>
      </div>
      {state === 'probing' && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.response.error.trust.probing')}
        </Text>
      )}
      {state === 'settled' && result !== null && !result.ok && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <Text type="secondary" style={{ fontSize: 12 }} data-testid="oh-trust-probe-failed">
            {t('workbench.editors.request.response.error.trust.probeFailed', { message: result.error })}
          </Text>
          <Button size="small" onClick={retry}>
            {t('workbench.editors.request.response.error.trust.retryProbe')}
          </Button>
        </div>
      )}
      {leaf !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="oh-trust-presented">
          <SummaryRow label={t('workbench.trustedRoots.add.summary.subject')} value={leaf.summary.subject} />
          <SummaryRow label={t('workbench.trustedRoots.add.summary.issuer')} value={leaf.summary.issuer} />
          <SummaryRow
            label={t('workbench.trustedRoots.add.summary.validUntil')}
            value={new Date(leaf.summary.notAfter).toLocaleString()}
          />
          <SummaryRow
            label={t('workbench.trustedRoots.add.summary.fingerprint')}
            value={formatFingerprint(leaf.summary.fingerprintSha256)}
            mono
          />
          <SummaryRow label={t('workbench.editors.request.response.error.trust.failure')} value={hint.code} mono />
        </div>
      )}
      {state === 'settled' && result?.ok && anchor === null && (
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="oh-trust-no-anchor">
          {t('workbench.editors.request.response.error.trust.noAnchor')}
        </Text>
      )}
      {state === 'settled' && result?.ok && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            size="small"
            disabled={anchor === null || busy !== null}
            loading={busy === 'device'}
            onClick={() => void trustOnDevice()}
            data-testid="oh-trust-on-device"
          >
            {t('workbench.editors.request.response.error.trust.trustOnDevice')}
          </Button>
          {anchor !== null && anchor.summary.isCa && workspaceId !== null && (
            <Button
              size="small"
              disabled={busy !== null}
              loading={busy === 'workspace'}
              onClick={() => void addToWorkspace()}
              data-testid="oh-trust-add-workspace"
            >
              {t('workbench.editors.request.response.error.trust.addToWorkspace')}
            </Button>
          )}
          {openSettings !== null && (
            <Button
              size="small"
              type="link"
              onClick={() => openSettings({ settingKey: TRUSTED_ROOTS_SETTING_KEY })}
              style={{ padding: '0 4px' }}
            >
              {t('workbench.trustedRoots.settings.manage')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default TrustCertificateOffer;
