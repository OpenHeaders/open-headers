/**
 * TrustedRootsSettingsRow — the read-only trusted-certificates row
 * under the verify switch of every request-editor Settings TLS group
 * (HTTP, WS, gRPC, MQTT). Same `label · (i) · control` geometry as the
 * client-certificate picker beneath it; the control is the shared
 * {@link TrustedRootsPicker} (count face, unsaved suffix, read-only
 * list, manage link). Never a knob, so it carries no dot, no reset,
 * and contributes to no tab dot.
 *
 * On a non-node host the control is disabled and the caption beneath
 * states the honest note: the browser dials with its own trust store
 * and the extension cannot apply workspace roots there.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { ResetSlot } from '@openheaders/ui/shared/settings-rows';
import { Typography } from 'antd';
import type React from 'react';
import TrustedRootsPicker, { isNodeRequestRuntime } from './TrustedRootsPicker';

const { Text } = Typography;

const TrustedRootsSettingsRow: React.FC<{
  /** Kicker on the (i) popover — the hosting group's label. */
  kicker: string;
  testId?: string;
}> = ({ kicker, testId }) => {
  const t = useT();
  const nodeHost = isNodeRequestRuntime();
  const label = t('workbench.trustedRoots.settings.label');
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="rules-settings-row"
        data-testid={testId}
        style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}
      >
        <Text style={{ fontSize: 13 }}>{label}</Text>
        <InfoTrigger content={{ title: label, kicker, summary: t('workbench.trustedRoots.settings.help') }} />
        <span style={{ flex: 1 }} />
        <TrustedRootsPicker ariaLabel={label} testId={testId === undefined ? undefined : `${testId}-select`} />
        <ResetSlot />
      </div>
      {!nodeHost && (
        <Text type="secondary" style={{ fontSize: 11, marginBottom: 4 }}>
          {t('workbench.trustedRoots.settings.browserNote')}
        </Text>
      )}
    </div>
  );
};

export default TrustedRootsSettingsRow;
