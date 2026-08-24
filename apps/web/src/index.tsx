import '@/host/install-host-logger';
import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-rpc-fallback';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-capabilities';
import { eagerInitRendererMirrors, LocaleProvider, ThemeProvider } from '@openheaders/ui/context';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { bootTranslator } from '@/boot-locale';
import { bootWebHost } from '@/host/boot-web-host';
import { installDaemonWire } from '@/host/daemon-wire';
import { watchDaemonScriptPosture } from '@/host/install-script-posture';
import { awaitPostJoinAdoption, decideGate, resolveGateMode, submitDaemonToken } from '@/host/join-gate';
import { seedLocalWorkspaceIfNeverJoined } from '@/host/mount-decision';
import { claimOidcToken, consumeOidcHash } from '@/host/oidc-login';
import { InsecureContextNotice } from '@/InsecureContextNotice';
import { LoginGate } from '@/LoginGate';
import { registerServiceWorker } from '@/register-sw';
import { hideTransitionOverlay, showTransitionOverlay } from '@/transition-overlay';
import { WorkbenchMount } from '@/WorkbenchMount';
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
      <LocaleProvider>
        <ThemeProvider>
          <AntApp>{children}</AntApp>
        </ThemeProvider>
      </LocaleProvider>
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
  watchDaemonScriptPosture(wire);

  const mountWorkbench = async (): Promise<void> => {
    // Latch the wire on (idempotent — the gate's accepted handshake is
    // already this same connection). A NEVER-JOINED browser with an
    // empty store seeds its local workspace here, at the mount
    // decision (the A8 case — an ordinary first mutation against the
    // live oracle, not a bootstrap replay); a joined tab never seeds.
    // `WorkbenchMount` then derives Workbench-vs-awaiting-access from
    // the LIVE workspace list — a joined tab holding zero granted
    // workspaces gets the explained screen, which resolves in place
    // when the first grant syncs down.
    wire.start();
    await seedLocalWorkspaceIfNeverJoined();
    renderShell(<WorkbenchMount wire={wire} />);
  };

  // SSO callback landing: pull the one-shot fragment result out of the
  // URL before anything else reads it. A claim code swaps for the
  // session token daemon-side, and the token then rides the exact
  // pasted-token path — candidate in memory, real HELLO, persisted only
  // on WELCOME accept.
  const oidcResult = consumeOidcHash();
  let ssoJoined = false;
  let ssoErrorReason: string | null = null;
  if (oidcResult?.kind === 'claim') {
    // Pre-provider beat — the settings picker isn't readable yet, so
    // the overlay label resolves from the browser's own preferences.
    showTransitionOverlay(bootTranslator()('web.overlay.signingIn'));
    const secret = await claimOidcToken(oidcResult.code);
    if (secret && (await submitDaemonToken(wire, secret)).ok) {
      ssoJoined = true;
    } else {
      // Both map to the generic SSO-failed line in the gate.
      ssoErrorReason = secret ? 'rejected' : 'unknown';
    }
  } else if (oidcResult?.kind === 'error') {
    ssoErrorReason = oidcResult.reason;
  }

  // Login gate: a reachable daemon with no stored session gates the
  // mount, and whichever way in the visitor takes is validated by a real
  // HELLO/WELCOME before it persists. An unreachable daemon (or a stored
  // session) mounts straight away — the tab is offline-first, the wire
  // joins in the background. Signing in is the only way past a gate that
  // IS showing: a local-only mount is what an absent daemon degrades to,
  // never a choice offered while the server is right there answering.
  if (ssoJoined) {
    // Mount only after join → adopt promoted the daemon's workspace so
    // the first workbench tab pins to the adopted scope.
    await awaitPostJoinAdoption(wire);
    await mountWorkbench();
  } else if (ssoErrorReason !== null || (await decideGate()) === 'gate') {
    renderShell(
      <LoginGate
        wire={wire}
        mode={await resolveGateMode()}
        initialErrorReason={ssoErrorReason}
        onJoined={() => {
          // The gate showed the signing-in overlay before calling in;
          // it stays up across join → adopt → workspace promote.
          void awaitPostJoinAdoption(wire).then(mountWorkbench);
        }}
      />,
    );
  } else {
    await mountWorkbench();
  }
}
