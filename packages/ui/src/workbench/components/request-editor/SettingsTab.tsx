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
 *     ride, so the knob is hidden there and the cookie fact moves into
 *     the managed sheet.
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
 *   • `allowHttp2` — node-runtime only: the node transport's dispatcher
 *     offers h2 alongside http/1.1 in the ALPN list on secure
 *     connections; the SERVER picks the protocol, and plain http://
 *     stays HTTP/1.1 (no h2c). An honest boolean — there is no
 *     force-h2 mode — and pure configuration: not trust-relaxing, no
 *     response marker. The browser negotiates protocol on its own, so
 *     there 'HTTP version' stays a browser-managed fact row.
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
 *   • `proxyUrl` / `proxyCredentialRef` — node-runtime only: the node
 *     transport tunnels the send through the HTTP(S) proxy with
 *     CONNECT, so end-to-end TLS and certificate verification still
 *     run against the target. Credentials ride a vault string entry
 *     (`user:password`) picked by name, never the URL — the runtime
 *     would honor `user:pass@` userinfo, which is exactly why the
 *     schema rejects it (secrets must not land in synced YAML).
 *     SOCKS schemes are rejected. Not honorable together with
 *     `resolveToAddress` (the proxy resolves the hostname itself) —
 *     the row warns in place while both are set and the transport
 *     fails the send loudly. Not trust-relaxing, no response marker,
 *     no fact row on either sheet. The browser routes through its own
 *     proxy settings, so there is no browser control. The credentials
 *     row hides while no proxy URL is set (nothing to authenticate
 *     against), matching the dot rule: a hidden knob contributes no
 *     tab dot.
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
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select, Switch, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { getCapability, type RequestRuntimeKind } from '@openheaders/core/capabilities';
import {
  isValidProxyUrl,
  MAX_MAX_REDIRECTS,
  MAX_PROXY_URL_LENGTH,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_RESOLVE_TO_ADDRESS_LENGTH,
  MAX_RESPONSE_BYTES,
  MAX_TLS_CIPHER_SUITES_LENGTH,
  MIN_MAX_REDIRECTS,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_RESPONSE_BYTES,
  RESOLVE_TO_ADDRESS_PATTERN,
  TLS_CIPHER_SUITES_PATTERN,
  TLS_VERSIONS,
} from '@openheaders/core/schemas';
import type { TlsVersion } from '@openheaders/core/types';
import { useVaultContext } from '@openheaders/ui/context';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

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
  /** Offer HTTP/2 on secure connections (the server picks the
   *  protocol). Defaults to false = HTTP/1.1 only. Node runtimes only. */
  allowHttp2?: boolean;
  /** IPv4/IPv6 address the URL's hostname resolves to at connect time;
   *  SNI / Host / cert verification keep the original hostname.
   *  Undefined = system DNS. Node runtimes only. */
  resolveToAddress?: string;
  /** Name of a vault client-certificate entry presented during the TLS
   *  handshake. Undefined = no client certificate. Node runtimes only. */
  clientCertificateRef?: string;
  /** HTTP(S) proxy URL the send tunnels through. Undefined = direct
   *  connection. Node runtimes only. */
  proxyUrl?: string;
  /** Name of a vault string entry holding the proxy's `user:password`.
   *  Undefined = unauthenticated proxy. Node runtimes only. */
  proxyCredentialRef?: string;
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
}

interface RuntimeManagedDef {
  label: string;
  /** Effective behavior shown in the muted value column. */
  value: string;
  description: string;
}

