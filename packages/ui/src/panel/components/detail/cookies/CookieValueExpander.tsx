/**
 * Inline value expander. Rendered as a second `<tr>` spanning all
 * columns when the row is expanded.
 *
 * For values with "depth" — JWT, JSON, base64, percent-encoded — it
 * shows the decoded / parsed view, with a Decoded / Raw toggle so the
 * original encoded value is one click away. For plain values it shows the
 * full raw value, wrapped, so a long value the Value cell truncates is
 * always readable in full.
 */

import { useState } from 'react';
import type { CookieValueIntrospection, JwtParts } from '../../../data/cookie-value-introspect';
import { formatRelativeExpiry } from '../../../data/cookie-format';

function JwtClaims({ jwt }: { jwt: JwtParts }) {
  const now = Date.now();
  return (
    <div className="dt-cookie-jwt">
      <div className="dt-cookie-jwt-section">
        <div className="dt-cookie-jwt-label">Header</div>
        <pre className="dt-cookie-jwt-pre">{JSON.stringify(jwt.header, null, 2)}</pre>
      </div>
      <div className="dt-cookie-jwt-section">
        <div className="dt-cookie-jwt-label">Payload</div>
        <pre className="dt-cookie-jwt-pre">{JSON.stringify(jwt.payload, null, 2)}</pre>
        {(jwt.expSec != null || jwt.iatSec != null || jwt.nbfSec != null) && (
          <div className="dt-cookie-jwt-claims">
            {jwt.iatSec != null && (
              <span>
                iat <em>{formatRelativeExpiry(jwt.iatSec, false, now)}</em>
              </span>
            )}
            {jwt.nbfSec != null && (
              <span>
                nbf <em>{formatRelativeExpiry(jwt.nbfSec, false, now)}</em>
              </span>
            )}
            {jwt.expSec != null && (
              <span
                className={
                  jwt.expSec * 1000 < now
                    ? 'dt-cookie-jwt-claim-expired'
                    : jwt.expSec * 1000 - now < 3600 * 1000
                      ? 'dt-cookie-jwt-claim-warn'
                      : ''
                }
              >
                exp <em>{formatRelativeExpiry(jwt.expSec, false, now)}</em>
              </span>
            )}
          </div>
        )}
      </div>
      {jwt.signature && (
        <div className="dt-cookie-jwt-section">
          <div className="dt-cookie-jwt-label">Signature</div>
          <pre className="dt-cookie-jwt-pre dt-cookie-jwt-sig">{jwt.signature}</pre>
        </div>
      )}
    </div>
  );
}

function decodedBodyFor(i: CookieValueIntrospection): React.ReactNode {
  if (i.kind === 'jwt') return <JwtClaims jwt={i.jwt} />;
  if (i.kind === 'json') return <pre className="dt-cookie-expand-pre">{JSON.stringify(i.parsed, null, 2)}</pre>;
  if (i.kind === 'url-encoded') {
    return (
      <div className="dt-cookie-expand-decoded">
        <div className="dt-cookie-expand-label">URL-decoded</div>
        <pre className="dt-cookie-expand-pre">{i.decoded}</pre>
      </div>
    );
  }
  if (i.kind === 'base64') {
    return (
      <div className="dt-cookie-expand-decoded">
        <div className="dt-cookie-expand-label">Base64-decoded</div>
        <pre className="dt-cookie-expand-pre">{i.decoded}</pre>
      </div>
    );
  }
  return null;
}

export function CookieValueExpander({
  introspection,
  columnSpan,
}: {
  introspection: CookieValueIntrospection;
  columnSpan: number;
}) {
  const i = introspection;
  const [showRaw, setShowRaw] = useState(false);

  const decoded = decodedBodyFor(i);
  const hasDecoded = decoded !== null;

  if (!hasDecoded && !i.value) return null;

  const rawBody = (
    <div className="dt-cookie-expand-decoded">
      {hasDecoded && <div className="dt-cookie-expand-label">Raw</div>}
      <pre className="dt-cookie-expand-pre">{i.value}</pre>
    </div>
  );

  return (
    <tr className="dt-cookie-expand-row">
      <td colSpan={columnSpan} className="dt-cookie-expand-cell">
        {hasDecoded && (
          <div className="dt-cookie-expand-toggle" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`dt-cookie-expand-tab${showRaw ? '' : ' dt-cookie-expand-tab--active'}`}
              onClick={() => setShowRaw(false)}
            >
              Decoded
            </button>
            <button
              type="button"
              className={`dt-cookie-expand-tab${showRaw ? ' dt-cookie-expand-tab--active' : ''}`}
              onClick={() => setShowRaw(true)}
            >
              Raw
            </button>
          </div>
        )}
        {hasDecoded && !showRaw ? decoded : rawBody}
      </td>
    </tr>
  );
}
