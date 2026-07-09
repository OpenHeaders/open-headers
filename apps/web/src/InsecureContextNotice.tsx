/**
 * Rendered INSTEAD of booting when the tab is not a secure context —
 * a plain-http origin that isn't loopback. The web platform withholds
 * `crypto.subtle` / `crypto.randomUUID` there, so the tab oracle
 * cannot mint its identity or derive UUIDs; rather than dying on a
 * blank page, explain the two supported ways in.
 */

const WRAP_STYLE: React.CSSProperties = {
  maxWidth: 460,
  margin: '18vh auto 0',
  padding: '32px 36px',
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.6,
};

export function InsecureContextNotice(): React.JSX.Element {
  return (
    <div style={WRAP_STYLE} data-testid="insecure-context-notice">
      <h3 style={{ marginTop: 0 }}>This page needs a secure connection</h3>
      <p>
        The OpenHeaders Workbench keeps all of its data in this browser profile and needs the browser's cryptography
        APIs, which are only available on secure origins.
      </p>
      <p>Open it one of these ways instead:</p>
      <ul>
        <li>
          Over HTTPS — put the daemon behind a TLS reverse proxy (see “Behind a reverse proxy” in the daemon's README)
          and open <code>https://&lt;your-host&gt;/</code>.
        </li>
        <li>
          On the daemon's own machine at <code>http://127.0.0.1:&lt;port&gt;/</code>.
        </li>
      </ul>
    </div>
  );
}
