import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';
import {
  parseAuthorization,
  parseCacheControl,
  parseContentType,
  parseHsts,
  parseSetCookie,
} from '../../../data/headers/header-value-introspection';
import { humanSec } from './utils';

/**
 * Inline value chip. When `info` is supplied, an `<InfoTrigger>` (the
 * same shared `(i)` glyph used by header rows) is rendered *before*
 * the chip — hover-revealed by the row, click opens an `<InfoPopover>`.
 * Without `info`, the chip stays as plain text and uses the native
 * `title` tooltip.
 */
function Chip({
  tone,
  title,
  info,
  children,
}: {
  tone?: 'ok' | 'warn' | 'info' | 'muted';
  title?: string;
  info?: InfoPopoverContent;
  children: React.ReactNode;
}) {
  return (
    <span className="dt-header-chip-wrap">
      {info && <InfoTrigger content={info} className="dt-header-info-trigger" />}
      <span className="dt-header-chip" data-tone={tone ?? 'info'} title={info ? undefined : title}>
        {children}
      </span>
    </span>
  );
}

// ── Inline content builders for value chips ─────────────────
// Kept inline because the prose is tightly coupled to the chip's
// rendering and these helpers are short. Each returns an
// `InfoPopoverContent` for the matching chip kind.

function cookieFlagInfo(flag: 'HttpOnly' | 'Secure' | 'Partitioned'): InfoPopoverContent {
  if (flag === 'HttpOnly') {
    return {
      title: 'HttpOnly',
      kicker: 'Set-Cookie flag',
      summary: 'Cookie is hidden from JavaScript (cannot be read via `document.cookie`).',
      description: 'Mitigates XSS — an injected script can no longer exfiltrate the cookie. Doesn’t help with CSRF.',
    };
  }
  if (flag === 'Secure') {
    return {
      title: 'Secure',
      kicker: 'Set-Cookie flag',
      summary: 'Cookie only sent over HTTPS. Never leaks over plain HTTP.',
    };
  }
  return {
    title: 'Partitioned',
    kicker: 'Set-Cookie flag',
    summary: 'CHIPS — cookie is partitioned per top-level site.',
    description:
      'Each top-level site gets its own copy of the cookie, so embedded contexts cannot use cookies to track the user across sites.',
  };
}

function sameSiteInfo(value: 'Strict' | 'Lax' | 'None'): InfoPopoverContent {
  const summaries: Record<'Strict' | 'Lax' | 'None', string> = {
    Strict: 'Cookie only sent on same-site requests. Strongest CSRF protection — even links from another site arrive cookieless.',
    Lax: 'Cookie sent on same-site requests and top-level cross-site navigations (link clicks). Default in modern browsers.',
    None: 'Cookie sent on all cross-site requests. Requires `Secure`. Use intentionally — recipients can correlate the cookie across sites.',
  };
  return {
    title: `SameSite=${value}`,
    kicker: 'Set-Cookie flag',
    summary: summaries[value],
  };
}

function cookieExpiryInfo(expiresAtMs: number, remainingSec: number): InfoPopoverContent {
  return {
    title: 'Cookie expiry',
    kicker: 'Set-Cookie attribute',
    summary:
      remainingSec <= 0
        ? 'Cookie has already expired. The browser will not send it.'
        : `Cookie expires in ${humanSec(remainingSec)} (at ${new Date(expiresAtMs).toISOString()}).`,
    description:
      'Cookies without `Max-Age` or `Expires` are session cookies and disappear when the browser quits. Set one to make the cookie persistent.',
  };
}

const SESSION_COOKIE_INFO: InfoPopoverContent = {
  title: 'Session cookie',
  kicker: 'Set-Cookie attribute',
  summary: 'No `Max-Age` or `Expires` — the browser discards this cookie when it quits.',
  description: 'Add `Max-Age=<seconds>` or `Expires=<date>` to make it persistent across browser sessions.',
};

function missingFlagInfo(flag: 'Secure' | 'HttpOnly' | 'SameSite'): InfoPopoverContent {
  const reasons: Record<'Secure' | 'HttpOnly' | 'SameSite', string> = {
    Secure: 'Without `Secure`, this cookie can leak over plain HTTP. Always set on HTTPS cookies.',
    HttpOnly: 'Without `HttpOnly`, JavaScript can read this cookie via `document.cookie` — an XSS bug exfiltrates it.',
    SameSite:
      'Without an explicit `SameSite`, browsers fall back to `Lax`. Be explicit so the policy is obvious in code review.',
  };
  return {
    title: `Missing ${flag}`,
    kicker: 'Best practice',
    summary: reasons[flag],
    description: 'Most production cookies should carry `Secure`, `HttpOnly`, and an explicit `SameSite`.',
  };
}

