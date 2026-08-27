/**
 * TrustedRootsSettingsRow — the read-only trusted-certificates line
 * under the verify switch of every Settings TLS group (HTTP, WS,
 * gRPC, MQTT). `label · (i) · value · Manage`: the value counts the
 * editing-scope workspace's roots ("N from this workspace" / "None
 * from this workspace") and the link opens the editor through
 * {@link OpenTrustedRootsContext} — never a knob (trust is workspace
 * data, applied to every TLS dial; the locked law), so it carries no
 * dot, no reset, and contributes to no tab dot.
 *
 * On a non-node host the value states the honest note instead: the
 * browser dials with its own trust store and the extension cannot
 * apply workspace roots there — no count, no link.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTrustedRoots } from '@openheaders/ui/shared/hooks/readers/useTrustedRoots';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { useOpenTrustedRoots } from '../../hooks/OpenTrustedRootsContext';

const { Text } = Typography;

const TrustedRootsSettingsRow: React.FC<{
  /** Kicker on the (i) popover — the hosting group's label. */
  kicker: string;
  testId?: string;
}> = ({ kicker, testId }) => {
  const t = useT();
  const { token } = theme.useToken();
  const nodeHost = getCapability('requestRuntime')?.() === 'node';
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const count = useTrustedRoots(nodeHost ? workspaceId : null).length;
  const openTrustedRoots = useOpenTrustedRoots();
  const label = t('workbench.trustedRoots.settings.label');
  const value = !nodeHost
    ? t('workbench.trustedRoots.settings.browserNote')
    : count === 0
      ? t('workbench.trustedRoots.settings.none')
      : t('workbench.trustedRoots.settings.count', { count });
  return (
    <div
      className="rules-settings-row"
      data-testid={testId}
      style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}
    >
      <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</Text>
      <InfoTrigger content={{ title: label, kicker, summary: t('workbench.trustedRoots.settings.help') }} />
      <span style={{ flex: 1 }} />
      <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>{value}</Text>
      {nodeHost && openTrustedRoots !== null && (
        <Button
          type="link"
          size="small"
          data-testid={testId === undefined ? undefined : `${testId}-manage`}
          onClick={openTrustedRoots}
          style={{ padding: '0 4px', fontSize: 12, height: 'auto' }}
        >
          {t('workbench.trustedRoots.settings.manage')}
        </Button>
      )}
    </div>
  );
};

export default TrustedRootsSettingsRow;
