/**
 * ValueGlancePreview — the compact decoded preview inside the eye's
 * glance popover. Rendered only while the popover is open (the popover
 * destroys its content on hide), so the decode work runs on open, never
 * per row render. Non-JWT kinds show the compact codec's decoded text
 * as a clamped mono block; JWTs get a claims-style compact list (the
 * popover section vocabulary) — the modal's triple pane does not shrink
 * to popover width — with the signature elided.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  compactDecodedText,
  decodeJWT,
  type DetectedValue,
} from '@openheaders/ui/shared/value-detection';
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

export function ValueGlancePreview({ detected }: { detected: DetectedValue }) {
  if (detected.type === 'jwt') return <JwtGlance token={detected.token} />;
  return <pre className="oh-value-glance-pre">{compactDecodedText(detected)}</pre>;
}