function cacheControlInfo(value: string, parsed: ReturnType<typeof parseCacheControl>): InfoPopoverContent {
  const directives: { label: string; desc: string }[] = [];
  if (parsed.noStore) directives.push({ label: 'no-store', desc: 'Do not cache, anywhere.' });
  if (parsed.noCache) directives.push({ label: 'no-cache', desc: 'May cache, but revalidate every time before reuse.' });
  if (parsed.isPublic) directives.push({ label: 'public', desc: 'Any cache may store, including CDNs.' });
  if (parsed.isPrivate) directives.push({ label: 'private', desc: 'Only the user’s browser may store.' });
  if (parsed.immutable) directives.push({ label: 'immutable', desc: 'Promise the body will not change for max-age.' });
  if (parsed.mustRevalidate) directives.push({ label: 'must-revalidate', desc: 'Once stale, revalidate before serving.' });
  if (parsed.maxAgeSec != null) directives.push({ label: `max-age=${parsed.maxAgeSec}`, desc: `Fresh for ${humanSec(parsed.maxAgeSec)}.` });
  if (parsed.sMaxAgeSec != null) directives.push({ label: `s-maxage=${parsed.sMaxAgeSec}`, desc: `Shared-cache freshness: ${humanSec(parsed.sMaxAgeSec)}.` });
  if (parsed.staleWhileRevalidateSec != null) {
    directives.push({
      label: `stale-while-revalidate=${parsed.staleWhileRevalidateSec}`,
      desc: `Allow stale reuse for ${humanSec(parsed.staleWhileRevalidateSec)} while a background revalidation runs.`,
    });
  }
  return {
    title: `Cache-Control: ${parsed.summary}`,
    kicker: 'Cache directive',
    summary: `Raw value: \`${value}\`.`,
    sections: directives.length > 0 ? [{ heading: 'Active directives', items: directives }] : undefined,
  };
}

function charsetInfo(charset: string): InfoPopoverContent {
  return {
    title: `charset=${charset}`,
    kicker: 'Content-Type parameter',
    summary: 'Character encoding the body uses.',
    description: 'For `text/*` types, modern stacks default to `utf-8`. Wrong values cause mojibake.',
  };
}

const BOUNDARY_INFO: InfoPopoverContent = {
  title: 'Multipart boundary',
  kicker: 'Content-Type parameter',
  summary: 'Token that separates parts of a multipart body (file uploads, multipart/form-data).',
  description: 'Generated by the client; must not appear inside any part’s body.',
};

function hstsInfo(value: string, parsed: NonNullable<ReturnType<typeof parseHsts>>): InfoPopoverContent {
  return {
    title: 'Strict-Transport-Security',
    kicker: 'Security policy',
    summary: `Browser will use HTTPS for this host for ${humanSec(parsed.maxAgeSec)}.`,
    description: `Raw value: \`${value}\`.`,
    sections: [
      {
        heading: 'Directives',
        items: [
          { label: `max-age=${parsed.maxAgeSec}`, desc: 'Remember HTTPS-only for this long.' },
          ...(parsed.includeSubDomains ? [{ label: 'includeSubDomains', desc: 'Apply to every subdomain.' }] : []),
          ...(parsed.preload ? [{ label: 'preload', desc: 'Eligibility for the browser preload list.' }] : []),
        ],
      },
    ],
  };
}

const JWT_INFO: InfoPopoverContent = {
  title: 'JWT',
  kicker: 'Authorization scheme',
  summary: 'JSON Web Token — a base64-encoded `<header>.<payload>.<signature>` triple.',
  description:
    'The signature proves the token was issued by someone holding the signing key. The header (alg, typ) and payload (claims) are NOT encrypted — they are simply base64-encoded and readable by anyone.',
};

function jwtAlgInfo(alg: string): InfoPopoverContent {
  return {
    title: `JWT alg: ${alg}`,
    kicker: 'JWT header',
    summary: 'Signing algorithm declared in the JWT header.',
    description:
      'Common values: `HS256` (HMAC-SHA256, symmetric), `RS256` (RSA, asymmetric), `ES256` (ECDSA). `none` (no signature) should always be rejected by validators.',
  };
}

function jwtExpInfo(secondsRemaining: number): InfoPopoverContent {
  if (secondsRemaining < 0) {
    return {
      title: 'JWT expired',
      kicker: 'JWT claim',
      summary: `Token expired ${humanSec(-secondsRemaining)} ago. The server should reject it.`,
    };
  }
  return {
    title: `JWT expires in ${humanSec(secondsRemaining)}`,
    kicker: 'JWT claim',
    summary:
      secondsRemaining < 300
        ? 'Token is close to expiry — refresh it or expect a 401 soon.'
        : 'Time until the JWT `exp` claim is reached.',
  };
}

function bearerSchemeInfo(scheme: string): InfoPopoverContent {
  return {
    title: scheme,
    kicker: 'Authorization scheme',
    summary:
      scheme === 'Bearer'
        ? 'Opaque bearer credential (OAuth 2.0 / API token). Treat it like a password — anyone who has it can authenticate as the user.'
        : scheme === 'Basic'
          ? 'HTTP Basic auth — `base64(username:password)`. Only safe over HTTPS.'
          : 'Authentication scheme name. The credential format depends on the scheme.',
  };
}

