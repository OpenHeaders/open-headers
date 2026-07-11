import '@/host/install-host-logger';
import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-rpc-fallback';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-capabilities';
import { eagerInitRendererMirrors, ThemeProvider } from '@openheaders/ui/context';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import Workbench from '@openheaders/ui/workbench/App';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { bootWebHost } from '@/host/boot-web-host';
import { installDaemonWire } from '@/host/daemon-wire';
import { awaitPostJoinAdoption, decideGate, submitDaemonToken } from '@/host/join-gate';
import { claimOidcToken, consumeOidcHash, describeOidcError, fetchOidcMeta } from '@/host/oidc-login';
import { fetchPasswordMeta } from '@/host/password-login';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';
import { InsecureContextNotice } from '@/InsecureContextNotice';
import { LoginGate } from '@/LoginGate';
import { registerServiceWorker } from '@/register-sw';
import { hideTransitionOverlay, showTransitionOverlay } from '@/transition-overlay';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/workbench/styles/rules.less';

// Declare the web host BEFORE any UI renders so user-facing strings
// read from the right vocabulary on first paint.
setCurrentHost('web');

const container = document.getElementById('root');
const root = createRoot(container!);

function renderShell(children: React.ReactNode): void {
  root.render(
    <SettingsProvider>
      <ThemeProvider>
        <AntApp>{children}</AntApp>
      </ThemeProvider>
    </SettingsProvider>,
  );
  // The real UI is up — retire the boot/transition spinner.
  hideTransitionOverlay();
}

if (!window.isSecureContext) {
  // A plain-http origin off loopback: the platform withholds
  // `crypto.subtle` / `crypto.randomUUID`, so the tab oracle cannot
  // boot. Explain the supported ways in instead of dying blank.
  root.render(<InsecureContextNotice />);
} else {
  // Instant feedback: the boot runs several awaits (oracle boot, gate
  // probes, SSO claim + adopt) before anything renders. Paint a spinner
  // now so a fresh load — and the blank frame after a sign-out reload or
  // an SSO return — never shows a dead static screen. Every terminal
  // render retires it via `renderShell`.
  showTransitionOverlay();

  // Install the offline shell early — registration is fire-and-forget
  // and must not wait on the boot below.
  registerServiceWorker();

  // Boot the tab oracle to completion BEFORE the mirrors seed and React
  // mounts: every snapshot RPC and capability probe below must land on a
  // live engine with the active workspace hydrated, or first paint would
  // race the boot and render empty mirrors that never re-seed.
  await bootWebHost();

  // Subscribe every entity mirror to `syncBroadcast` and kick off each
  // snapshot RPC before React mounts — see `eager-mirror-init.ts` for the
  // full rationale.
  eagerInitRendererMirrors();

  const wire = installDaemonWire();

  const mountWorkbench = (): void => {
    // Latch the wire on (idempotent — the gate's accepted handshake is
    // already this same connection) and mount.
    wire.start();
    renderShell(<Workbench resolveIdentity={resolveWorkbenchIdentity} />);
  };

  // SSO callback landing: pull the one-shot fragment result out of the
  // URL before anything else reads it. A claim code swaps for the
  // session token daemon-side, and the token then rides the exact
  // pasted-token path — candidate in memory, real HELLO, persisted only
  // on WELCOME accept.
  const oidcResult = consumeOidcHash();
  let ssoJoined = false;
  let ssoError: string | null = null;
  if (oidcResult?.kind === 'claim') {
    showTransitionOverlay('Signing you in…');
    const secret = await claimOidcToken(oidcResult.code);
    if (secret && (await submitDaemonToken(wire, secret)).ok) {
      ssoJoined = true;
    } else {
      ssoError = describeOidcError(secret ? 'rejected' : 'unknown');
    }
  } else if (oidcResult?.kind === 'error') {
    ssoError = describeOidcError(oidcResult.reason);
  }

  // Login gate: a reachable daemon with no stored pairing token gates the
  // mount; the entered token is validated by a real HELLO/WELCOME before
  // it persists. An unreachable daemon (or a stored token) mounts
  // straight away — the tab is offline-first, the wire joins in the
  // background. "Skip" keeps the tab local without dialing.
  if (ssoJoined) {
    // Mount only after join → adopt promoted the daemon's workspace so
    // the first workbench tab pins to the adopted scope.
    await awaitPostJoinAdoption(wire);
    mountWorkbench();
  } else if (ssoError !== null || (await decideGate()) === 'gate') {
    const oidcMeta = await fetchOidcMeta();
    // Password login is composed daemon-side only when no OIDC provider
    // is configured, so the probes are mutually exclusive by contract.
    const passwordMeta = oidcMeta.enabled ? { enabled: false } : await fetchPasswordMeta();
    renderShell(
      <LoginGate
        wire={wire}
        ssoProvider={oidcMeta.enabled ? (oidcMeta.provider ?? 'SSO') : null}
        passwordEnabled={passwordMeta.enabled}
        initialError={ssoError}
        onJoined={() => {
          // Mask the gate→workbench gap (join → adopt → workspace
          // promote) so the accepted login doesn't sit on a frozen gate.
          showTransitionOverlay('Signing you in…');
          void awaitPostJoinAdoption(wire).then(mountWorkbench);
        }}
        onSkip={() => renderShell(<Workbench resolveIdentity={resolveWorkbenchIdentity} />)}
      />,
    );
  } else {
    mountWorkbench();
  }
}
