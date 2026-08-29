/**
 * TlsTrustGroup — the TLS & trust block every request editor's
 * Settings tab renders (HTTP, WebSocket / Socket.IO, gRPC, MQTT): ONE
 * component for the one policy the request kinds share, so the rows,
 * their order, their validation and their dots never drift between
 * editors again.
 *
 *   SSL certificate verification · Trusted certificates · Client
 *   certificate · TLS version minimum · TLS version maximum · TLS
 *   cipher suites · SNI server name · [the host's own rows]
 *
 * The block edits a `TlsTrustValue` and hands the WHOLE next value
 * back — the host merges it into its draft (the session drafts keep
 * `sslVerification` concrete: absent reads as verify-on). Modified
 * dots track distance from the runtime defaults; the optional
 * `unsaved` set (the HTTP tab's saved-baseline plane) adds the
 * unsaved marker per row and on the group header. Labels, placeholders
 * and warnings come from the request-settings catalog; an editor with
 * richer popover copy passes `rowInfo` and falls back to the shared
 * copy for the keys it leaves undefined. Protocol-only rows (MQTT's
 * ALPN offer) render as children after the shared rows.
 */

import {
  MAX_SNI_SERVER_NAME_LENGTH,
  MAX_TLS_CIPHER_SUITES_LENGTH,
  TLS_CIPHER_SUITES_PATTERN,
  TLS_VERSIONS,
} from '@openheaders/core/schemas';
import type { TlsVersion } from '@openheaders/core/types';
import { useVaultContext } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { GroupSection, KnobRow, SelectKnobRow, TextKnobRow } from '@openheaders/ui/shared/settings-rows';
import { Typography } from 'antd';
import type React from 'react';
import TrustedRootsSettingsRow from '../../trusted-roots/TrustedRootsSettingsRow';
import VaultSelectFooter from '../../variables/VaultSelectFooter';
import { type TlsTrustInfoKey, tlsTrustRowInfo } from './tls-trust-row-info';

const { Text } = Typography;

/** The policy slice the block edits — every key optional, `undefined`
 *  = the runtime default (verification on, no certificate, the
 *  runtime's version window and suites, the URL host as SNI). */
export interface TlsTrustValue {
  sslVerification?: boolean | undefined;
  clientCertificateRef?: string | undefined;
  tlsMinVersion?: TlsVersion | undefined;
  tlsMaxVersion?: TlsVersion | undefined;
  tlsCipherSuites?: string | undefined;
  sniServerName?: string | undefined;
}

export const TLS_TRUST_KEYS = [
  'sslVerification',
  'clientCertificateRef',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
] as const;

export type TlsTrustKey = (typeof TLS_TRUST_KEYS)[number];

/** Whether any row sits off its runtime default. */
export function isTlsTrustModified(value: TlsTrustValue): boolean {
  return (
    value.sslVerification === false ||
    value.clientCertificateRef !== undefined ||
    value.tlsMinVersion !== undefined ||
    value.tlsMaxVersion !== undefined ||
    value.tlsCipherSuites !== undefined ||
    value.sniServerName !== undefined
  );
}

/** Position of a version token in the ordered {@link TLS_VERSIONS}
 *  list — the min/max cross-disable compares ranks, never strings. */
const tlsVersionRank = (version: TlsVersion): number => TLS_VERSIONS.indexOf(version);

export interface TlsTrustGroupProps {
  groupLabel: string;
  groupInfo: InfoPopoverContent;
  expanded: boolean;
  onToggle: () => void;
  value: TlsTrustValue;
  /** The whole next value — the host merges it into its own draft. */
  onChange: (next: TlsTrustValue) => void;
  /** Editor-specific popover copy; `undefined` for a key falls back
   *  to the shared request-settings copy. */
  rowInfo?: (key: TlsTrustInfoKey) => InfoPopoverContent | undefined;
  /** Keys whose value differs from the saved baseline (the HTTP tab's
   *  unsaved plane); absent = no such plane. */
  unsaved?: ReadonlySet<string>;
  /** `<prefix>-ssl-verify`, `<prefix>-trusted-roots`, … */
  testIdPrefix: string;
  /** Protocol-only rows, rendered after the shared ones. */
  children?: React.ReactNode;
}

