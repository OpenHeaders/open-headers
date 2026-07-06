/**
 * SettingsTab — per-request HTTP knobs.
 *
 * Only two knobs are actually wired to the executor; they render as
 * compact `control · label · (i)` rows with the explanation behind the
 * standard InfoTrigger popover:
 *   • `followRedirects` — maps to `RequestInit.redirect` so the user
 *     can surface intermediate 3xx responses (as `opaqueredirect`)
 *     instead of chasing them to the final target.
 *   • `credentialsMode` — "Send browser cookies" (`'include'`); off
 *     (`undefined`/`'omit'`) is the safe default.
 *
 * Everything else a request-settings surface traditionally exposes
 * (HTTP version, TLS policy, redirect internals, URL encoding, …) is
 * browser-controlled end-to-end in an MV3 extension. Those render as
 * read-only label/value rows behind a "N browser-managed" reveal
 * toggle — same affordance the Headers tab uses for auto-generated
 * headers — so the two real knobs aren't buried in inert controls.
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Switch, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
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

interface BrowserManagedDef {
  label: string;
  /** Effective behavior shown in the muted value column. */
  value: string;
  description: string;
}

const BROWSER_MANAGED: BrowserManagedDef[] = [
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

const BrowserManagedRow: React.FC<BrowserManagedDef> = ({ label, value, description }) => {
  const { token } = theme.useToken();
  return (
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}>
      <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</Text>
      <InfoTrigger content={{ title: label, kicker: 'Browser-managed', summary: description }} />
      <span style={{ flex: 1 }} />
      <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>{value}</Text>
    </div>
  );
};

const SettingsTab: React.FC<SettingsTabProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const [showBrowserManaged, setShowBrowserManaged] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
      <KnobRow
        label="Automatically follow redirects"
        checked={value.followRedirects ?? true}
        onChange={(checked) => onChange({ ...value, followRedirects: checked })}
        info="Follow HTTP 3xx responses to their target. Switch off to stop at the redirect itself — the response shows as an opaque redirect with no headers or body, useful to confirm that a redirect happens at all."
      />
      <KnobRow
        label="Send browser cookies"
        checked={value.credentialsMode === 'include'}
        onChange={(checked) => onChange({ ...value, credentialsMode: checked ? 'include' : undefined })}
        info="Attach the browser's existing cookies for the target site to this request. Off is the safe default: the request is sent with no cookies, so results don't depend on your logged-in browser state."
      />

      <div style={{ marginTop: 8 }}>
        <Button
          size="small"
          type="text"
          icon={showBrowserManaged ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => setShowBrowserManaged((s) => !s)}
          style={{ color: token.colorTextSecondary, fontSize: 12 }}
        >
          {showBrowserManaged ? 'Hide browser-managed settings' : `${BROWSER_MANAGED.length} browser-managed`}
        </Button>
      </div>
      {showBrowserManaged && (
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
          <Text style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>
            Fixed by the browser for every request sent from an extension — shown so you know what is not negotiable.
          </Text>
          {BROWSER_MANAGED.map((def) => (
            <BrowserManagedRow key={def.label} {...def} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
