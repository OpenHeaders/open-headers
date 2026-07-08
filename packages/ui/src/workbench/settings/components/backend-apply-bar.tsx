import { updatePrimaryBackend } from '@openheaders/core/backends';
import { ExperimentOutlined, ReloadOutlined, SwapOutlined, UndoOutlined } from '@ant-design/icons';
import { App as AntApp, Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { generateUid } from '@openheaders/core/utils';
import { usePrimaryBackend, usePrimaryBackendUrl } from '../../../shared/backend';
import { probeBackendConnection } from '../../../shared/backend/probe-connection';
import { describeProbeResult } from '../../../shared/backend/probe-notify';
import type { Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending, backendModeNeedsConnection, hostIsTheBackend } from '../schema/backend';
import { set as setSettingValue } from '../store';
import { type ConnectionDraftSnapshot, useConnectionDraft } from './connection-draft';
import { isModeValidForHost } from './backend-scenarios';

/**
 * Bottom action bar — the explicit commit point. The dropdown that
 * lived here in earlier sessions silently committed on every change,
 * which conflated configuration with activation; clicking a tile to
 * "preview" a mode would block on the destructive-action orchestrator
 * the moment the dropdown ticked over. Splitting tile-preview from
 * tile-commit (this button) lets the user explore + configure freely.
 */
export const ApplyBar: React.FC<{
  previewMode: BackendMode;
  activeMode: BackendMode;
  previewLabel: string;
  host: Host;
  disabled?: boolean;
  onApply: () => void;
}> = ({ previewMode, activeMode, previewLabel, host, disabled, onApply }) => {
  const { token } = theme.useToken();
  const { notification } = AntApp.useApp();
  const draft = useConnectionDraft();
  const connectionDirty = (draft?.dirtyKeys.length ?? 0) > 0;
  // The pre-commit values of the last Apply, kept so the user can Revert
  // if the new connection doesn't come back. Cleared the moment a fresh
  // edit is staged — a new draft supersedes the prior apply's undo window.
  const [revertTarget, setRevertTarget] = useState<ConnectionDraftSnapshot | null>(null);
  useEffect(() => {
    if (connectionDirty) setRevertTarget(null);
  }, [connectionDirty]);
  const persistedUrl = usePrimaryBackendUrl();
  // Probe + apply act on the STAGED url so the user can test an address
  // before adopting it — the whole point of decoupling edit from apply.
  const url = draft ? draft.effective('backend.url') : persistedUrl;
  // A saved auth token means this device is paired/authorized for the
  // back-end — used to tell the user that pairing is done and the only
  // step left is the explicit Switch (pairing is auth setup, not activation).
  // The probe must also PRESENT it, or the daemon rejects every HELLO.
  const authToken = usePrimaryBackend()?.authToken ?? '';
  const hasAuthToken = authToken.trim().length > 0;
  const [testing, setTesting] = useState(false);
  const isActive = previewMode === activeMode;
  const validForHost = isModeValidForHost(previewMode, host);
  const localHostIsBackend = hostIsTheBackend(previewMode, host);
  const pending = backendModeIsPending(previewMode);
  // Test connection only when the host would be a CLIENT of this
  // back-end. Suppressed for in-browser on the extension (the SW IS
  // the back-end) and for desktop-app on the desktop host (the main
  // process IS the back-end). Suppressed entirely for host-invalid
  // previews (e.g. desktop previewing in-browser) and for pending
  // modes that don't have a shipped daemon to probe yet.
  const showTest =
    validForHost && !localHostIsBackend && !pending && backendModeNeedsConnection(previewMode);
  // `previewMode` matches the previewed Connection-target, so the
  // probe sends a HELLO that role-claims this host. The peer's
  // workspaceId field is unused for the probe's reachability check —
  // it's still required by the schema, so we mint a per-probe synthetic
  // id rather than leaking the local active workspace. A peer that
  // doesn't know that id replies with `workspace-unknown` which we
  // surface as "Reachable, but doesn't share a workspace yet."
  const probe = useMemo(() => {
    const role = host === 'desktop' ? 'desktop' : host === 'web' ? 'web' : 'extension';
    return async (): Promise<void> => {
      setTesting(true);
      // Race the probe against a minimum dwell so a successful localhost
      // round-trip (often <10ms) doesn't flash through the loading state
      // too fast to read. The 500ms floor turns it into a deliberate "I
      // tried, here's the result" beat.
      const MIN_LOADING_MS = 500;
      const [result] = await Promise.all([
        probeBackendConnection(url, {
          agent: `${role}-probe`,
          nodeId: `probe-${generateUid()}`,
          workspaceId: `probe-${generateUid()}`,
          role,
          authToken,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
      ]);
      setTesting(false);
      const notice = describeProbeResult(result, previewLabel);
      notification[notice.level]({ message: notice.message, description: notice.description });
    };
  }, [host, url, previewLabel, notification, authToken]);

  const applyConnection = (): void => {
    if (!draft) return;
    setRevertTarget(draft.commit());
  };
  const revert = (): void => {
    if (!revertTarget) return;
    if (revertTarget['backend.url'] !== undefined) void updatePrimaryBackend({ url: revertTarget['backend.url'] });
    if (revertTarget['backend.bindPort'] !== undefined)
      setSettingValue('backend.bindPort', revertTarget['backend.bindPort']);
    setRevertTarget(null);
  };
  const canRevert = revertTarget != null;

  const onPrimary = (): void => {
    if (isActive) {
      applyConnection();
      return;
    }
    // Switching modes — land any staged connection params first so the new
    // back-end connects with them, then route through the orchestrator.
    if (draft && connectionDirty) draft.commit();
    onApply();
  };
  const primaryLabel = isActive ? 'Apply & Reconnect' : `Switch to ${previewLabel}`;
  const primaryDisabled = isActive ? !connectionDirty || disabled : disabled || !validForHost || pending;

  let statusCopy: React.ReactNode;
  if (isActive) {
    if (connectionDirty) {
      statusCopy = (
        <>
          Unapplied connection changes to{' '}
          <strong style={{ color: token.colorText }}>{previewLabel}</strong>. Apply to reconnect.
        </>
      );
    } else if (canRevert) {
      statusCopy = (
        <>
          Applied to <strong style={{ color: token.colorText }}>{previewLabel}</strong>. Revert if the
          connection doesn't recover.
        </>
      );
    } else {
      statusCopy = (
        <>
          <strong style={{ color: token.colorText }}>{previewLabel}</strong> is the active back-end.
        </>
      );
    }
  } else if (!validForHost) {
    statusCopy = (
      <>
        <strong style={{ color: token.colorText }}>{previewLabel}</strong> isn't available on this host.
      </>
    );
  } else if (pending) {
    statusCopy = (
      <>
        <strong style={{ color: token.colorText }}>{previewLabel}</strong> is coming soon.
      </>
    );
  } else if (hasAuthToken && backendModeNeedsConnection(previewMode)) {
    // Paired but not yet active — pairing is auth setup, so spell out that
    // the only remaining step is the explicit Switch.
    statusCopy = (
      <>
        Paired with <strong style={{ color: token.colorText }}>{previewLabel}</strong>. Switch to start using it.
      </>
    );
  } else {
    statusCopy = (
      <>
        Previewing <strong style={{ color: token.colorText }}>{previewLabel}</strong>. Apply to switch.
      </>
    );
  }
  return (
    <div
      style={{
        // Sticky to the bottom of the scrollable settings pane so the
        // main actions stay reachable no matter how far the user has
        // scrolled into the config panel. `bottom: 0` anchors to the
        // pane viewport. The grey pane-layout background + top padding
        // form a gutter above the white bar so config rows scrolling
        // underneath read as grey, not white-on-white.
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        background: token.colorBgLayout,
        // Full-bleed like the sticky mode-picker band: cancel the pane's
        // side padding so the grey mask spans the whole row. Symmetric
        // vertical padding centers the white bar inside the grey band.
        margin: '0 -24px',
        padding: '10px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '10px 12px',
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          boxShadow: `0 -4px 12px -8px ${token.colorBgLayout}`,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: token.colorTextSecondary }}>{statusCopy}</span>
        {canRevert && (
          <Button icon={<UndoOutlined />} onClick={revert}>
            Revert
          </Button>
        )}
        {showTest && (
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => {
              void probe();
            }}
            loading={testing}
          >
            Test connection
          </Button>
        )}
        <Button
          type="primary"
          icon={isActive ? <ReloadOutlined /> : <SwapOutlined />}
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
};
