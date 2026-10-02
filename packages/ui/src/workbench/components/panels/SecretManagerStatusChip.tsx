/**
 * SecretManagerStatusChip — the vault secret-manager row's L4 honest
 * affordance: is the CONNECTION this row resolves through usable on
 * the device that would resolve it, and if not, why not.
 *
 * Probes through the secret-manager client. Hosts without a provider
 * (browser surfaces — resolution is companion-side) render the honest
 * "not available on this device" state, which is exactly what a
 * resolve attempt would enforce; a row naming no connection says so.
 */

import type { SecretProviderProbe, SecretProviderUnavailableReason } from '@openheaders/core/secret-providers';
import type { SecretProviderId } from '@openheaders/core/types';
import { type Translate, useLocale } from '@openheaders/ui/context/LocaleContext';
import { formatAgo } from '@openheaders/ui/shared/awareness';
import { useSecretManagerProbe } from '@openheaders/ui/shared/secret-manager';
import type { MessageKey } from '@openheaders/i18n';
import { Tag, Tooltip } from 'antd';
import type React from 'react';

// ── Secret-manager label catalogs ──────────────────────────────────
// Explicit key maps (never computed template keys) so the message-key
// union stays typecheckable — same idiom as the conflict adapters. One
// place for the row editor, the settings list and the chip.

export const SM_PROVIDER_LABEL: Record<SecretProviderId, MessageKey> = {
  onepassword: 'workbench.variables.table.smProvider.onepassword',
  bitwarden: 'workbench.variables.table.smProvider.bitwarden',
  oskeychain: 'workbench.variables.table.smProvider.oskeychain',
  awssm: 'workbench.variables.table.smProvider.awssm',
  azurekv: 'workbench.variables.table.smProvider.azurekv',
  hashivault: 'workbench.variables.table.smProvider.hashivault',
};

/** One label per locator / connection field across the editor, the
 *  settings list and the conflict surfaces. */
export const SM_FIELD_LABEL: Record<string, MessageKey> = {
  vault: 'workbench.variables.table.smField.vault',
  item: 'workbench.variables.table.smField.item',
  field: 'workbench.variables.table.smField.field',
  account: 'workbench.variables.table.smField.account',
  auth: 'workbench.variables.table.smField.auth',
  secretId: 'workbench.variables.table.smField.secretId',
  service: 'workbench.variables.table.smField.service',
  name: 'workbench.variables.table.smField.name',
  stage: 'workbench.variables.table.smField.stage',
  region: 'workbench.variables.table.smField.region',
  profile: 'workbench.variables.table.smField.profile',
  vaultUrl: 'workbench.variables.table.smField.vaultUrl',
  version: 'workbench.variables.table.smField.version',
  mount: 'workbench.variables.table.smField.mount',
  path: 'workbench.variables.table.smField.path',
  key: 'workbench.variables.table.smField.key',
  serverUrl: 'workbench.variables.table.smField.serverUrl',
  namespace: 'workbench.variables.table.smField.namespace',
  authMethod: 'workbench.variables.table.smField.authMethod',
};

export const REASON_LABEL: Record<SecretProviderUnavailableReason, MessageKey> = {
  'not-installed': 'workbench.variables.table.smStatus.notInstalled',
  'integration-disabled': 'workbench.variables.table.smStatus.integrationDisabled',
  'no-credentials': 'workbench.variables.table.smStatus.noCredentials',
  locked: 'workbench.variables.table.smStatus.locked',
  denied: 'workbench.variables.table.smStatus.denied',
  unreachable: 'workbench.variables.table.smStatus.unreachable',
  'broker-unreachable': 'workbench.variables.table.smStatus.brokerUnreachable',
};

/**
 * Provider-keyed guidance for a standing state the vendor reports
 * opaquely — the fix named beside the raw detail (L4). The flagship
 * app answers one bare code both when its integration toggle is off
 * and when the account name is unknown to it, so the guidance names
 * both checks rather than guessing one.
 */
const STATUS_GUIDANCE: Partial<Record<SecretProviderId, Partial<Record<SecretProviderUnavailableReason, MessageKey>>>> =
  {
    onepassword: { unreachable: 'workbench.variables.table.smStatus.guidance.onepassword.unreachable' },
  };

