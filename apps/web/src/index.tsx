import '@/host/install-host-logger';
import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-rpc-fallback';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-capabilities';
import '@/host/install-script-sandbox';
import { eagerInitRendererMirrors, LocaleProvider, ThemeProvider } from '@openheaders/ui/context';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { bootTranslator } from '@/boot-locale';
import { ConsentCard } from '@/ConsentCard';
import {
  consentStateFromRead,
  consumeAuthorizeHash,
  fetchAuthorizationFacts,
  type PendingAuthorization,
} from '@/host/authorize-consent';
import { bootPublicViewer } from '@/host/boot-public-viewer';
import { bootWebHost } from '@/host/boot-web-host';
import { hasDaemonToken } from '@/host/daemon-token';
import { installDaemonWire } from '@/host/daemon-wire';
import { awaitPostJoinAdoption, decideGate, resolveGateMode, submitDaemonToken } from '@/host/join-gate';
import { seedLocalWorkspaceIfNeverJoined } from '@/host/mount-decision';
import { claimOidcToken, consumeOidcHash } from '@/host/oidc-login';
import { publicViewWorkspaceId } from '@/host/public-view';
import { InsecureContextNotice } from '@/InsecureContextNotice';
import { LoginGate } from '@/LoginGate';
import { PublicWorkspaceViewer } from '@/PublicWorkspaceViewer';
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

const publicWorkspace = publicViewWorkspaceId();

if (!window.isSecureContext) {
  // A plain-http origin off loopback: the platform withholds
  // `crypto.subtle` / `crypto.randomUUID`, so the tab oracle cannot
  // boot. Explain the supported ways in instead of dying blank.
  root.render(<InsecureContextNotice />);
} else if (publicWorkspace !== null) {
  // F5b — the anonymous public viewer. A wholly separate mount: no
  // service worker, no login gate, no wire; the boot hydrates the
  // published snapshot into a throwaway in-memory oracle (the memory
  // host storage was installed at import time), then the ordinary
  // mirrors seed off it and the Workbench mounts behind an honest
  // read-only banner.
  showTransitionOverlay();
  const booted = await bootPublicViewer(publicWorkspace);
  if (booted.ok) eagerInitRendererMirrors();
  renderShell(<PublicWorkspaceViewer publication={booted.ok ? booted.publication : null} />);
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

  // A native client's sign-in waiting on this browser (the client
  // sign-in plan §14.4): the opaque id comes out of the URL before the
  // gate probe, and is held for the life of the decision — the gate,
  // when there is no session, hands back to the consent card.
  const pendingAuthorization = consumeAuthorizeHash();

  /** The way on after a gate-flow sign-in: mount once join → adopt promoted the daemon's workspace. */
  const mountAdopted = (): void => void awaitPostJoinAdoption(wire).then(mountWorkbench);

  const renderGate = async (pending: PendingAuthorization | null, errorReason: string | null): Promise<void> => {
    renderShell(
      <LoginGate
        wire={wire}
        mode={await resolveGateMode()}
        initialErrorReason={errorReason}
        authorizationId={pending?.id ?? null}
        onJoined={() => {
          // The gate showed the signing-in overlay before calling in;
          // it stays up across join → adopt → workspace promote. A
          // decision the gate stood in front of comes first: the card
          // approves with the session the sign-in just minted.
          if (pending === null) mountAdopted();
          else renderShell(<ConsentCard wire={wire} pending={pending} onContinue={mountAdopted} />);
        }}
      />,
    );
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
  } else if (pendingAuthorization !== null && hasDaemonToken()) {
    // A session in hand: the consent card at once, over the wire so
    // the probe can name the person the approval signs the device in
    // as. The Workbench follows the verdict.
    wire.start();
    renderShell(<ConsentCard wire={wire} pending={pendingAuthorization} onContinue={() => void mountWorkbench()} />);
  } else if (pendingAuthorization !== null) {
    // No session. The server page's rule: a settled record answers its
    // verdict to anyone — the device-grant SSO round-trip lands here
    // approved with no session minted — while a pending one needs a
    // person, so the gate draws first and hands back to the card.
    const read = await fetchAuthorizationFacts(pendingAuthorization.id);
    if (consentStateFromRead(read).kind === 'pending') {
      await renderGate(pendingAuthorization, pendingAuthorization.error ?? null);
    } else {
      renderShell(
        <ConsentCard
          wire={wire}
          pending={pendingAuthorization}
          read={read}
          onContinue={() => void renderGate(null, null)}
        />,
      );
    }
  } else if (ssoErrorReason !== null || (await decideGate()) === 'gate') {
    await renderGate(null, ssoErrorReason);
  } else {
    await mountWorkbench();
  }
}