function SetCookieChips({ value }: { value: string }) {
  const info = useMemo(() => parseSetCookie(value), [value]);
  if (!info) return null;
  const chips: React.ReactNode[] = [];
  if (info.httpOnly) chips.push(<Chip key="ho" tone="ok" info={cookieFlagInfo('HttpOnly')}>HttpOnly</Chip>);
  if (info.secure) chips.push(<Chip key="sec" tone="ok" info={cookieFlagInfo('Secure')}>Secure</Chip>);
  if (info.partitioned) chips.push(<Chip key="part" tone="ok" info={cookieFlagInfo('Partitioned')}>Partitioned</Chip>);
  if (info.sameSite) chips.push(<Chip key="ss" tone="info" info={sameSiteInfo(info.sameSite)}>SameSite={info.sameSite}</Chip>);
  if (info.expiresAtMs != null) {
    const remainingSec = Math.max(0, Math.round((info.expiresAtMs - Date.now()) / 1000));
    chips.push(
      <Chip key="exp" tone={remainingSec < 60 ? 'warn' : 'muted'} info={cookieExpiryInfo(info.expiresAtMs, remainingSec)}>
        expires {humanSec(remainingSec)}
      </Chip>,
    );
  } else if (info.session) {
    chips.push(<Chip key="sess" tone="muted" info={SESSION_COOKIE_INFO}>session</Chip>);
  }
  for (const missing of info.missingFlags) {
    chips.push(
      <Chip key={`miss-${missing}`} tone="warn" info={missingFlagInfo(missing)}>
        ⚠ no {missing}
      </Chip>,
    );
  }
  return <span className="dt-header-chips">{chips}</span>;
}

function CacheControlChip({ value }: { value: string }) {
  const parsed = useMemo(() => parseCacheControl(value), [value]);
  if (!parsed.summary) return null;
  const tone = parsed.noStore || parsed.noCache ? 'warn' : parsed.immutable ? 'ok' : 'info';
  return (
    <span className="dt-header-chips">
      <Chip tone={tone} info={cacheControlInfo(value, parsed)}>
        {parsed.summary}
      </Chip>
    </span>
  );
}

function ContentTypeChip({ value }: { value: string }) {
  const info = useMemo(() => parseContentType(value), [value]);
  if (!info.charset && !info.boundary) return null;
  return (
    <span className="dt-header-chips">
      {info.charset && (
        <Chip tone="muted" info={charsetInfo(info.charset)}>
          {info.charset}
        </Chip>
      )}
      {info.boundary && (
        <Chip tone="muted" info={BOUNDARY_INFO}>
          boundary
        </Chip>
      )}
    </span>
  );
}

function HstsChip({ value }: { value: string }) {
  const parsed = useMemo(() => parseHsts(value), [value]);
  if (!parsed) return null;
  return (
    <span className="dt-header-chips">
      <Chip tone="ok" info={hstsInfo(value, parsed)}>
        {parsed.summary}
      </Chip>
    </span>
  );
}

function AuthorizationChip({ value }: { value: string }) {
  const info = useMemo(() => parseAuthorization(value), [value]);
  if (!info) return null;
  if (!info.isJwt) {
    return (
      <span className="dt-header-chips">
        <Chip tone="info" info={bearerSchemeInfo(info.scheme)}>
          {info.scheme}
        </Chip>
      </span>
    );
  }
  const alg = typeof info.jwtHeader?.alg === 'string' ? info.jwtHeader.alg : 'unknown';
  const chips: React.ReactNode[] = [
    <Chip key="jwt" tone="info" info={JWT_INFO}>
      JWT
    </Chip>,
    <Chip key="alg" tone="muted" info={jwtAlgInfo(alg)}>
      {alg}
    </Chip>,
  ];
  const exp = info.jwtExpSecondsRemaining;
  if (exp != null) {
    if (exp < 0) {
      chips.push(
        <Chip key="exp" tone="warn" info={jwtExpInfo(exp)}>
          expired
        </Chip>,
      );
    } else {
      chips.push(
        <Chip key="exp" tone={exp < 300 ? 'warn' : 'muted'} info={jwtExpInfo(exp)}>
          exp {humanSec(exp)}
        </Chip>,
      );
    }
  }
  return <span className="dt-header-chips">{chips}</span>;
}

export function ValueChips({ name, value }: { name: string; value: string }) {
  const lower = name.toLowerCase();
  if (lower === 'set-cookie') return <SetCookieChips value={value} />;
  if (lower === 'cache-control') return <CacheControlChip value={value} />;
  if (lower === 'content-type') return <ContentTypeChip value={value} />;
  if (lower === 'strict-transport-security') return <HstsChip value={value} />;
  if (lower === 'authorization') return <AuthorizationChip value={value} />;
  return null;
}