const BROWSER_MANAGED: RuntimeManagedDef[] = [
  {
    label: 'HTTP version',
    value: 'Auto',
    description:
      'The browser negotiates HTTP/1.1, HTTP/2, or HTTP/3 per connection; the fetch API does not expose a version selector.',
  },
  {
    label: 'SSL certificate verification',
    value: 'On',
    description:
      'Certificates are verified by browser policy. A request to a host with an invalid certificate fails; verification cannot be disabled per request.',
  },
  {
    label: 'Follow original HTTP method',
    value: 'Off',
    description:
      'On a 301/302/303 redirect the browser switches non-GET methods to GET per the fetch spec. 307/308 always preserve the method.',
  },
  {
    label: 'Follow Authorization header',
    value: 'Off',
    description:
      'The browser strips the Authorization header when a redirect crosses to a different origin; this safety behavior is not overridable.',
  },
  {
    label: 'Remove Referer header on redirect',
    value: 'Policy',
    description: 'Referer handling across redirects follows the browser referrer policy for the extension context.',
  },
  {
    label: 'Strict HTTP parser',
    value: 'On',
    description: 'The browser network stack always rejects malformed response headers; there is no lenient mode.',
  },
  {
    label: 'Encode URL automatically',
    value: 'On',
    description:
      'The URL path and query are percent-encoded by the URL parser before the request goes on the wire. Type already-encoded sequences to keep them verbatim.',
  },
  {
    label: 'Server cipher suite order',
    value: 'Browser',
    description: 'TLS cipher negotiation is owned by the browser; neither suite list nor order is configurable.',
  },
  {
    label: 'Maximum redirects',
    value: '~20',
    description:
      'The fetch API caps the redirect chain at about 20 hops. A per-request cap is not implementable: manual redirect mode returns an opaque response with no headers to follow.',
  },
  {
    label: 'TLS/SSL protocol versions',
    value: 'Browser',
    description: 'Enabled TLS protocol versions are fixed by the browser; per-request selection is not exposed.',
  },
];

const NODE_MANAGED: RuntimeManagedDef[] = [
  {
    label: 'Cookies',
    value: 'Not sent',
    description:
      'The runtime has no cookie jar, so no cookies are attached automatically and Set-Cookie responses are not stored between requests. Add a Cookie header to send one explicitly.',
  },
  {
    label: 'Referer header',
    value: 'Not sent',
    description:
      'The runtime has no page context, so no Referer goes on the wire unless you add one as a header yourself.',
  },
  {
    label: 'Strict HTTP parser',
    value: 'On',
    description: 'The runtime’s HTTP parser rejects malformed response headers; there is no lenient mode.',
  },
  {
    label: 'Encode URL automatically',
    value: 'On',
    description:
      'The URL path and query are percent-encoded by the URL parser before the request goes on the wire. Type already-encoded sequences to keep them verbatim.',
  },
];

interface RuntimeManagedSheet {
  rows: RuntimeManagedDef[];
  /** Noun on the reveal toggle: "N <noun>" / "Hide <noun> settings". */
  noun: string;
  /** Kicker on each row's info popover. */
  kicker: string;
  /** Intro line above the read-only rows. */
  intro: string;
}

const MANAGED_SHEETS: Record<RequestRuntimeKind, RuntimeManagedSheet> = {
  browser: {
    rows: BROWSER_MANAGED,
    noun: 'browser-managed',
    kicker: 'Browser-managed',
    intro: 'Fixed by the browser for every request sent from an extension — shown so you know what is not negotiable.',
  },
  node: {
    rows: NODE_MANAGED,
    noun: 'runtime-managed',
    kicker: 'Runtime-managed',
    intro: 'Fixed by the app’s network runtime for every request — shown so you know what is not negotiable.',
  },
};

/** Compact wired-knob row: label + (i) left-aligned, the switch
 *  right-aligned with Enabled/Disabled state text inside the track.
 *  `warning` renders under the row while the knob sits in its risky
 *  position — off by default (verification-style knobs), the checked
 *  state when `warningWhenChecked` (opt-in trust-relaxing knobs) — so
 *  the risk is stated in place, not only behind the popover. */
const KnobRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  info: string;
  warning?: string;
  warningWhenChecked?: boolean;
}> = ({ label, checked, onChange, info, warning, warningWhenChecked }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <InfoTrigger content={{ title: label, summary: info }} />
      <span style={{ flex: 1 }} />
      <Switch
        size="small"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        checkedChildren="Enabled"
        unCheckedChildren="Disabled"
      />
    </div>
    {checked === (warningWhenChecked ?? false) && warning !== undefined && (
      <Text type="warning" style={{ fontSize: 11, marginBottom: 4 }}>
        {warning}
      </Text>
    )}
  </div>
);

