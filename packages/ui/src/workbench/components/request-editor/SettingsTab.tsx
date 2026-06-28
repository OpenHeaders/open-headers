/**
 * SettingsTab — per-request HTTP knobs. Matches the column-based
 * "Label · Help text · Control" rows of a dedicated request-settings
 * surface. Today only a subset of the knobs are actually wired to the
 * executor (the browser manages the rest); read-only rows render as
 * `Default` tagged so the user sees what is negotiable versus
 * browser-controlled.
 *
 * Wired knobs:
 *   • `credentialsMode` — flips the Disable cookie jar toggle
 *     (`undefined`/`'omit'` = disabled; `'include'` = cookie jar on).
 *   • `followRedirects` — maps to `RequestInit.redirect` so the user
 *     can surface intermediate 3xx responses (as `opaqueredirect`)
 *     instead of chasing them to the final target.
 *
 * Read-only knobs (rendered for parity with the wider tooling
 * ecosystem; browser-controlled end-to-end):
 *   • HTTP version — `Auto`. Controlled by the fetch API.
 *   • SSL certificate verification — browser policy; not toggleable.
 *   • Follow original HTTP Method, Follow Authorization header,
 *     Remove referer header on redirect, Strict HTTP parser, Encode
 *     URL automatically, Server cipher suite, Maximum redirects
 *     (browser caps at ~20; fetch's `redirect: 'manual'` yields
 *     `opaqueredirect` with no headers, so a manual follow loop is
 *     not implementable from MV3 fetch), TLS/SSL protocols disabled,
 *     Cipher suite selection — all browser-controlled; surfaced for
 *     completeness.
 */

import { Input, Select, Switch, Typography, theme } from 'antd';
import type React from 'react';

const { Text, Link } = Typography;

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

const Row: React.FC<{
  label: string;
  description?: string;
  control: React.ReactNode;
  defaultLink?: string;
  readOnly?: boolean;
}> = ({ label, description, control, defaultLink, readOnly }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 220px',
        alignItems: 'start',
        gap: 24,
        padding: '14px 0',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong style={{ fontSize: 13 }}>
            {label}
          </Text>
          {readOnly && (
            <span
              style={{
                fontSize: 10,
                padding: '0 6px',
                borderRadius: 10,
                background: token.colorBgContainerDisabled,
                color: token.colorTextTertiary,
              }}
            >
              browser-controlled
            </span>
          )}
        </div>
        {description && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
            {description}
          </Text>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {control}
        {defaultLink && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Default: <Link style={{ fontSize: 11 }}>{defaultLink}</Link>
          </Text>
        )}
      </div>
    </div>
  );
};

const SettingsTab: React.FC<SettingsTabProps> = ({ value, onChange }) => {
  const cookieJarDisabled = value.credentialsMode !== 'include';
  const followRedirects = value.followRedirects ?? true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Row
        label="HTTP version"
        description="Select the HTTP version to use for sending the request."
        control={
          <Select size="small" value="auto" options={[{ value: 'auto', label: 'Auto' }]} style={{ width: 140 }} />
        }
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Enable SSL certificate verification"
        description="Verify SSL certificates when sending a request. Verification failures will result in the request being aborted."
        control={<Switch size="small" checked disabled />}
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Automatically follow redirects"
        description="Follow HTTP 3xx responses as redirects."
        control={
          <Switch
            size="small"
            aria-label="Automatically follow redirects"
            checked={followRedirects}
            onChange={(checked) => onChange({ ...value, followRedirects: checked })}
          />
        }
        defaultLink="Settings"
      />
      <Row
        label="Follow original HTTP Method"
        description="Redirect with the original HTTP method instead of the default behavior of redirecting with GET."
        control={<Switch size="small" checked={false} disabled />}
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Follow Authorization header"
        description="Retain authorization header when a redirect happens to a different hostname."
        control={<Switch size="small" checked={false} disabled />}
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Remove referer header on redirect"
        description="Remove the referer header when a redirect happens."
        control={<Switch size="small" checked={false} disabled />}
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Enable strict HTTP parser"
        description="Restrict responses with invalid HTTP headers."
        control={<Switch size="small" checked={false} disabled />}
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Encode URL automatically"
        description="Encode the URL's path, query parameters, and authentication fields."
        control={<Switch size="small" checked disabled />}
        defaultLink="Settings"
        readOnly
      />
      <Row
        label="Disable cookie jar"
        description={
          cookieJarDisabled
            ? 'Requests send with no cookies attached — the safe default. Flip off to include browser cookies.'
            : 'Existing cookies in the cookie jar will be attached to this request.'
        }
        control={
          <Switch
            size="small"
            aria-label="Disable cookie jar"
            checked={cookieJarDisabled}
            onChange={(checked) => onChange({ ...value, credentialsMode: checked ? undefined : 'include' })}
          />
        }
        defaultLink="Settings"
      />
      <Row
        label="Use server cipher suite during handshake"
        description="Use the server's cipher suite order instead of the client's during handshake."
        control={<Switch size="small" checked={false} disabled />}
        readOnly
      />
      <Row
        label="Maximum number of redirects"
        description="Browser fetch() caps the redirect chain at ~20 and returns opaqueredirect when manual mode is requested, so a per-request cap is not exposable from MV3."
        control={<Input size="small" disabled value="Browser default (~20)" style={{ width: 200 }} />}
        readOnly
      />
      <Row
        label="TLS/SSL protocols disabled during handshake"
        description="Specify the SSL and TLS protocol versions to be disabled during handshake. All other protocols will be enabled."
        control={<Input size="small" disabled placeholder="" style={{ width: 200 }} />}
        readOnly
      />
      <Row
        label="Cipher suite selection"
        description="Order of cipher suites that the SSL server profile uses to establish a secure connection."
        control={<Input size="small" disabled placeholder="Enter cipher suites" style={{ width: 200 }} />}
        readOnly
      />
    </div>
  );
};

export default SettingsTab;
