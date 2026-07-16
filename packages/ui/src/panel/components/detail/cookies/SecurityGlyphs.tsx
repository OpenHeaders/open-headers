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

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';

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

function secureSpec(t: Translate, row: SecurityGlyphSubject): GlyphSpec {
  const sameSiteNone =
    row.sameSite === 'no_restriction' || String(row.sameSite ?? '').toLowerCase() === 'none';
  const prefixDemandsSecure = row.name.startsWith('__Secure-') || row.name.startsWith('__Host-');
  if (row.secure) return { letter: 'S', tone: 'good', title: t('panel.inspector.cookies.glyphs.secureOn') };
  if (sameSiteNone) {
    return { letter: 'S', tone: 'err', title: t('panel.inspector.cookies.glyphs.secureMissingSameSiteNone') };
  }
  if (prefixDemandsSecure) {
    return { letter: 'S', tone: 'err', title: t('panel.inspector.cookies.glyphs.secureMissingPrefix') };
  }
  return { letter: 'S', tone: 'off', title: t('panel.inspector.cookies.glyphs.secureOff') };
}

function httpOnlySpec(t: Translate, row: SecurityGlyphSubject): GlyphSpec {
  if (row.httpOnly) return { letter: 'H', tone: 'good', title: t('panel.inspector.cookies.glyphs.httpOnlyOn') };
  return { letter: 'H', tone: 'off', title: t('panel.inspector.cookies.glyphs.httpOnlyOff') };
}

function sameSiteSpec(t: Translate, row: SecurityGlyphSubject): GlyphSpec {
  const raw = String(row.sameSite ?? '').toLowerCase();
  if (raw === 'strict') {
    return { letter: 'L', tone: 'good', title: t('panel.inspector.cookies.glyphs.sameSiteStrict') };
  }
  if (raw === 'lax') return { letter: 'L', tone: 'warn', title: t('panel.inspector.cookies.glyphs.sameSiteLax') };
  if (raw === 'no_restriction' || raw === 'none') {
    if (!row.secure) {
      return { letter: 'L', tone: 'err', title: t('panel.inspector.cookies.glyphs.sameSiteNoneNoSecure') };
    }
    return { letter: 'L', tone: 'warn', title: t('panel.inspector.cookies.glyphs.sameSiteNone') };
  }
  return { letter: 'L', tone: 'off', title: t('panel.inspector.cookies.glyphs.sameSiteUnspecified') };
}

function toneClass(t: Tone): string {
  return `dt-cookie-glyph dt-cookie-glyph--${t}`;
}

export function SecurityGlyphs({ row }: { row: SecurityGlyphSubject }) {
  const t = useT();
  const s = secureSpec(t, row);
  const h = httpOnlySpec(t, row);
  const l = sameSiteSpec(t, row);
  const fullTitle = `${s.title}\n${h.title}\n${l.title}`;
  return (
    <span className="dt-cookie-sec" title={fullTitle}>
      <span className={toneClass(s.tone)}>{s.letter}</span>
      <span className={toneClass(h.tone)}>{h.letter}</span>
      <span className={toneClass(l.tone)}>{l.letter}</span>
    </span>
  );
}
