/**
 * ValueGlancePreview — the decoded preview inside the eye's glance
 * popover. Rendered only while the popover is open (the popover
 * destroys its content on hide), so the decode work runs on open, never
 * per row render. Non-JWT kinds show the compact codec's FULL decoded
 * text in a bounded, inner-scrolling mono block — JSON payloads get
 * lightweight token tinting (keys/strings/numbers, the format-mode
 * example palette; no Monaco in a popover). JWTs get a claims-style
 * compact list (the popover section vocabulary) — the modal's triple
 * pane does not shrink to popover width — with the signature elided.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  compactDecodedText,
  decodeJWT,
  type DetectedValue,
} from '@openheaders/ui/shared/value-detection';
import type React from 'react';
import { useMemo } from 'react';
import './value-glance.css';

const MAX_CLAIM_ROWS = 6;
const MAX_CLAIM_TEXT = 80;

function claimText(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
  return text.length > MAX_CLAIM_TEXT ? `${text.slice(0, MAX_CLAIM_TEXT - 1)}…` : text;
}

function ClaimSection({ heading, entries }: { heading: string; entries: Array<[string, unknown]> }) {
  const t = useT();
  const shown = entries.slice(0, MAX_CLAIM_ROWS);
  const hidden = entries.length - shown.length;
  return (
    <div className="oh-info-popover-section">
      <div className="oh-info-popover-section-heading">{heading}</div>
      {shown.map(([key, value]) => (
        <div className="oh-info-popover-section-item" key={key}>
          <code className="oh-info-popover-section-item-label">{key}</code>
          <span className="oh-info-popover-section-item-desc">{claimText(value)}</span>
        </div>
      ))}
      {hidden > 0 && (
        <div className="oh-value-glance-more">{t('shared.valueEditors.glance.moreClaims', { count: hidden })}</div>
      )}
    </div>
  );
}

function JwtGlance({ token }: { token: string }) {
  const t = useT();
  const decoded = useMemo(() => {
    try {
      const { header, payload } = decodeJWT(token);
      const asEntries = (v: unknown): Array<[string, unknown]> =>
        v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : [];
      return { header: asEntries(header), payload: asEntries(payload) };
    } catch {
      return null;
    }
  }, [token]);
  if (decoded === null) {
    // Registry-accepted but undecodable here — show the raw token; the
    // modal CTA still offers its raw-token fallback view.
    return <pre className="oh-value-glance-pre">{token}</pre>;
  }
  return (
    <div>
      <ClaimSection heading={t('shared.valueEditors.jwt.header')} entries={decoded.header} />
      <ClaimSection heading={t('shared.valueEditors.jwt.payload')} entries={decoded.payload} />
      <div className="oh-value-glance-sig">{t('shared.valueEditors.glance.signatureElided')}</div>
    </div>
  );
}

// Tinting budget — beyond this the parse + pretty-print cost outweighs
// a popover peek; the text still renders in full, just untinted.
const MAX_TINT_CHARS = 65_536;

const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b/g;

/** Pretty-printed, span-tinted rendering when the decoded text is JSON;
 *  null when it isn't (or is too large to bother). */
function tintedJson(decoded: string): React.ReactNode[] | null {
  if (decoded.length > MAX_TINT_CHARS) return null;
  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(decoded), null, 2);
  } catch {
    return null;
  }
  // Only genuinely structured payloads earn the pretty treatment — a
  // bare string/number decodes fine as plain text.
  if (!/^[[{]/.test(pretty)) return null;
  const out: React.ReactNode[] = [];
  let last = 0;
  JSON_TOKEN.lastIndex = 0;
  for (let m = JSON_TOKEN.exec(pretty); m !== null; m = JSON_TOKEN.exec(pretty)) {
    if (m.index > last) out.push(pretty.slice(last, m.index));
    const cls = m[1] !== undefined ? (m[2] !== undefined ? 'oh-value-glance-key' : 'oh-value-glance-str') : 'oh-value-glance-num';
    const tokenText = m[1] ?? m[0];
    out.push(
      <span key={`t${m.index}`} className={cls}>
        {tokenText}
      </span>,
    );
    // A key match consumed its trailing colon — emit it untinted.
    if (m[1] !== undefined && m[2] !== undefined) out.push(m[2]);
    last = m.index + m[0].length;
  }
  if (last < pretty.length) out.push(pretty.slice(last));
  return out;
}

function TextGlance({ detected }: { detected: DetectedValue }) {
  const body = useMemo(() => {
    const decoded = compactDecodedText(detected);
    return tintedJson(decoded) ?? decoded;
  }, [detected]);
  return <pre className="oh-value-glance-pre">{body}</pre>;
}

export function ValueGlancePreview({ detected }: { detected: DetectedValue }) {
  if (detected.type === 'jwt') return <JwtGlance token={detected.token} />;
  return <TextGlance detected={detected} />;
}
