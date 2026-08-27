/**
 * TrustedRootsPicker — the valueless, picker-shaped control that faces
 * the editing-scope workspace's trusted certificates. Shared by the
 * per-request Settings TLS rows and the global Settings › API Requests
 * row, so the two doors show one face: the CANONICAL count ("N from
 * this workspace" / "None from this workspace"), the `(unsaved
 * changes)` suffix while the editor tab holds a draft, a read-only
 * list of the roots in the popup (name · subject, nothing selectable)
 * or the empty line, and the footer link that opens the editor through
 * {@link OpenTrustedRootsContext}. Never a knob — trust is workspace
 * data applied to every TLS dial (the locked law).
 *
 * On a non-node host the control is disabled with the "Browser store"
 * face; the hosting row owns the honest caption beneath it.
 */

import { getCapability } from '@openheaders/core/capabilities';
import type { TrustedRoot } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTrustedRoots } from '@openheaders/ui/shared/hooks/readers/useTrustedRoots';
import { CONTROL_WIDTH } from '@openheaders/ui/shared/settings-rows';
import { useTrustedRootsDraft } from '@openheaders/ui/shared/trusted-roots-draft';
import { Button, ConfigProvider, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { useOpenTrustedRoots } from '../../hooks/OpenTrustedRootsContext';
import { useCertificateSummary } from './use-certificate-summary';

const { Text } = Typography;

/** Whether the request runtime on this host can apply workspace roots. */
export function isNodeRequestRuntime(): boolean {
  return getCapability('requestRuntime')?.() === 'node';
}

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

const TrustedRootsPicker: React.FC<{
  ariaLabel: string;
  testId?: string;
}> = ({ ariaLabel, testId }) => {
  const t = useT();
  const { token } = theme.useToken();
  const nodeHost = isNodeRequestRuntime();
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const roots = useTrustedRoots(nodeHost ? workspaceId : null);
  const draft = useTrustedRootsDraft(nodeHost ? workspaceId : null);
  const openTrustedRoots = useOpenTrustedRoots();
  const [open, setOpen] = useState(false);
  const savedFace =
    roots.length === 0
      ? t('workbench.trustedRoots.settings.none')
      : t('workbench.trustedRoots.settings.count', { count: roots.length });
  // The face counts the CANONICAL list (workspace data); a live draft
  // on the editor tab only adds the honest suffix — this device's
  // sends dial with the unsaved list until Save.
  const face = !nodeHost
    ? t('workbench.trustedRoots.settings.browserStore')
    : draft === undefined
      ? savedFace
      : `${savedFace} ${t('workbench.trustedRoots.settings.unsaved')}`;
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
              <div style={{ marginTop: 4, padding: '4px 4px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
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
  );
};

export default TrustedRootsPicker;
