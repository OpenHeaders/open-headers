/**
 * SettingsTab — per-request HTTP knobs.
 *
 * The wired knobs render as compact `control · label · (i)` rows with
 * the explanation behind the standard InfoTrigger popover:
 *   • `followRedirects` — maps to `RequestInit.redirect` so the user
 *     can surface intermediate 3xx responses (as `opaqueredirect`)
 *     instead of chasing them to the final target. Real on every host.
 *   • `credentialsMode` — "Send browser cookies" (`'include'`); off
 *     (`undefined`/`'omit'`) is the safe default. Browser-runtime only:
 *     a Node fetch stack has no ambient cookie jar for the flag to
 *     ride — there the app's own opt-in jar is the `cookieJar` knob
 *     below.
 *   • `sslVerification` — node-runtime only: the node transport routes
 *     a verification-off send through a dedicated TLS dispatcher, the
 *     escape hatch for self-signed / private-CA targets. The browser
 *     cannot relax verification per request, so there the same setting
 *     stays a browser-managed fact row.
 *   • `timeoutMs` — numeric, real on every host: both the browser wire
 *     layer and the node transport arm an abort deadline spanning the
 *     whole round-trip. Empty = no per-request limit.
 *   • `maxResponseBytes` — numeric, node-runtime only: the node
 *     transport streams + caps the body read; the knob exposes that
 *     ceiling per request (KB in the UI, bytes on disk). The browser
 *     keeps its app-wide response cap, so no per-request control there.
 *   • `maxRedirects` / `followOriginalHttpMethod` /
 *     `followAuthorizationHeader` — the redirect trio, node-runtime
 *     only: the node transport chases redirect chains itself, so it can
 *     cap the chain, keep the original method across 301/302/303, and
 *     keep Authorization across origins. Browser fetch fixes all three
 *     by policy (manual mode returns an opaqueredirect with no headers
 *     to follow), so there they stay browser-managed fact rows. The
 *     three rows are hidden while "Automatically follow redirects" is
 *     off — they configure the chase, and there is no chase — matching
 *     the dot rule: a hidden knob contributes no tab dot.
 *   • `tlsMinVersion` / `tlsMaxVersion` / `tlsCipherSuites` — the TLS
 *     long tail, node-runtime only: the node transport's per-tuple
 *     dispatcher cache carries the protocol window + offered suites
 *     into the TLS connector. The browser owns its TLS stack outright,
 *     so there both stay browser-managed fact rows. Lowering the floor
 *     below 1.2 is trust-relaxing (warned in place, response marked);
 *     raising it or listing suites is not. Cipher-suite ORDER stays a
 *     fact everywhere: the server picks the suite, so preference order
 *     is not a client-side knob.
 *   • `httpVersion` — node-runtime only: `'auto'` (the default,
 *     rendered as the cleared select) offers h2 + http/1.1 via ALPN
 *     and the SERVER picks; `'1.1'` pins classic semantics; `'2'`
 *     pins HTTP/2 via an h2-only ALPN offer that FAILS HONESTLY when
 *     the server negotiates anything else — never a silent downgrade
 *     (and plain http:// can't ALPN at all, so a pinned cleartext
 *     send fails too). `'2-prior-knowledge'` (the sanctioned
 *     cleartext-h2 route) and `'3'` are selectable and sync, but the
 *     runtime fails them honestly as not-yet-supported until their
 *     engine phases land. The reported protocol on the response meta
 *     strip always comes from the wire, never from this knob. Pure
 *     configuration: not trust-relaxing, no response marker. The
 *     browser negotiates protocol on its own, so there 'HTTP version'
 *     stays a browser-managed fact row.
 *   • `resolveToAddress` — node-runtime only: the node transport's
 *     dispatcher pins its resolver to the one address, while SNI, the
 *     Host header, and certificate verification all keep the URL's
 *     hostname — the "test one specific backend behind the load
 *     balancer" knob. Not trust-relaxing (with verification on, the
 *     certificate must still match the URL's host), no response
 *     marker. The browser owns its resolver outright, so there is no
 *     browser control — and no fact row on either sheet: resolution
 *     was never a sheet-listed fact, so nothing graduates.
 *   • `clientCertificateRef` — node-runtime only: the node transport
 *     presents the vault entry's cert + key PEM pair in the TLS
 *     handshake (mutual-TLS gateways). The knob is a picker over the
 *     vault's client-certificate entries; the request stores the entry
 *     NAME, each device resolves it against its own local vault, and a
 *     ref with no matching entry warns in place. Not trust-relaxing —
 *     presenting a client certificate doesn't weaken server
 *     verification — so no response marker, and no fact row on either
 *     sheet. The browser picks client certificates from its own
 *     store/prompt, so there is no browser control.
 *   • `proxyMode` / `proxyUrl` / `proxyCredentialRef` — node-runtime
 *     only: the tri-state Proxy row over the two-plane architecture
 *     (the request-engine proxy design). Inherit (the default —
 *     the cleared select, `undefined` on disk) lets the executing
 *     DEVICE's system plane decide (system settings / PAC /
 *     env vars); Direct opts the send out of any ambient proxy;
 *     Custom URL routes through the request's own proxy — the row
 *     writes the MODE+URL pair, and the H11 reset returns all three
 *     fields to `undefined` = Inherit. A custom proxy tunnels with
 *     CONNECT, so end-to-end TLS and certificate verification still
 *     run against the target. Credentials ride a vault string entry
 *     (`user:password`) picked by name, never the URL — the runtime
 *     would honor `user:pass@` userinfo, which is exactly why the
 *     schema rejects it (secrets must not land in synced YAML).
 *     http://, https://, and socks5:// schemes are accepted — the
 *     SOCKS4 family is rejected. A CUSTOM proxy is not honorable
 *     together with `resolveToAddress` (the proxy resolves the
 *     hostname itself) — the URL row warns in place while both are
 *     set and the transport fails the send loudly; an INHERITED proxy
 *     instead STANDS DOWN against explicit conflicting knobs (the
 *     seamlessness law). Not trust-relaxing, no response marker, no
 *     fact row on either sheet. The browser routes through its own
 *     proxy settings, so there is no browser control. The URL and
 *     credentials rows hide while the mode isn't Custom (nothing to
 *     configure), matching the dot rule: a hidden knob contributes no
 *     tab dot.
 *   • `unixSocketPath` — node-runtime only: the node transport dials
 *     the local Unix domain socket (or Windows named pipe) instead of
 *     opening a TCP connection — Docker-daemon-style APIs, systemd
 *     services, local dev daemons. The URL's host stays cosmetic for
 *     dialing while the Host header, SNI, and certificate verification
 *     keep using it. Mutually exclusive with BOTH the proxy (a tunnel
 *     can't dial a local socket) and resolve-to-address (nothing is
 *     resolved) — the row warns in place while either pair is set and
 *     the transport fails the send loudly. Not trust-relaxing, no
 *     response marker, no fact row on either sheet. The browser cannot
 *     dial local sockets, so there is no browser control.
 *   • `cookieJar` — node-runtime only: opts the send into the app's
 *     own in-memory cookie jar (one per workspace, never persisted,
 *     never synced, gone on quit). Jar-enabled sends store Set-Cookie
 *     responses and attach matching cookies on every hop of a redirect
 *     chain; a user-set Cookie header always wins for its hop. Not
 *     trust-relaxing, no response marker — the attached header is
 *     recorded on the executed-run snapshot for reproducibility. The
 *     browser runtime rides the browser's own jar via
 *     `credentialsMode`, so there is no browser control; the node
 *     sheet's former 'Cookies · Not sent' fact row graduated into this
 *     knob. A quiet row under the knob (`CookieJarRow`) shows the
 *     jar's current contents (count + value-free metadata) with a
 *     Clear action and a per-entry ✕; it rides the
 *     `getCookieJarSummary` / `clearCookieJar` / `deleteCookieJarEntry`
 *     bridge RPCs and hides on hosts that don't answer them.
 *   • Script execution (`useScriptExecutionMode`) — the one row here
 *     that is NOT a per-request knob: a PER-WORKSPACE, HOST-LOCAL
 *     chooser between Safe mode (recommended default; scripts run in
 *     the app's sandboxed runtime, `oh.*` API only) and Developer mode
 *     (explicit opt-in; full Node runtime — trust-relaxing, warned in
 *     place while selected, and the executed run records its mode on
 *     the response meta strip). Rendered only where the answering host
 *     actually runs scripts (the `scriptRuntime` capability); the
 *     node sheet's former Scripts fact row graduated into it there,
 *     while runtime-less surfaces keep the "don't run here" fact. The
 *     setting rides `OH.scriptExecutionModes` and never syncs — a
 *     shared workspace cannot switch another device to Developer mode.
 *
 * Everything else a request-settings surface traditionally exposes
 * (HTTP version, TLS policy, redirect internals, URL encoding, …) is
 * fixed end-to-end by whichever network runtime executes the request —
 * the browser inside an MV3 extension, or a Node fetch stack when the
 * host registers the `requestRuntime: 'node'` capability (desktop
 * main-process execution, web-surface daemon execution). Those render
 * as read-only label/value rows behind an "N runtime-managed" reveal
 * toggle — same affordance the Headers tab uses for auto-generated
 * headers — so the real knobs aren't buried in inert controls. The two
 * fact sheets differ because the runtimes genuinely do: e.g. Node
 * speaks HTTP/1.1 only and sends no ambient Referer, while the browser
 * negotiates h1/h2/h3 and applies referrer policy.
 *
 * Presentation: the knobs are grouped under left-labeled dividers
 * (Connection · TLS & trust · Redirects · Cookies · Execution &
 * limits), and placeholder text renders at full text contrast — an
 * empty knob states its effective default as live behavior, and must
 * never read as a disabled control. Group folds survive the tab's
 * remounts for the session; every field control shares one width so
 * the control column keeps a straight left edge; and a modified row
 * carries a per-row undo (the app Settings page's FieldRow idiom) so
 * one experiment can be undone in place. Every
 * knob row's and group header's (i) opens the structured popover built
 * in SettingsRowInfo.tsx — one shared example send with the popover's
 * own slice highlighted, the network column-popover idiom.
 */

