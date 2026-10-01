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

import type { SecretProviderUnavailableReason } from '@openheaders/core/secret-providers';
import type { SecretProviderId } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
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
  unreachable: 'workbench.variables.table.smStatus.unreachable',
};

interface SecretManagerStatusChipProps {
  /** The row's connection; blank = none picked yet. */
  connectionId: string;
}

const SecretManagerStatusChip: React.FC<SecretManagerStatusChipProps> = ({ connectionId }) => {
  const t = useT();
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
    return (
      <Tag color="success" style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }} data-testid="vault-sm-status">
        {t('workbench.variables.table.smStatus.available')}
      </Tag>
    );
  }

  const label = t(REASON_LABEL[probe.reason]);
  const chip = (
    <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }} data-testid="vault-sm-status">
      {label}
    </Tag>
  );
  return probe.detail ? <Tooltip title={probe.detail}>{chip}</Tooltip> : chip;
};

export default SecretManagerStatusChip;
