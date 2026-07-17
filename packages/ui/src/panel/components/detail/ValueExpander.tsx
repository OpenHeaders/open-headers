/**
 * Standalone value readout, shared by the headers and cookies tabs.
 *
 * For values with "depth" — JWT, JSON, base64, percent-encoded — it
 * shows the decoded / parsed view, with a Decoded / Raw toggle so the
 * original encoded value is one click away. For plain values it shows
 * the full raw value, wrapped, so a long value the row truncates is
 * always readable in full.
 *
 * It renders only the toggle + panes (a fragment); each tab supplies
 * the surrounding container — a table cell on the cookies tab, a row
 * div on the headers tab — so the readout text is always freely
 * selectable and never doubles as the expand toggle.
 */

import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { formatRelativeExpiry } from '../../data/cookies/cookie-format';
import type { JwtParts, ValueIntrospection } from '../../data/value-introspect';

function JwtClaims({ jwt }: { jwt: JwtParts }) {
  const now = Date.now();
  return (
    <div className="dt-value-jwt">
      <div className="dt-value-jwt-section">
        <div className="dt-value-jwt-label">Header</div>
        <pre className="dt-value-jwt-pre">{JSON.stringify(jwt.header, null, 2)}</pre>
      </div>
      <div className="dt-value-jwt-section">
        <div className="dt-value-jwt-label">Payload</div>
        <pre className="dt-value-jwt-pre">{JSON.stringify(jwt.payload, null, 2)}</pre>
        {(jwt.expSec != null || jwt.iatSec != null || jwt.nbfSec != null) && (
          <div className="dt-value-jwt-claims">
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
                    ? 'dt-value-jwt-claim-expired'
                    : jwt.expSec * 1000 - now < 3600 * 1000
                      ? 'dt-value-jwt-claim-warn'
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
        <div className="dt-value-jwt-section">
          <div className="dt-value-jwt-label">Signature</div>
          <pre className="dt-value-jwt-pre dt-value-jwt-sig">{jwt.signature}</pre>
        </div>
      )}
    </div>
  );
}

function decodedBodyFor(i: ValueIntrospection): React.ReactNode {
  if (i.kind === 'prefixed') {
    // A recognized scheme (e.g. `Bearer`) in front of a decodable
    // credential — label the scheme, then render the credential's own
    // decoded view beneath it.
    return (
      <div className="dt-value-expand-decoded">
        <div className="dt-value-expand-label">{i.label}</div>
        {decodedBodyFor(i.inner)}
      </div>
    );
  }
  if (i.kind === 'jwt') return <JwtClaims jwt={i.jwt} />;
  if (i.kind === 'json') return <pre className="dt-value-expand-pre dt-scrollbar">{JSON.stringify(i.parsed, null, 2)}</pre>;
  if (i.kind === 'url-encoded') {
    return (
      <div className="dt-value-expand-decoded">
        <div className="dt-value-expand-label">URL-decoded</div>
        <pre className="dt-value-expand-pre dt-scrollbar">{i.decoded}</pre>
      </div>
    );
  }
  if (i.kind === 'base64') {
    return (
      <div className="dt-value-expand-decoded">
        <div className="dt-value-expand-label">Base64-decoded</div>
        <pre className="dt-value-expand-pre dt-scrollbar">{i.decoded}</pre>
      </div>
    );
  }
  return null;
}

export function ValueExpander({ introspection }: { introspection: ValueIntrospection }) {
  const t = useT();
  const i = introspection;
  const [showRaw, setShowRaw] = useState(false);

  const decoded = decodedBodyFor(i);
  const hasDecoded = decoded !== null;

  if (!hasDecoded && !i.value) return null;

  const rawBody = (
    <div className="dt-value-expand-decoded">
      {hasDecoded && <div className="dt-value-expand-label">{t('panel.valueExpander.raw')}</div>}
      <pre className="dt-value-expand-pre dt-scrollbar">{i.value}</pre>
    </div>
  );

  return (
    <>
      {hasDecoded && (
        <div className="dt-value-expand-toggle" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`dt-value-expand-tab${showRaw ? '' : ' dt-value-expand-tab--active'}`}
            onClick={() => setShowRaw(false)}
          >
            {t('panel.valueExpander.decoded')}
          </button>
          <button
            type="button"
            className={`dt-value-expand-tab${showRaw ? ' dt-value-expand-tab--active' : ''}`}
            onClick={() => setShowRaw(true)}
          >
            {t('panel.valueExpander.raw')}
          </button>
        </div>
      )}
      {hasDecoded && !showRaw ? decoded : rawBody}
    </>
  );
}