import type { MessageKey } from '@openheaders/i18n';
import { ConfigProvider, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { getCapability, type RequestRuntimeKind } from '@openheaders/core/capabilities';
import {
  isValidUnixSocketPath,
  MAX_MAX_REDIRECTS,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_MAX_REDIRECTS,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_RESPONSE_BYTES,
} from '@openheaders/core/schemas';
import type { HttpVersion, ProxyMode, TlsVersion } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  byteSizeInterpreter,
  countInterpreter,
  durationMsInterpreter,
  formatByteSize,
  formatDurationMs,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import {
  ComboKnobRow,
  GroupSection,
  KnobRow,
  RuntimeManagedSheet,
  SelectKnobRow,
  TextKnobRow,
} from '@openheaders/ui/shared/settings-rows';
import DialRows from '../shared/dial/DialRows';
import TlsTrustGroup from '../shared/tls-trust/TlsTrustGroup';
import CookieJarRow from './CookieJarRow';
import { GROUP_LABEL_KEY, GROUP_ORDER, type SettingsGroupKey } from './settings-groups';
import { NO_UNSAVED_SETTINGS, type SettingsKnobKey } from './settings-unsaved';
import {
  type SettingsExampleToken,
  settingsExampleCard,
  settingsGroupInfo,
  settingsRowInfo,
} from './SettingsRowInfo';
import { useScriptExecutionMode } from './use-script-execution-mode';

export interface RequestSettingsDraft {
  /** Undefined treated as 'omit' (default). */
  credentialsMode?: 'omit' | 'include';
  /** Whether the fetch call follows redirects. Defaults to true. */
  followRedirects?: boolean;
  /** Whether the node runtime verifies the server's TLS certificate
   *  chain. Defaults to true; browser runtimes always verify. */
  sslVerification?: boolean;
  /** Lowest TLS version a send may negotiate. Undefined = the runtime
   *  default (1.2). Node runtimes only. */
  tlsMinVersion?: TlsVersion;
  /** Highest TLS version a send may negotiate. Undefined = the runtime
   *  default (1.3). Node runtimes only. */
  tlsMaxVersion?: TlsVersion;
  /** OpenSSL-format colon-joined cipher list offered in the handshake.
   *  Undefined = the runtime's default suites. Node runtimes only. */
  tlsCipherSuites?: string;
  /** SNI server name presented in the TLS handshake instead of the
   *  URL's host. Undefined = the URL's host. Node runtimes only. */
  sniServerName?: string;
  /** HTTP version policy. Undefined = `'auto'` (ALPN offer of h2 +
   *  http/1.1, the server picks); explicit tokens pin the protocol
   *  and fail honestly when the server won't speak it. Node runtimes
   *  only. */
  httpVersion?: HttpVersion;
  /** IPv4/IPv6 address the URL's hostname resolves to at connect time;
   *  SNI / Host / cert verification keep the original hostname.
   *  Undefined = system DNS. Node runtimes only. */
  resolveToAddress?: string;
  /** Name of a vault client-certificate entry presented during the TLS
   *  handshake. Undefined = no client certificate. Node runtimes only. */
  clientCertificateRef?: string;
  /** Proxy routing mode. Undefined = INHERIT the executing device's
   *  system plane (the default); `'direct'` opts the send out of
   *  any ambient proxy; `'url'` routes through `proxyUrl`. Node
   *  runtimes only. */
  proxyMode?: ProxyMode;
  /** HTTP(S) proxy URL the send tunnels through — meaningful only with
   *  `proxyMode: 'url'` (the row writes the pair). Node runtimes
   *  only. */
  proxyUrl?: string;
  /** Name of a vault string entry holding the proxy's `user:password`.
   *  Undefined = unauthenticated proxy. Node runtimes only. */
  proxyCredentialRef?: string;
  /** Local socket (absolute Unix socket path or Windows named pipe)
   *  the send dials instead of a TCP connection. Undefined = TCP.
   *  Node runtimes only. */
  unixSocketPath?: string;
  /** Opt this request into the app's in-memory per-workspace cookie
   *  jar (store Set-Cookie, attach matching cookies). Defaults to
   *  false = no cookies. Node runtimes only. */
  cookieJar?: boolean;
  /** Round-trip ceiling in milliseconds. Undefined = no per-request
   *  limit. Honored on both runtimes. */
  timeoutMs?: number;
  /** Response-body cap in bytes. Undefined = the runtime's default
   *  (2 MB). Node runtimes only; the browser keeps its app-wide cap. */
  maxResponseBytes?: number;
  /** Redirect-chain cap. Undefined = the runtime's default (20).
   *  Node runtimes only. */
  maxRedirects?: number;
  /** Keep the original method + body across 301/302/303 redirects.
   *  Defaults to false. Node runtimes only. */
  followOriginalHttpMethod?: boolean;
  /** Keep the Authorization header on cross-origin redirect hops.
   *  Defaults to false. Node runtimes only. */
  followAuthorizationHeader?: boolean;
}

interface SettingsTabProps {
  value: RequestSettingsDraft;
  onChange: (next: RequestSettingsDraft) => void;
  /** Editing-scope workspace — target of the per-workspace Script
   *  execution chooser. `null` = the host's active workspace. */
  workspaceId?: string | null;
  /** Knobs whose draft value differs from the SAVED request (see
   *  settings-unsaved.ts) — their dots render in the sidebar/tab-bar
   *  dirty salmon, outranking the blue non-default tone. Omitted = no
   *  baseline, every dot keeps its blue non-default meaning. */
  unsaved?: ReadonlySet<SettingsKnobKey>;
}

interface RuntimeManagedDef {
  labelKey: MessageKey;
  /** Effective behavior shown in the muted value column. */
  valueKey: MessageKey;
  descriptionKey: MessageKey;
  /** Topic sub-header the fact renders under inside the revealed
   *  sheet — same vocabulary as the live knob groups. */
  group: SettingsGroupKey;
  /** The fact's slice of the shared example send. Every fact popover
   *  leads with the same card the live knobs use; a fact with no
   *  visible slice (Referer, strict parser) shows it unlit — shared
   *  context, same format everywhere. */
  tokens?: readonly SettingsExampleToken[];
  /** Row anchor for e2e assertions on posture facts. */
  testId?: string;
}

const BROWSER_MANAGED: RuntimeManagedDef[] = [
  {
    labelKey: 'workbench.editors.request.settings.managed.httpVersion',
    valueKey: 'workbench.editors.request.settings.managed.auto',
    descriptionKey: 'workbench.editors.request.settings.managed.httpVersionDesc',
    group: 'connection',
    tokens: ['protocol'],
  },
  {
    labelKey: 'workbench.editors.request.settings.sslVerification',
    valueKey: 'workbench.editors.request.settings.managed.on',
    descriptionKey: 'workbench.editors.request.settings.managed.sslVerificationDesc',
    group: 'tls',
    tokens: ['verify'],
  },
  {
    labelKey: 'workbench.editors.request.settings.followOriginalMethod',
    valueKey: 'workbench.editors.request.settings.managed.off',
    descriptionKey: 'workbench.editors.request.settings.managed.followOriginalMethodDesc',
    group: 'redirects',
    tokens: ['methodRewrite'],
  },
  {
    labelKey: 'workbench.editors.request.settings.followAuthHeader',
    valueKey: 'workbench.editors.request.settings.managed.off',
    descriptionKey: 'workbench.editors.request.settings.managed.followAuthHeaderDesc',
    group: 'redirects',
    tokens: ['authDrop'],
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.refererRedirect',
    valueKey: 'workbench.editors.request.settings.managed.policy',
    descriptionKey: 'workbench.editors.request.settings.managed.refererRedirectDesc',
    group: 'redirects',
    tokens: ['chain'],
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.strictParser',
    valueKey: 'workbench.editors.request.settings.managed.on',
    descriptionKey: 'workbench.editors.request.settings.managed.strictParserBrowserDesc',
    group: 'connection',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.encodeUrl',
    valueKey: 'workbench.editors.request.settings.managed.on',
    descriptionKey: 'workbench.editors.request.settings.managed.encodeUrlDesc',
    group: 'connection',
    tokens: ['url'],
  },
  {
    labelKey: 'workbench.trustedRoots.settings.label',
    valueKey: 'workbench.editors.request.settings.managed.browserStore',
    descriptionKey: 'workbench.trustedRoots.settings.browserNote',
    group: 'tls',
    tokens: ['verify'],
    testId: 'oh-managed-trusted-roots-row',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.cipherOrder',
    valueKey: 'workbench.editors.request.settings.managed.browser',
    descriptionKey: 'workbench.editors.request.settings.managed.cipherOrderDesc',
    group: 'tls',
    tokens: ['suite'],
  },
  {
    labelKey: 'workbench.editors.request.settings.maxRedirects',
    valueKey: 'workbench.editors.request.settings.managed.about20',
    descriptionKey: 'workbench.editors.request.settings.managed.maxRedirectsDesc',
    group: 'redirects',
    tokens: ['hops'],
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.tlsVersions',
    valueKey: 'workbench.editors.request.settings.managed.browser',
    descriptionKey: 'workbench.editors.request.settings.managed.tlsVersionsDesc',
    group: 'tls',
    tokens: ['tlsWindow'],
  },
];

const NODE_MANAGED: RuntimeManagedDef[] = [
  {
    labelKey: 'workbench.editors.request.settings.managed.referer',
    valueKey: 'workbench.editors.request.settings.managed.notSent',
    descriptionKey: 'workbench.editors.request.settings.managed.refererDesc',
    group: 'connection',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.strictParser',
    valueKey: 'workbench.editors.request.settings.managed.on',
    descriptionKey: 'workbench.editors.request.settings.managed.strictParserNodeDesc',
    group: 'connection',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.encodeUrl',
    valueKey: 'workbench.editors.request.settings.managed.on',
    descriptionKey: 'workbench.editors.request.settings.managed.encodeUrlDesc',
    group: 'connection',
    tokens: ['url'],
  },
];

/**
 * The node sheet's Scripts row, on surfaces without a chooser: where
 * the OWN host has a script runtime (the `scriptRuntime` capability —
 * the desktop), the row graduates into the Script execution chooser
 * knob (the cookie-jar precedent) and neither fact renders. A surface
 * whose sends execute on a connected back-end states that back-end's
 * posture instead: "Safe mode" when it reported a script runtime
 * (`remoteScriptRuntime` — forwarded sends only ever ride Safe, so
 * this is a fact row, never a chooser), and the honest "don't run
 * here" against a runtime-less one.
 */
const SCRIPTS_NOT_RUN_ROW: RuntimeManagedDef = {
  labelKey: 'workbench.editors.request.settings.managed.scripts',
  valueKey: 'workbench.editors.request.settings.managed.scriptsNotRun',
  descriptionKey: 'workbench.editors.request.settings.managed.scriptsNotRunDesc',
  group: 'execution',
  tokens: ['scripts'],
  testId: 'oh-managed-scripts-row',
};

const SCRIPTS_SAFE_FORWARDED_ROW: RuntimeManagedDef = {
  labelKey: 'workbench.editors.request.settings.managed.scripts',
  valueKey: 'workbench.editors.request.settings.managed.scriptsSafeForwarded',
  descriptionKey: 'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc',
  group: 'execution',
  tokens: ['scripts'],
  testId: 'oh-managed-scripts-row',
};

const MANAGED_ROWS: Record<RequestRuntimeKind, RuntimeManagedDef[]> = {
  browser: BROWSER_MANAGED,
  node: NODE_MANAGED,
};

/** Session-scoped memory of the group folds: the tab unmounts on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every request editor — a fold is a reading preference,
 *  not per-request state — and deliberately not persisted to disk. */
const sessionCollapsed: Record<string, boolean> = {};

/** Bounded interpreters + preset lists for the numeric combo knobs —
 *  free text becomes concrete candidates ("10" → "10 s" / "10 min");
 *  readings the schema would reject stay visible as disabled entries
 *  naming the violated bound. */
const interpretTimeout = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const TIMEOUT_PRESETS = numericPresets([1_000, 5_000, 10_000, 30_000, 60_000, 300_000], formatDurationMs);
const interpretResponseSize = byteSizeInterpreter({ min: MIN_RESPONSE_BYTES, max: MAX_RESPONSE_BYTES });
const SIZE_PRESETS = numericPresets(
  [256, 512, 1024, 2048, 5120, 10240].map((kb) => kb * 1024),
  formatByteSize,
);
const REDIRECT_BOUNDS = { min: MIN_MAX_REDIRECTS, max: MAX_MAX_REDIRECTS };
const REDIRECT_PRESET_VALUES = [5, 10, 20, 50];

const SettingsTab: React.FC<SettingsTabProps> = ({
  value,
  onChange,
  workspaceId = null,
  unsaved = NO_UNSAVED_SETTINGS,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const scriptMode = useScriptExecutionMode(workspaceId);
  const remoteScriptsSafe = getCapability('remoteScriptRuntime')?.() === 'safe';
  const managedRows =
    runtime === 'node' && !scriptMode.available
      ? [...MANAGED_ROWS[runtime], remoteScriptsSafe ? SCRIPTS_SAFE_FORWARDED_ROW : SCRIPTS_NOT_RUN_ROW]
      : MANAGED_ROWS[runtime];
  // Every fact popover leads with the shared example card, its slice
  // lit — the same card the live knobs use.
  const sheetRows = managedRows.map(({ tokens, ...def }) => ({ ...def, diagram: settingsExampleCard(tokens ?? []) }));
  // Redirect-cap candidates carry a localized "hops" unit, so the
  // interpreter is minted here where `t` lives rather than at module
  // scope; formatting inside the interpreter keeps the disabled
  // bound-explanation entries intact.
  const formatHops = (count: number): string => t('workbench.editors.request.settings.maxRedirectsHops', { count });
  const redirectPresets = REDIRECT_PRESET_VALUES.map((v) => ({ value: v, label: formatHops(v) }));
  const interpretHops = countInterpreter(REDIRECT_BOUNDS, formatHops);
  // Collapsible group state — all expanded by default; a collapsed
  // group's header keeps the accent dot while it hides a modified knob.
  // Folds seed from (and write back to) the session store, so a fold
  // survives the tab's unmount on every editor tab switch.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const connModified =
    (value.httpVersion !== undefined && value.httpVersion !== 'auto') ||
    value.resolveToAddress !== undefined ||
    value.proxyMode !== undefined ||
    value.proxyUrl !== undefined ||
    value.proxyCredentialRef !== undefined ||
    value.unixSocketPath !== undefined;
  // Short-circuit: past the first clause redirects are being followed,
  // so the trio rows are visible and may contribute.
  const redirectsModified =
    value.followRedirects === false ||
    value.maxRedirects !== undefined ||
    value.followOriginalHttpMethod === true ||
    value.followAuthorizationHeader === true;
  const cookiesModified = runtime === 'browser' ? value.credentialsMode === 'include' : value.cookieJar === true;
  const executionModified =
    value.timeoutMs !== undefined || value.maxResponseBytes !== undefined || scriptMode.mode === 'developer';
  // Per-group unsaved aggregation for the collapsed headers — same
  // membership as the *Modified predicates above. The script-mode knob
  // never contributes: it saves per-workspace on change, so it is
  // never "unsaved" relative to the request.
  const hasUnsaved = (...keys: SettingsKnobKey[]): boolean => keys.some((k) => unsaved.has(k));
  const connUnsaved = hasUnsaved(
    'httpVersion',
    'resolveToAddress',
    'proxyMode',
    'proxyUrl',
    'proxyCredentialRef',
    'unixSocketPath',
  );
  const redirectsUnsaved = hasUnsaved(
    'followRedirects',
    'maxRedirects',
    'followOriginalHttpMethod',
    'followAuthorizationHeader',
  );
  const cookiesUnsaved = runtime === 'browser' ? hasUnsaved('credentialsMode') : hasUnsaved('cookieJar');
  const executionUnsaved = hasUnsaved('timeoutMs', 'maxResponseBytes');

  return (
    <ConfigProvider
      theme={{
        components: {
          // An empty knob means "the default in effect" — its stated
          // default must read as live behavior, not a disabled control,
          // so placeholders render at full text contrast, exactly like
          // a set value; the tab dot and Clear affordance carry the
          // customized-vs-default distinction.
          Select: { colorTextPlaceholder: token.colorText },
          Input: { colorTextPlaceholder: token.colorText },
          InputNumber: { colorTextPlaceholder: token.colorText },
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
        {runtime === 'node' && (
          <>
            <GroupSection
              label={t('workbench.editors.request.settings.group.connection')}
              expanded={collapsed.connection !== true}
              onToggle={() => toggleGroup('connection')}
              info={settingsGroupInfo(t, 'connection')}
              modified={connModified}
              unsaved={connUnsaved}
            >
            <SelectKnobRow
              label={t('workbench.editors.request.settings.httpVersion')}
              value={value.httpVersion === 'auto' ? undefined : value.httpVersion}
              onChange={(v) => onChange({ ...value, httpVersion: v === 'auto' ? undefined : (v as HttpVersion | undefined) })}
              info={settingsRowInfo(t, 'httpVersion')}
              options={[
                { value: 'auto', label: t('workbench.editors.request.settings.httpVersionPlaceholder') },
                { value: '1.1', label: 'HTTP/1.1' },
                { value: '2', label: 'HTTP/2' },
                { value: '2-prior-knowledge', label: t('workbench.editors.request.settings.httpVersionPriorKnowledge') },
                { value: '3', label: 'HTTP/3' },
              ]}
              placeholder={t('workbench.editors.request.settings.httpVersionPlaceholder')}
              testId="oh-http-version-select"
              unsaved={unsaved.has('httpVersion')}
            />
            <DialRows
              groupLabel={t('workbench.editors.request.settings.group.connection')}
              value={value}
              onChange={(next) => onChange({ ...value, ...next })}
              rowInfo={(key) => settingsRowInfo(t, key)}
              unsaved={unsaved}
              testIdPrefix="request"
            />
            <TextKnobRow
              label={t('workbench.editors.request.settings.unixSocket')}
              value={value.unixSocketPath}
              onChange={(unixSocketPath) => onChange({ ...value, unixSocketPath })}
              info={settingsRowInfo(t, 'unixSocket')}
              placeholder={t('workbench.editors.request.settings.unixSocketPlaceholder')}
              maxLength={MAX_UNIX_SOCKET_PATH_LENGTH}
              error={
                value.unixSocketPath !== undefined && !isValidUnixSocketPath(value.unixSocketPath)
                  ? t('workbench.editors.request.settings.unixSocketError')
                  : undefined
              }
              warning={
                value.unixSocketPath !== undefined && value.proxyUrl !== undefined
                  ? t('workbench.editors.request.settings.unixSocketProxyConflict')
                  : value.unixSocketPath !== undefined && value.resolveToAddress !== undefined
                    ? t('workbench.editors.request.settings.unixSocketResolveConflict')
                    : undefined
              }
              example={t('workbench.editors.request.settings.unixSocketExample')}
              unsaved={unsaved.has('unixSocketPath')}
            />
            </GroupSection>
            <TlsTrustGroup
              groupLabel={t('workbench.editors.request.settings.group.tls')}
              groupInfo={settingsGroupInfo(t, 'tls')}
              expanded={collapsed.tls !== true}
              onToggle={() => toggleGroup('tls')}
              value={value}
              onChange={(next) => onChange({ ...value, ...next })}
              rowInfo={(key) => settingsRowInfo(t, key)}
              unsaved={unsaved}
              testIdPrefix="request"
            />
          </>
        )}
        <GroupSection
              label={t('workbench.editors.request.settings.group.redirects')}
              expanded={collapsed.redirects !== true}
              onToggle={() => toggleGroup('redirects')}
              info={settingsGroupInfo(t, 'redirects')}
              modified={redirectsModified}
              unsaved={redirectsUnsaved}
            >
        <KnobRow
          label={t('workbench.editors.request.settings.followRedirects')}
          checked={value.followRedirects ?? true}
          modified={value.followRedirects === false}
          unsaved={unsaved.has('followRedirects')}
          onReset={() => onChange({ ...value, followRedirects: undefined })}
          onChange={(checked) => onChange({ ...value, followRedirects: checked })}
          info={settingsRowInfo(t, 'followRedirects')}
        />
        {runtime === 'node' && value.followRedirects !== false && (
          <>
            <ComboKnobRow
              label={t('workbench.editors.request.settings.maxRedirects')}
              value={value.maxRedirects}
              onChange={(maxRedirects) => onChange({ ...value, maxRedirects })}
              info={settingsRowInfo(t, 'maxRedirects')}
              presets={redirectPresets}
              interpret={interpretHops}
              format={formatHops}
              placeholder={t('workbench.editors.request.settings.maxRedirectsPlaceholder')}
              unsaved={unsaved.has('maxRedirects')}
            />
            <KnobRow
              label={t('workbench.editors.request.settings.followOriginalMethod')}
              checked={value.followOriginalHttpMethod === true}
              modified={value.followOriginalHttpMethod === true}
              unsaved={unsaved.has('followOriginalHttpMethod')}
              onReset={() => onChange({ ...value, followOriginalHttpMethod: undefined })}
              onChange={(checked) => onChange({ ...value, followOriginalHttpMethod: checked || undefined })}
              info={settingsRowInfo(t, 'followOriginalMethod')}
            />
            <KnobRow
              label={t('workbench.editors.request.settings.followAuthHeader')}
              checked={value.followAuthorizationHeader === true}
              modified={value.followAuthorizationHeader === true}
              unsaved={unsaved.has('followAuthorizationHeader')}
              onReset={() => onChange({ ...value, followAuthorizationHeader: undefined })}
              onChange={(checked) => onChange({ ...value, followAuthorizationHeader: checked || undefined })}
              info={settingsRowInfo(t, 'followAuthHeader')}
              warning={t('workbench.editors.request.settings.followAuthHeaderWarning')}
              warningWhenChecked
            />
          </>
        )}
        </GroupSection>
        <GroupSection
              label={t('workbench.editors.request.settings.group.cookies')}
              expanded={collapsed.cookies !== true}
              onToggle={() => toggleGroup('cookies')}
              info={settingsGroupInfo(t, 'cookies')}
              modified={cookiesModified}
              unsaved={cookiesUnsaved}
            >
        {runtime === 'browser' && (
          <KnobRow
            label={t('workbench.editors.request.settings.sendBrowserCookies')}
            checked={value.credentialsMode === 'include'}
            modified={value.credentialsMode === 'include'}
            unsaved={unsaved.has('credentialsMode')}
            onReset={() => onChange({ ...value, credentialsMode: undefined })}
            onChange={(checked) => onChange({ ...value, credentialsMode: checked ? 'include' : undefined })}
            info={settingsRowInfo(t, 'sendBrowserCookies')}
          />
        )}
        {runtime === 'node' && (
          <>
            <KnobRow
              label={t('workbench.editors.request.settings.cookieJar')}
              checked={value.cookieJar === true}
              modified={value.cookieJar === true}
              unsaved={unsaved.has('cookieJar')}
              onReset={() => onChange({ ...value, cookieJar: undefined })}
              onChange={(checked) => onChange({ ...value, cookieJar: checked || undefined })}
              info={settingsRowInfo(t, 'cookieJar')}
            />
            <CookieJarRow />
          </>
        )}
        </GroupSection>
        <GroupSection
              label={t('workbench.editors.request.settings.group.execution')}
              expanded={collapsed.execution !== true}
              onToggle={() => toggleGroup('execution')}
              info={settingsGroupInfo(t, 'execution')}
              modified={executionModified}
              unsaved={executionUnsaved}
            >
        {runtime === 'node' && scriptMode.available && (
          <SelectKnobRow
            label={t('workbench.editors.request.settings.scriptMode')}
            value={scriptMode.mode}
            modified={scriptMode.mode === 'developer'}
            onReset={() => scriptMode.setMode('safe')}
            onChange={(v) => scriptMode.setMode(v === 'developer' ? 'developer' : 'safe')}
            info={settingsRowInfo(t, 'scriptMode')}
            options={[
              { value: 'safe', label: t('workbench.editors.request.settings.scriptModeSafe') },
              { value: 'developer', label: t('workbench.editors.request.settings.scriptModeDeveloper') },
            ]}
            allowClear={false}
            testId="oh-script-mode-select"
            warning={
              scriptMode.mode === 'developer' ? t('workbench.editors.request.settings.scriptModeWarning') : undefined
            }
          />
        )}
        <ComboKnobRow
          label={t('workbench.editors.request.settings.timeout')}
          value={value.timeoutMs}
          onChange={(timeoutMs) => onChange({ ...value, timeoutMs })}
          info={settingsRowInfo(t, 'timeout')}
          presets={TIMEOUT_PRESETS}
          interpret={interpretTimeout}
          format={formatDurationMs}
          placeholder={t('workbench.editors.request.settings.timeoutPlaceholder')}
          unsaved={unsaved.has('timeoutMs')}
        />
        {runtime === 'node' && (
          <ComboKnobRow
            label={t('workbench.editors.request.settings.responseSizeLimit')}
            value={value.maxResponseBytes}
            onChange={(maxResponseBytes) => onChange({ ...value, maxResponseBytes })}
            info={settingsRowInfo(t, 'responseSizeLimit')}
            presets={SIZE_PRESETS}
            interpret={interpretResponseSize}
            format={formatByteSize}
            placeholder={t('workbench.editors.request.settings.responseSizeLimitPlaceholder')}
            unsaved={unsaved.has('maxResponseBytes')}
          />
        )}

        </GroupSection>
        <RuntimeManagedSheet
          runtime={runtime}
          rows={sheetRows}
          groupOrder={GROUP_ORDER}
          groupLabel={(group) => t(GROUP_LABEL_KEY[group])}
          groupInfo={(group) => settingsGroupInfo(t, group)}
          expanded={(group) => collapsed[`sheet-${group}`] !== true}
          onToggle={(group) => toggleGroup(`sheet-${group}`)}
        />
      </div>
    </ConfigProvider>
  );
};

export default SettingsTab;