/** Compact numeric-knob row: same `label · (i) · control` geometry as
 *  {@link KnobRow}, with an InputNumber (unit suffix, bounded) instead
 *  of a switch. An empty field means "no explicit value" — the
 *  placeholder states the effective behavior ("No limit", the default
 *  cap) so the empty state is never ambiguous. */
const NumericKnobRow: React.FC<{
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  info: string;
  /** Unit suffix inside the field; omit for unitless counts. */
  unit?: string;
  min: number;
  max: number;
  placeholder: string;
}> = ({ label, value, onChange, info, unit, min, max, placeholder }) => (
  <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
    <Text style={{ fontSize: 13 }}>{label}</Text>
    <InfoTrigger content={{ title: label, summary: info }} />
    <span style={{ flex: 1 }} />
    <InputNumber
      size="small"
      aria-label={label}
      value={value ?? null}
      onChange={(v) => onChange(typeof v === 'number' ? Math.round(v) : undefined)}
      min={min}
      max={max}
      precision={0}
      controls={false}
      placeholder={placeholder}
      suffix={unit}
      style={{ width: 148 }}
    />
  </div>
);

/** Compact picklist-knob row: same `label · (i) · control` geometry as
 *  {@link KnobRow}, with a clearable Select. An empty select means "no
 *  explicit value" — the placeholder states the runtime default so the
 *  empty state is never ambiguous. `warning` renders under the row
 *  while the selected value is a risky one (the caller decides). */
const SelectKnobRow: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  info: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder: string;
  warning?: string;
}> = ({ label, value, onChange, info, options, placeholder, warning }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <InfoTrigger content={{ title: label, summary: info }} />
      <span style={{ flex: 1 }} />
      <Select
        size="small"
        aria-label={label}
        value={value}
        onChange={(v) => onChange(v)}
        options={options}
        allowClear
        placeholder={placeholder}
        style={{ width: 148 }}
      />
    </div>
    {warning !== undefined && (
      <Text type="warning" style={{ fontSize: 11, marginBottom: 4 }}>
        {warning}
      </Text>
    )}
  </div>
);

/** Compact text-knob row: same geometry, with a wider free-text input.
 *  Empty means "no explicit value" — the placeholder states the
 *  effective default. `error` renders under the row (and tints the
 *  field) while the current text is malformed; `warning` renders under
 *  the row while the value is well-formed but conflicts with another
 *  setting (error wins when both apply). */
const TextKnobRow: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  info: string;
  placeholder: string;
  maxLength: number;
  error?: string;
  warning?: string;
}> = ({ label, value, onChange, info, placeholder, maxLength, error, warning }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <InfoTrigger content={{ title: label, summary: info }} />
      <span style={{ flex: 1 }} />
      <Input
        size="small"
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        status={error !== undefined ? 'error' : undefined}
        style={{ width: 220 }}
      />
    </div>
    {error !== undefined && (
      <Text type="danger" style={{ fontSize: 11, marginBottom: 4 }}>
        {error}
      </Text>
    )}
    {error === undefined && warning !== undefined && (
      <Text type="warning" style={{ fontSize: 11, marginBottom: 4 }}>
        {warning}
      </Text>
    )}
  </div>
);

const RuntimeManagedRow: React.FC<RuntimeManagedDef & { kicker: string }> = ({
  label,
  value,
  description,
  kicker,
}) => {
  const { token } = theme.useToken();
  return (
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}>
      <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</Text>
      <InfoTrigger content={{ title: label, kicker, summary: description }} />
      <span style={{ flex: 1 }} />
      <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>{value}</Text>
    </div>
  );
};

/** Position of a version token in the ordered {@link TLS_VERSIONS}
 *  list — the min/max selects disable options outside the window the
 *  OTHER select already pinned, so min ≤ max holds by construction. */
const tlsVersionRank = (version: TlsVersion): number => TLS_VERSIONS.indexOf(version);

