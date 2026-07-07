/**
 * Three-glyph security cell — `S H L`, colour-coded.
 *
 *   S = Secure       green = on · red = missing-when-required (SameSite=None / __Secure- / __Host-) · gray = off
 *   H = HttpOnly     green = on · gray = off
 *   L = SameSite     green = Strict · yellow = Lax · red = None-without-Secure · gray = unspecified
 *
 * One narrow cell replaces three Chrome columns. Hover reveals the
 * long-form breakdown for accessibility / copy.
 */

type Tone = 'on' | 'off' | 'good' | 'warn' | 'err';

/** The security-relevant slice of a cookie — `CookieRow` and `JarCookie`
 *  both satisfy it, so the glyph cell serves the request-context tab and
 *  the jar-only Storage section alike. */
export interface SecurityGlyphSubject {
  name: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}

interface GlyphSpec {
  letter: string;
  tone: Tone;
  title: string;
}

function secureSpec(row: SecurityGlyphSubject): GlyphSpec {
  const sameSiteNone =
    row.sameSite === 'no_restriction' || String(row.sameSite ?? '').toLowerCase() === 'none';
  const prefixDemandsSecure = row.name.startsWith('__Secure-') || row.name.startsWith('__Host-');
  if (row.secure) return { letter: 'S', tone: 'good', title: 'Secure — sent only over HTTPS.' };
  if (sameSiteNone) return { letter: 'S', tone: 'err', title: 'Missing Secure — SameSite=None requires Secure; browser will reject this cookie.' };
  if (prefixDemandsSecure) return { letter: 'S', tone: 'err', title: 'Missing Secure — __Host- / __Secure- prefix requires Secure.' };
  return { letter: 'S', tone: 'off', title: 'No Secure attribute.' };
}

function httpOnlySpec(row: SecurityGlyphSubject): GlyphSpec {
  if (row.httpOnly) return { letter: 'H', tone: 'good', title: 'HttpOnly — not readable from JavaScript.' };
  return { letter: 'H', tone: 'off', title: 'Readable from JavaScript (no HttpOnly).' };
}

function sameSiteSpec(row: SecurityGlyphSubject): GlyphSpec {
  const raw = String(row.sameSite ?? '').toLowerCase();
  if (raw === 'strict') return { letter: 'L', tone: 'good', title: 'SameSite=Strict — only sent on same-site navigations.' };
  if (raw === 'lax') return { letter: 'L', tone: 'warn', title: 'SameSite=Lax — sent on cross-site top-level GETs.' };
  if (raw === 'no_restriction' || raw === 'none') {
    if (!row.secure) return { letter: 'L', tone: 'err', title: 'SameSite=None without Secure — browser will reject.' };
    return { letter: 'L', tone: 'warn', title: 'SameSite=None — sent on every cross-site request.' };
  }
  return { letter: 'L', tone: 'off', title: 'SameSite unspecified.' };
}

function toneClass(t: Tone): string {
  return `dt-cookie-glyph dt-cookie-glyph--${t}`;
}

export function SecurityGlyphs({ row }: { row: SecurityGlyphSubject }) {
  const s = secureSpec(row);
  const h = httpOnlySpec(row);
  const l = sameSiteSpec(row);
  const fullTitle = `${s.title}\n${h.title}\n${l.title}`;
  return (
    <span className="dt-cookie-sec" title={fullTitle}>
      <span className={toneClass(s.tone)}>{s.letter}</span>
      <span className={toneClass(h.tone)}>{h.letter}</span>
      <span className={toneClass(l.tone)}>{l.letter}</span>
    </span>
  );
}
