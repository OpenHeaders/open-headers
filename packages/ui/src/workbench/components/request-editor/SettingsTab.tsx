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
import { Button, Switch, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { getCapability, type RequestRuntimeKind } from '@openheaders/core/capabilities';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

export interface RequestSettingsDraft {
  /** Undefined treated as 'omit' (default). */
  credentialsMode?: 'omit' | 'include';
  /** Whether the fetch call follows redirects. Defaults to true. */
  followRedirects?: boolean;
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
    label: 'HTTP version',
    value: '1.1',
    description:
      'Requests go over HTTP/1.1. The app’s Node fetch stack does not negotiate HTTP/2 or HTTP/3, and no version selector is exposed.',
  },
  {
    label: 'SSL certificate verification',
    value: 'On',
    description:
      'Certificates are verified against the runtime’s trusted CA store. A request to a host with an invalid or self-signed certificate fails; verification cannot be disabled per request.',
  },
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
    label: 'Follow original HTTP method',
    value: 'Off',
    description:
      'On a 301/302 redirect POST switches to GET, and a 303 switches any non-GET method to GET, per the fetch spec. 307/308 always preserve the method.',
  },
  {
    label: 'Follow Authorization header',
    value: 'Off',
    description:
      'The Authorization header is stripped when a redirect crosses to a different origin; this safety behavior is not overridable.',
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
  {
    label: 'Maximum redirects',
    value: '20',
    description:
      'The fetch pipeline caps the redirect chain at 20 hops. A per-request cap is not exposed; switch off automatic redirects to inspect a chain hop by hop.',
  },
  {
    label: 'TLS/SSL protocol versions',
    value: '1.2–1.3',
    description: 'The runtime enables TLS 1.2 and 1.3 by default; per-request selection is not exposed.',
  },
  {
    label: 'TLS cipher suites',
    value: 'Runtime',
    description:
      'Cipher negotiation uses the runtime’s default suite list; neither the list nor its order is configurable per request.',
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
 *  right-aligned with Enabled/Disabled state text inside the track. */
const KnobRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  info: string;
}> = ({ label, checked, onChange, info }) => (
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

const SettingsTab: React.FC<SettingsTabProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const [showRuntimeManaged, setShowRuntimeManaged] = useState(false);
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const sheet = MANAGED_SHEETS[runtime];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
      <KnobRow
        label="Automatically follow redirects"
        checked={value.followRedirects ?? true}
        onChange={(checked) => onChange({ ...value, followRedirects: checked })}
        info="Follow HTTP 3xx responses to their target. Switch off to stop at the redirect itself — the response shows as an opaque redirect with no headers or body, useful to confirm that a redirect happens at all."
      />
      {runtime === 'browser' && (
        <KnobRow
          label="Send browser cookies"
          checked={value.credentialsMode === 'include'}
          onChange={(checked) => onChange({ ...value, credentialsMode: checked ? 'include' : undefined })}
          info="Attach the browser's existing cookies for the target site to this request. Off is the safe default: the request is sent with no cookies, so results don't depend on your logged-in browser state."
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
