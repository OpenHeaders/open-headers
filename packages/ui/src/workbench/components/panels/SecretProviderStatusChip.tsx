/**
 * SecretProviderStatusChip — the vault secret-manager row's L4 honest
 * affordance: is this row's provider usable on the device that would
 * resolve it, and if not, why not.
 *
 * Probes through the `secretProviderProbe` capability. Hosts without it
 * (every host until their first provider ships, and browser surfaces
 * permanently — resolution is companion-side) render the honest
 * "not available on this device" state, which is exactly what a resolve
 * attempt would enforce.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { SecretProviderProbe, SecretProviderUnavailableReason } from '@openheaders/core/secret-providers';
import type { SecretProviderId } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { MessageKey } from '@openheaders/i18n';
import { Tag, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';

const REASON_LABEL: Record<SecretProviderUnavailableReason, MessageKey> = {
  'not-installed': 'workbench.variables.table.smStatus.notInstalled',
  'integration-disabled': 'workbench.variables.table.smStatus.integrationDisabled',
  'no-credentials': 'workbench.variables.table.smStatus.noCredentials',
  locked: 'workbench.variables.table.smStatus.locked',
  unreachable: 'workbench.variables.table.smStatus.unreachable',
};

interface SecretProviderStatusChipProps {
  provider: SecretProviderId;
}

const SecretProviderStatusChip: React.FC<SecretProviderStatusChipProps> = ({ provider }) => {
  const t = useT();
  // `null` while a probe is in flight — render nothing rather than a
  // state that may flip a beat later.
  const [probe, setProbe] = useState<SecretProviderProbe | null>(null);

  useEffect(() => {
    const cap = getCapability('secretProviderProbe');
    if (!cap) {
      setProbe({ available: false, reason: 'not-installed' });
      return;
    }
    let cancelled = false;
    setProbe(null);
    cap(provider).then(
      (result) => {
        if (!cancelled) setProbe(result);
      },
      () => {
        if (!cancelled) setProbe({ available: false, reason: 'unreachable' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provider]);

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

export default SecretProviderStatusChip;
