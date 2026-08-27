/**
 * TrustedRootsSettingsRow — the read-only trusted-certificates row
 * under the verify switch of every Settings TLS group (HTTP, WS,
 * gRPC, MQTT). Same `label · (i) · control` geometry as the client-
 * certificate picker beneath it, but the control never holds a value:
 * its face counts the editing-scope workspace's roots ("N from this
 * workspace" / "None from this workspace"), its popup lists them
 * read-only (name · subject, nothing selectable) or states the empty
 * line, and its footer opens the editor through
 * {@link OpenTrustedRootsContext}. Never a knob (trust is workspace
 * data, applied to every TLS dial; the locked law), so it carries no
 * dot, no reset, and contributes to no tab dot.
 *
 * On a non-node host the control is disabled and the caption beneath
 * states the honest note: the browser dials with its own trust store
 * and the extension cannot apply workspace roots there — no count, no
 * list, no link.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { TrustedRoot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTrustedRoots } from '@openheaders/ui/shared/hooks/readers/useTrustedRoots';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { CONTROL_WIDTH, ResetSlot } from '@openheaders/ui/shared/settings-rows';
import { Button, ConfigProvider, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { useOpenTrustedRoots } from '../../hooks/OpenTrustedRootsContext';
import { useCertificateSummary } from './use-certificate-summary';

const { Text } = Typography;

/** One read-only option: the root's name with its subject beneath —
 *  the subject derives from the PEM at read time, like the editor
 *  row, so the popup shows the same identity without storing it. */
const TrustedRootOption: React.FC<{ root: TrustedRoot }> = ({ root }) => {
  const state = useCertificateSummary(root.certPem);
  const subject = state.status === 'settled' && state.gate.ok ? state.gate.summary.subject : undefined;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
      <span>{root.name}</span>
      {subject !== undefined && <span style={{ fontSize: 11, opacity: 0.75 }}>{subject}</span>}
    </span>
  );
};

const TrustedRootsSettingsRow: React.FC<{
  /** Kicker on the (i) popover — the hosting group's label. */
  kicker: string;
  testId?: string;
}> = ({ kicker, testId }) => {
  const t = useT();
  const { token } = theme.useToken();
  const nodeHost = getCapability('requestRuntime')?.() === 'node';
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const roots = useTrustedRoots(nodeHost ? workspaceId : null);
  const openTrustedRoots = useOpenTrustedRoots();
  const [open, setOpen] = useState(false);
  const label = t('workbench.trustedRoots.settings.label');
  const face = !nodeHost
    ? t('workbench.trustedRoots.settings.browserStore')
    : roots.length === 0
      ? t('workbench.trustedRoots.settings.none')
      : t('workbench.trustedRoots.settings.count', { count: roots.length });
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
        <ConfigProvider theme={{ token: { motion: false } }}>
          <Select
            size="small"
            aria-label={label}
            data-testid={testId === undefined ? undefined : `${testId}-select`}
            value={undefined}
            placeholder={face}
            disabled={!nodeHost}
            allowClear={false}
            showSearch={false}
            options={roots.map((root) => ({
              value: root.uid,
              label: <TrustedRootOption root={root} />,
              disabled: true,
            }))}
            popupMatchSelectWidth={false}
            notFoundContent={
              <Text type="secondary" style={{ fontSize: 12, padding: '6px 8px' }}>
                {t('workbench.trustedRoots.settings.empty')}
              </Text>
            }
            open={open}
            onOpenChange={setOpen}
            popupRender={(menu) => (
              <>
                {menu}
                {openTrustedRoots !== null && (
                  <div
                    style={{ marginTop: 4, padding: '4px 4px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}
                  >
                    <Button
                      type="link"
                      size="small"
                      data-testid={testId === undefined ? undefined : `${testId}-manage`}
                      onClick={() => {
                        setOpen(false);
                        openTrustedRoots();
                      }}
                      style={{ padding: '0 8px', fontSize: 12 }}
                    >
                      {t('workbench.trustedRoots.settings.manage')}
                    </Button>
                  </div>
                )}
              </>
            )}
            style={{ width: CONTROL_WIDTH }}
          />
        </ConfigProvider>
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
