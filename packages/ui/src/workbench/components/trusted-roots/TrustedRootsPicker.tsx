/**
 * TrustedRootsPicker — the valueless, picker-shaped control that faces
 * the trust anchors a dial from this surface takes: the editing-scope
 * workspace's trusted certificates and this device's pins. Shared by
 * the per-request Settings TLS rows and the global Settings › API
 * Requests row, so every door shows one face: the counts ("N from this
 * workspace" / "None from this workspace", "· M on this device" when
 * any), a read-only grouped list in the popup (name · subject, nothing
 * selectable) or the empty line, and the footer link into Settings ›
 * API Requests › TLS where both lists are edited. Never a knob — trust
 * is applied to every TLS dial (the locked law).
 *
 * On a non-node host the control is disabled with the "Browser store"
 * face; the hosting row owns the honest caption beneath it.
 */

import type { DeviceTrustedCertificate, TrustedRoot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isNodeRequestRuntime, useDeviceTrust } from '@openheaders/ui/shared/device-trust';
import { useTrustedRoots } from '@openheaders/ui/shared/hooks/readers/useTrustedRoots';
import { CONTROL_WIDTH } from '@openheaders/ui/shared/settings-rows';
import { Button, ConfigProvider, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { useOpenSettings } from '../../hooks/OpenSettingsContext';
import { useCertificateSummary } from './use-certificate-summary';

const { Text } = Typography;

/** The settings row both lists are edited on — the manage link's target. */
export const TRUSTED_ROOTS_SETTING_KEY = 'requests.trustedRoots';

export { isNodeRequestRuntime };

/** One read-only option: the certificate's name with its subject
 *  beneath — the subject derives from the PEM at read time, like the
 *  table row, so the popup shows the same identity without storing it. */
const CertificateOption: React.FC<{ certificate: TrustedRoot | DeviceTrustedCertificate }> = ({ certificate }) => {
  const state = useCertificateSummary(certificate.certPem);
  const subject = state.status === 'settled' && 'summary' in state.gate ? state.gate.summary.subject : undefined;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
      <span>{certificate.name}</span>
      {subject !== undefined && <span style={{ fontSize: 11, opacity: 0.75 }}>{subject}</span>}
    </span>
  );
};

const TrustedRootsPicker: React.FC<{
  ariaLabel: string;
  testId?: string;
}> = ({ ariaLabel, testId }) => {
  const t = useT();
  const { token } = theme.useToken();
  const nodeHost = isNodeRequestRuntime();
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const roots = useTrustedRoots(nodeHost ? workspaceId : null);
  const { certificates: pins } = useDeviceTrust();
  const openSettings = useOpenSettings();
  const [open, setOpen] = useState(false);
  const workspaceFace =
    roots.length === 0
      ? t('workbench.trustedRoots.settings.none')
      : t('workbench.trustedRoots.settings.count', { count: roots.length });
  const face = !nodeHost
    ? t('workbench.trustedRoots.settings.browserStore')
    : pins.length === 0
      ? workspaceFace
      : `${workspaceFace} · ${t('workbench.trustedRoots.settings.deviceCount', { count: pins.length })}`;
  const group = (label: string, list: ReadonlyArray<TrustedRoot | DeviceTrustedCertificate>) =>
    list.length === 0
      ? []
      : [
          {
            label,
            options: list.map((certificate) => ({
              value: certificate.uid,
              label: <CertificateOption certificate={certificate} />,
              disabled: true,
            })),
          },
        ];
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      <Select
        size="small"
        aria-label={ariaLabel}
        data-testid={testId}
        value={undefined}
        placeholder={face}
        disabled={!nodeHost}
        allowClear={false}
        showSearch={false}
        options={[
          ...group(t('workbench.trustedRoots.settings.groupWorkspace'), roots),
          ...group(t('workbench.trustedRoots.settings.groupDevice'), pins),
        ]}
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
            {openSettings !== null && (
              <div style={{ marginTop: 4, padding: '4px 4px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <Button
                  type="link"
                  size="small"
                  data-testid={testId === undefined ? undefined : `${testId}-manage`}
                  onClick={() => {
                    setOpen(false);
                    openSettings({ settingKey: TRUSTED_ROOTS_SETTING_KEY });
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
  );
};

export default TrustedRootsPicker;