const SettingsTab: React.FC<SettingsTabProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const [showRuntimeManaged, setShowRuntimeManaged] = useState(false);
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const sheet = MANAGED_SHEETS[runtime];
  // Vault client-certificate entries feed the picker's options. The
  // context defaults to an empty vault when no provider is mounted, so
  // the tab stays renderable everywhere.
  const { vault } = useVaultContext();
  const clientCertificateOptions = vault.secrets
    .filter((s) => s.kind === 'client-certificate')
    .map((s) => ({ value: s.name, label: s.name }));
  const clientCertificateRefDangling =
    value.clientCertificateRef !== undefined &&
    !clientCertificateOptions.some((o) => o.value === value.clientCertificateRef);
  // Vault string entries feed the proxy-credentials picker — a
  // `user:password` pair is string-shaped, no dedicated entry kind.
  const proxyCredentialOptions = vault.secrets
    .filter((s) => s.kind === 'string')
    .map((s) => ({ value: s.name, label: s.name }));
  const proxyCredentialRefDangling =
    value.proxyCredentialRef !== undefined &&
    !proxyCredentialOptions.some((o) => o.value === value.proxyCredentialRef);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
      <KnobRow
        label="Automatically follow redirects"
        checked={value.followRedirects ?? true}
        onChange={(checked) => onChange({ ...value, followRedirects: checked })}
        info="Follow HTTP 3xx responses to their target. Switch off to stop at the redirect itself — the response shows as an opaque redirect with no headers or body, useful to confirm that a redirect happens at all."
      />
      {runtime === 'node' && value.followRedirects !== false && (
        <>
          <NumericKnobRow
            label="Maximum redirects"
            value={value.maxRedirects}
            onChange={(maxRedirects) => onChange({ ...value, maxRedirects })}
            info="How many redirects a send may follow before failing with an error naming the limit. Leave empty for the default of 20. Set 0 to fail on any redirect at all."
            min={MIN_MAX_REDIRECTS}
            max={MAX_MAX_REDIRECTS}
            placeholder="20"
          />
          <KnobRow
            label="Follow original HTTP method"
            checked={value.followOriginalHttpMethod === true}
            onChange={(checked) => onChange({ ...value, followOriginalHttpMethod: checked || undefined })}
            info="Keep the original method and body when a 301, 302, or 303 redirect would normally switch the request to GET. 307 and 308 redirects always keep the method either way."
          />
          <KnobRow
            label="Follow Authorization header"
            checked={value.followAuthorizationHeader === true}
            onChange={(checked) => onChange({ ...value, followAuthorizationHeader: checked || undefined })}
            info="Keep the Authorization header when a redirect crosses to a different origin. Normally it is dropped on a cross-origin hop so credentials never travel to a host the request didn't address."
            warning="Credentials travel to whatever host the redirect chain lands on. A response whose chain actually crossed origins is marked."
            warningWhenChecked
          />
        </>
      )}
      {runtime === 'browser' && (
        <KnobRow
          label="Send browser cookies"
          checked={value.credentialsMode === 'include'}
          onChange={(checked) => onChange({ ...value, credentialsMode: checked ? 'include' : undefined })}
          info="Attach the browser's existing cookies for the target site to this request. Off is the safe default: the request is sent with no cookies, so results don't depend on your logged-in browser state."
        />
      )}
      {runtime === 'node' && (
        <>
          <KnobRow
            label="SSL certificate verification"
            checked={value.sslVerification !== false}
            onChange={(checked) => onChange({ ...value, sslVerification: checked })}
            info="Verify the server's TLS certificate against the runtime's trusted CA store. A host with a self-signed, expired, or otherwise untrusted certificate fails with a TLS certificate error — switch verification off to reach it anyway, e.g. a development server with a self-signed certificate."
            warning="Sends skip the server identity check — any certificate is accepted, including self-signed and expired ones. The response is marked as unverified."
          />
          <SelectKnobRow
            label="TLS version minimum"
            value={value.tlsMinVersion}
            onChange={(v) => onChange({ ...value, tlsMinVersion: v as TlsVersion | undefined })}
            info="Lowest TLS protocol version a send may negotiate. Leave empty for the runtime default of TLS 1.2. Choosing 1.0 or 1.1 lowers the floor below the default to reach legacy servers — a response sent with a lowered floor is marked."
            options={TLS_VERSIONS.map((v) => ({
              value: v,
              label: v,
              disabled: value.tlsMaxVersion !== undefined && tlsVersionRank(v) > tlsVersionRank(value.tlsMaxVersion),
            }))}
            placeholder="1.2 (default)"
            warning={
              value.tlsMinVersion === '1.0' || value.tlsMinVersion === '1.1'
                ? 'Sends may negotiate TLS below 1.2 — protocol versions with known weaknesses. The response is marked.'
                : undefined
            }
          />
          <SelectKnobRow
            label="TLS version maximum"
            value={value.tlsMaxVersion}
            onChange={(v) => onChange({ ...value, tlsMaxVersion: v as TlsVersion | undefined })}
            info="Highest TLS protocol version a send may negotiate. Leave empty for the runtime default of TLS 1.3. Lower it to check how a server behaves on an older protocol — the minimum may need lowering too, or the two won't overlap."
            options={TLS_VERSIONS.map((v) => ({
              value: v,
              label: v,
              disabled: value.tlsMinVersion !== undefined && tlsVersionRank(v) < tlsVersionRank(value.tlsMinVersion),
            }))}
            placeholder="1.3 (default)"
          />
          <TextKnobRow
            label="TLS cipher suites"
            value={value.tlsCipherSuites}
            onChange={(tlsCipherSuites) => onChange({ ...value, tlsCipherSuites })}
            info="Cipher suites offered during the TLS handshake, as a colon-separated OpenSSL-format list — TLS 1.3 suite names and older suite names both go in the one list. Leave empty to offer the runtime's default suites. The server picks the suite from what is offered, in its own preference order."
            placeholder="Runtime default suites"
            maxLength={MAX_TLS_CIPHER_SUITES_LENGTH}
            error={
              value.tlsCipherSuites !== undefined && !TLS_CIPHER_SUITES_PATTERN.test(value.tlsCipherSuites)
                ? 'Colon-separated OpenSSL suite names only — no spaces.'
                : undefined
            }
          />
          <KnobRow
            label="Allow HTTP/2"
            checked={value.allowHttp2 === true}
            onChange={(checked) => onChange({ ...value, allowHttp2: checked || undefined })}
            info="Offer HTTP/2 alongside HTTP/1.1 when connecting over https — the server picks the protocol from the offer, so a server without HTTP/2 support still answers over HTTP/1.1. Plain http:// requests always use HTTP/1.1. Off, requests are sent over HTTP/1.1 only."
          />
          <TextKnobRow
            label="Resolve to address"
            value={value.resolveToAddress}
            onChange={(resolveToAddress) => onChange({ ...value, resolveToAddress })}
            info="Send this request to a specific server address instead of whatever DNS answers — the URL's hostname is still used for TLS and the Host header, so with verification on the certificate must still match it. Useful to test one specific backend behind a load balancer. The URL keeps its own port, and a redirect to another host also lands on this address. Leave empty to resolve through DNS as usual."
            placeholder="System DNS"
            maxLength={MAX_RESOLVE_TO_ADDRESS_LENGTH}
            error={
              value.resolveToAddress !== undefined && !RESOLVE_TO_ADDRESS_PATTERN.test(value.resolveToAddress)
                ? 'IPv4 or IPv6 address only — no hostname, no port.'
                : undefined
            }
          />
          <SelectKnobRow
            label="Client certificate"
            value={value.clientCertificateRef}
            onChange={(clientCertificateRef) => onChange({ ...value, clientCertificateRef })}
            info="Present a client certificate during the TLS handshake, for APIs behind mutual-TLS gateways that authenticate the caller by certificate. Pick a certificate entry from the vault — the request saves only the entry's name, and each device presents its own vault entry of that name; the certificate and key never leave the vault. Leave empty to connect without a client certificate."
            options={clientCertificateOptions}
            placeholder="No client certificate"
            warning={
              clientCertificateRefDangling
                ? `No vault certificate entry named "${value.clientCertificateRef}" on this device — sends will fail until the entry exists or this setting is cleared.`
                : undefined
            }
          />
          <TextKnobRow
            label="Proxy"
            value={value.proxyUrl}
            onChange={(proxyUrl) =>
              onChange(
                // Clearing the proxy URL also clears its credentials —
                // they have nothing to authenticate against, and a
                // hidden row must not keep a stale ref alive.
                proxyUrl === undefined ? { ...value, proxyUrl, proxyCredentialRef: undefined } : { ...value, proxyUrl },
              )
            }
            info="Route this request through an HTTP(S) proxy instead of connecting directly. The connection to the target tunnels through the proxy, so an https exchange stays end-to-end encrypted and certificate verification still runs against the target. SOCKS proxies are not supported. Credentials go in the 'Proxy credentials' setting below, never in this URL. Leave empty for a direct connection."
            placeholder="No proxy — direct connection"
            maxLength={MAX_PROXY_URL_LENGTH}
            error={
              value.proxyUrl !== undefined && !isValidProxyUrl(value.proxyUrl)
                ? 'http:// or https:// URL with host and port only — no credentials in the URL, no SOCKS.'
                : undefined
            }
            warning={
              value.proxyUrl !== undefined && value.resolveToAddress !== undefined
                ? 'Also sets resolve-to-address, but a proxy resolves the hostname itself — sends will fail until one of the two is cleared.'
                : undefined
            }
          />
          {value.proxyUrl !== undefined && (
            <SelectKnobRow
              label="Proxy credentials"
              value={value.proxyCredentialRef}
              onChange={(proxyCredentialRef) => onChange({ ...value, proxyCredentialRef })}
              info="Authenticate against the proxy with credentials from the vault, as user:password in a string entry. The request saves only the entry's name, and each device resolves it against its own local vault — the credentials never leave the vault and are sent only to the proxy, never to the target. Leave empty for a proxy that needs no authentication."
              options={proxyCredentialOptions}
              placeholder="No authentication"
              warning={
                proxyCredentialRefDangling
                  ? `No vault string entry named "${value.proxyCredentialRef}" on this device — sends will fail until the entry exists or this setting is cleared.`
                  : undefined
              }
            />
          )}
        </>
      )}
      <NumericKnobRow
        label="Request timeout"
        value={value.timeoutMs}
        onChange={(timeoutMs) => onChange({ ...value, timeoutMs })}
        info="Maximum time the whole request may take — connecting, waiting for the response, and reading the body. When the limit elapses the send is aborted and fails with a timeout error naming it. Leave empty for no per-request limit; only the network stack's own timeouts apply."
        unit="ms"
        min={MIN_REQUEST_TIMEOUT_MS}
        max={MAX_REQUEST_TIMEOUT_MS}
        placeholder="No limit"
      />
      {runtime === 'node' && (
        <NumericKnobRow
          label="Response size limit"
          value={value.maxResponseBytes !== undefined ? Math.round(value.maxResponseBytes / 1024) : undefined}
          onChange={(kb) => onChange({ ...value, maxResponseBytes: kb !== undefined ? kb * 1024 : undefined })}
          info="Maximum response body size read off the wire; anything past it is cut off and the response is marked as truncated. Leave empty for the default limit of 2,048 KB (2 MB). Raise it up to 10,240 KB (10 MB) for larger payloads, or lower it to test how a truncated response looks."
          unit="KB"
          min={MIN_RESPONSE_BYTES / 1024}
          max={MAX_RESPONSE_BYTES / 1024}
          placeholder="2048"
        />
      )}

      <div style={{ marginTop: 8 }}>
        <Button
          size="small"
          type="text"
          icon={showRuntimeManaged ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => setShowRuntimeManaged((s) => !s)}
          style={{ color: token.colorTextSecondary, fontSize: 12 }}
        >
          {showRuntimeManaged ? `Hide ${sheet.noun} settings` : `${sheet.rows.length} ${sheet.noun}`}
        </Button>
      </div>
      {showRuntimeManaged && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '6px 10px',
            borderRadius: 6,
            background: token.colorFillQuaternary,
          }}
        >
          <Text style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>{sheet.intro}</Text>
          {sheet.rows.map((def) => (
            <RuntimeManagedRow key={def.label} {...def} kicker={sheet.kicker} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