/** What a connected reading means for the vendor's own session policy
 *  — the window after which the next use prompts again. */
const CONNECTED_GUIDANCE: Partial<Record<SecretProviderId, MessageKey>> = {
  onepassword: 'workbench.variables.table.smStatus.guidance.onepassword.connected',
};

type AvailableProbe = Extract<SecretProviderProbe, { available: true }>;

/**
 * The positive probe's reading. A connection whose last contact
 * succeeded and whose session the provider still holds reads
 * "Connected · 2m ago" — a past fact with its age, never a live claim
 * about a session the vendor owns; one never contacted since the
 * provider started reads "Not tested", and the Test beside it is the
 * next gesture.
 */
export function secretAvailableLabel(t: Translate, locale: string, probe: AvailableProbe): string {
  if (probe.verifiedAt === undefined) return t('workbench.variables.table.smStatus.notTested');
  return `${t('workbench.variables.table.smStatus.connected')} · ${formatAgo(Date.now() - probe.verifiedAt, locale)}`;
}

/** Green once a contact succeeded; the untested reading stays neutral. */
export function secretAvailableTone(probe: AvailableProbe): 'success' | 'default' {
  return probe.verifiedAt === undefined ? 'default' : 'success';
}

/** The tooltip behind a connected reading: the moment, then the
 *  vendor's session policy when one is known; `null` while untested. */
export function secretAvailableTooltip(
  t: Translate,
  locale: string,
  provider: SecretProviderId,
  probe: AvailableProbe,
): React.ReactNode {
  if (probe.verifiedAt === undefined) return null;
  const time = new Date(probe.verifiedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const guidance = CONNECTED_GUIDANCE[provider];
  return (
    <>
      <div>{t('workbench.variables.table.smStatus.connectedDetail', { time })}</div>
      {guidance !== undefined && <div>{t(guidance)}</div>}
    </>
  );
}

export function secretStatusGuidance(
  provider: SecretProviderId,
  reason: SecretProviderUnavailableReason | undefined,
): MessageKey | null {
  return reason === undefined ? null : (STATUS_GUIDANCE[provider]?.[reason] ?? null);
}

/** The tooltip behind an unavailable state: the vendor's detail, then
 *  the guidance when one exists; `null` when neither is there. */
export function secretStatusTooltip(
  t: Translate,
  provider: SecretProviderId,
  probe: Extract<SecretProviderProbe, { available: false }>,
): React.ReactNode {
  const guidance = secretStatusGuidance(provider, probe.reason);
  if (probe.detail === undefined && guidance === null) return null;
  return (
    <>
      {probe.detail !== undefined && <div>{probe.detail}</div>}
      {guidance !== null && <div>{t(guidance)}</div>}
    </>
  );
}

interface SecretManagerStatusChipProps {
  /** The row's connection; blank = none picked yet. */
  connectionId: string;
  /** The row's provider — keys the guidance a standing state may carry. */
  provider: SecretProviderId;
}

const SecretManagerStatusChip: React.FC<SecretManagerStatusChipProps> = ({ connectionId, provider }) => {
  const { t, locale } = useLocale();
  const probe = useSecretManagerProbe(connectionId === '' ? null : connectionId);

  if (connectionId === '') {
    return (
      <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }} data-testid="vault-sm-status">
        {t('workbench.variables.table.smStatus.noConnection')}
      </Tag>
    );
  }
  // `null` while a probe is in flight — render nothing rather than a
  // state that may flip a beat later.
  if (probe === null) return null;

  if (probe.available) {
    const connected = (
      <Tag
        color={secretAvailableTone(probe)}
        style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}
        data-testid="vault-sm-status"
      >
        {secretAvailableLabel(t, locale, probe)}
      </Tag>
    );
    const detail = secretAvailableTooltip(t, locale, provider, probe);
    return detail !== null ? <Tooltip title={detail}>{connected}</Tooltip> : connected;
  }

  const label = t(REASON_LABEL[probe.reason]);
  const chip = (
    <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }} data-testid="vault-sm-status">
      {label}
    </Tag>
  );
  const tooltip = secretStatusTooltip(t, provider, probe);
  return tooltip !== null ? <Tooltip title={tooltip}>{chip}</Tooltip> : chip;
};

export default SecretManagerStatusChip;