const TlsTrustGroup: React.FC<TlsTrustGroupProps> = ({
  groupLabel,
  groupInfo,
  expanded,
  onToggle,
  value,
  onChange,
  rowInfo,
  unsaved,
  testIdPrefix,
  children,
}) => {
  const t = useT();
  const info = (key: TlsTrustInfoKey): InfoPopoverContent => rowInfo?.(key) ?? tlsTrustRowInfo(t, key, groupLabel);
  const isUnsaved = (key: TlsTrustKey): boolean => unsaved?.has(key) === true;
  // The client-certificate knob picks over THIS device's vault entries
  // by name — the request stores the name, each device resolves its
  // own entry; a ref with no entry here warns in place. The context
  // defaults to an empty vault when no provider is mounted, so the
  // block stays renderable everywhere.
  const { vault } = useVaultContext();
  const clientCertificateOptions = vault.secrets
    .filter((s) => s.kind === 'client-certificate')
    .map((s) => ({ value: s.name, label: s.name }));
  const clientCertificateRefDangling =
    value.clientCertificateRef !== undefined &&
    !clientCertificateOptions.some((o) => o.value === value.clientCertificateRef);
  const set = (patch: TlsTrustValue): void => onChange({ ...value, ...patch });

  return (
    <GroupSection
      label={groupLabel}
      expanded={expanded}
      onToggle={onToggle}
      info={groupInfo}
      modified={isTlsTrustModified(value)}
      unsaved={TLS_TRUST_KEYS.some(isUnsaved)}
    >
      <KnobRow
        label={t('workbench.editors.request.settings.sslVerification')}
        checked={value.sslVerification !== false}
        modified={value.sslVerification === false}
        unsaved={isUnsaved('sslVerification')}
        onReset={() => set({ sslVerification: undefined })}
        onChange={(checked) => set({ sslVerification: checked })}
        info={info('sslVerification')}
        warning={t('workbench.editors.request.settings.sslVerificationWarning')}
        testId={`${testIdPrefix}-ssl-verify`}
      />
      <TrustedRootsSettingsRow kicker={groupLabel} testId={`${testIdPrefix}-trusted-roots`} />
      <SelectKnobRow
        label={t('workbench.editors.request.settings.clientCertificate')}
        value={value.clientCertificateRef}
        onChange={(clientCertificateRef) => set({ clientCertificateRef })}
        info={info('clientCertificate')}
        options={clientCertificateOptions}
        placeholder={t('workbench.editors.request.settings.clientCertificatePlaceholder')}
        searchable
        notFoundContent={
          <Text type="secondary" style={{ fontSize: 12, padding: '6px 8px' }}>
            {t('workbench.editors.request.settings.clientCertificateEmpty')}
          </Text>
        }
        popupFooter={(close) => (
          <VaultSelectFooter
            label={t('workbench.editors.request.settings.vaultManageCertificates')}
            testId={`${testIdPrefix}-client-certificate-manage`}
            onNavigate={close}
          />
        )}
        modified={value.clientCertificateRef !== undefined}
        unsaved={isUnsaved('clientCertificateRef')}
        warning={
          clientCertificateRefDangling
            ? t('workbench.editors.request.settings.clientCertificateDangling', {
                name: value.clientCertificateRef ?? '',
              })
            : undefined
        }
        testId={`${testIdPrefix}-client-certificate`}
      />
      <SelectKnobRow
        label={t('workbench.editors.request.settings.tlsMin')}
        value={value.tlsMinVersion}
        onChange={(v) => set({ tlsMinVersion: v as TlsVersion | undefined })}
        info={info('tlsMin')}
        options={TLS_VERSIONS.map((v) => ({
          value: v,
          label: v,
          disabled: value.tlsMaxVersion !== undefined && tlsVersionRank(v) > tlsVersionRank(value.tlsMaxVersion),
        }))}
        placeholder={t('workbench.editors.request.settings.tlsMinPlaceholder')}
        modified={value.tlsMinVersion !== undefined}
        unsaved={isUnsaved('tlsMinVersion')}
        warning={
          value.tlsMinVersion === '1.0' || value.tlsMinVersion === '1.1'
            ? t('workbench.editors.request.settings.tlsMinWarning')
            : undefined
        }
        testId={`${testIdPrefix}-tls-min`}
      />
      <SelectKnobRow
        label={t('workbench.editors.request.settings.tlsMax')}
        value={value.tlsMaxVersion}
        onChange={(v) => set({ tlsMaxVersion: v as TlsVersion | undefined })}
        info={info('tlsMax')}
        options={TLS_VERSIONS.map((v) => ({
          value: v,
          label: v,
          disabled: value.tlsMinVersion !== undefined && tlsVersionRank(v) < tlsVersionRank(value.tlsMinVersion),
        }))}
        placeholder={t('workbench.editors.request.settings.tlsMaxPlaceholder')}
        modified={value.tlsMaxVersion !== undefined}
        unsaved={isUnsaved('tlsMaxVersion')}
        testId={`${testIdPrefix}-tls-max`}
      />
      <TextKnobRow
        label={t('workbench.editors.request.settings.tlsCipherSuites')}
        value={value.tlsCipherSuites}
        onChange={(tlsCipherSuites) => set({ tlsCipherSuites })}
        info={info('tlsCipherSuites')}
        placeholder={t('workbench.editors.request.settings.tlsCipherSuitesPlaceholder')}
        maxLength={MAX_TLS_CIPHER_SUITES_LENGTH}
        error={
          value.tlsCipherSuites !== undefined && !TLS_CIPHER_SUITES_PATTERN.test(value.tlsCipherSuites)
            ? t('workbench.editors.request.settings.tlsCipherSuitesError')
            : undefined
        }
        example={t('workbench.editors.request.settings.tlsCipherSuitesExample')}
        unsaved={isUnsaved('tlsCipherSuites')}
        testId={`${testIdPrefix}-tls-cipher-suites`}
      />
      <TextKnobRow
        label={t('workbench.editors.request.settings.sni')}
        value={value.sniServerName}
        onChange={(sniServerName) => set({ sniServerName })}
        info={info('sni')}
        placeholder={t('workbench.editors.request.settings.sniPlaceholder')}
        maxLength={MAX_SNI_SERVER_NAME_LENGTH}
        example={t('workbench.editors.request.settings.sniExample')}
        unsaved={isUnsaved('sniServerName')}
        testId={`${testIdPrefix}-sni-server-name`}
      />
      {children}
    </GroupSection>
  );
};

export default TlsTrustGroup;
