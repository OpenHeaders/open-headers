import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
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
 *
 * Chip TEXTS that are wire vocabulary (HttpOnly, SameSite=Lax, JWT,
 * alg names, `exp {duration}`, cache-directive summaries, boundary,
 * scheme names) stay raw; only UI-worded chips key. The (i) corpora
 * are t-fed builders; cache/HSTS directive descriptions reuse the
 * shared header corpus where the referent matches.
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

function cookieFlagInfo(t: Translate, flag: 'HttpOnly' | 'Secure' | 'Partitioned'): InfoPopoverContent {
  const kicker = t('panel.inspector.headers.chipInfo.setCookieFlagKicker');
  if (flag === 'HttpOnly') {
    return {
      title: 'HttpOnly',
      kicker,
      summary: t('panel.inspector.headers.chipInfo.httpOnly.summary'),
      description: t('panel.inspector.headers.chipInfo.httpOnly.description'),
    };
  }
  if (flag === 'Secure') {
    return { title: 'Secure', kicker, summary: t('panel.inspector.headers.chipInfo.secure.summary') };
  }
  return {
    title: 'Partitioned',
    kicker,
    summary: t('panel.inspector.headers.chipInfo.partitioned.summary'),
    description: t('panel.inspector.headers.chipInfo.partitioned.description'),
  };
}

function sameSiteInfo(t: Translate, value: 'Strict' | 'Lax' | 'None'): InfoPopoverContent {
  const summaries = {
    Strict: t('panel.inspector.headers.chipInfo.sameSiteStrict'),
    Lax: t('panel.inspector.headers.chipInfo.sameSiteLax'),
    None: t('panel.inspector.headers.chipInfo.sameSiteNone'),
  } as const;
  return {
    title: `SameSite=${value}`,
    kicker: t('panel.inspector.headers.chipInfo.setCookieFlagKicker'),
    summary: summaries[value],
  };
}

function cookieExpiryInfo(t: Translate, expiresAtMs: number, remainingSec: number): InfoPopoverContent {
  return {
    title: t('panel.inspector.headers.chipInfo.cookieExpiry.title'),
    kicker: t('shared.info.cookie.kicker'),
    summary:
      remainingSec <= 0
        ? t('panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary')
        : t('panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary', {
            duration: humanSec(remainingSec),
            date: new Date(expiresAtMs).toISOString(),
          }),
    description: t('panel.inspector.headers.chipInfo.cookieExpiry.description'),
  };
}

function sessionCookieInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.headers.chipInfo.sessionCookie.title'),
    kicker: t('shared.info.cookie.kicker'),
    summary: t('panel.inspector.headers.chipInfo.sessionCookie.summary'),
    description: t('panel.inspector.headers.chipInfo.sessionCookie.description'),
  };
}

function missingFlagInfo(t: Translate, flag: 'Secure' | 'HttpOnly' | 'SameSite'): InfoPopoverContent {
  const reasons = {
    Secure: t('panel.inspector.headers.chipInfo.missingFlag.secure'),
    HttpOnly: t('panel.inspector.headers.chipInfo.missingFlag.httpOnly'),
    SameSite: t('panel.inspector.headers.chipInfo.missingFlag.sameSite'),
  } as const;
  return {
    title: t('panel.inspector.headers.chipInfo.missingFlag.title', { flag }),
    kicker: t('panel.inspector.headers.chipInfo.missingFlag.kicker'),
    summary: reasons[flag],
    description: t('panel.inspector.headers.chipInfo.missingFlag.description'),
  };
}

function cacheControlInfo(
  t: Translate,
  value: string,
  parsed: ReturnType<typeof parseCacheControl>,
): InfoPopoverContent {
  const directives: { label: string; desc: string }[] = [];
  if (parsed.noStore) {
    directives.push({ label: 'no-store', desc: t('shared.info.header.cacheControl.directive.noStore') });
  }
  if (parsed.noCache) {
    directives.push({ label: 'no-cache', desc: t('shared.info.header.cacheControl.directive.noCache') });
  }
  if (parsed.isPublic) {
    directives.push({ label: 'public', desc: t('shared.info.header.cacheControl.directive.public') });
  }
  if (parsed.isPrivate) {
    directives.push({ label: 'private', desc: t('shared.info.header.cacheControl.directive.private') });
  }
  if (parsed.immutable) {
    directives.push({ label: 'immutable', desc: t('shared.info.header.cacheControl.directive.immutable') });
  }
  if (parsed.mustRevalidate) {
    directives.push({ label: 'must-revalidate', desc: t('shared.info.header.cacheControl.directive.mustRevalidate') });
  }
  if (parsed.maxAgeSec != null) {
    directives.push({
      label: `max-age=${parsed.maxAgeSec}`,
      desc: t('panel.inspector.headers.chipInfo.maxAge', { duration: humanSec(parsed.maxAgeSec) }),
    });
  }
  if (parsed.sMaxAgeSec != null) {
    directives.push({
      label: `s-maxage=${parsed.sMaxAgeSec}`,
      desc: t('panel.inspector.headers.chipInfo.sMaxage', { duration: humanSec(parsed.sMaxAgeSec) }),
    });
  }
  if (parsed.staleWhileRevalidateSec != null) {
    directives.push({
      label: `stale-while-revalidate=${parsed.staleWhileRevalidateSec}`,
      desc: t('panel.inspector.headers.chipInfo.staleWhileRevalidate', {
        duration: humanSec(parsed.staleWhileRevalidateSec),
      }),
    });
  }
  return {
    title: `Cache-Control: ${parsed.summary}`,
    kicker: t('panel.inspector.headers.chipInfo.cacheKicker'),
    summary: t('panel.inspector.headers.chipInfo.rawValue', { value }),
    sections:
      directives.length > 0
        ? [{ heading: t('panel.inspector.headers.chipInfo.activeDirectives'), items: directives }]
        : undefined,
  };
}

function charsetInfo(t: Translate, charset: string): InfoPopoverContent {
  return {
    title: `charset=${charset}`,
    kicker: t('panel.inspector.headers.chipInfo.contentTypeParamKicker'),
    summary: t('panel.inspector.headers.chipInfo.charset.summary'),
    description: t('panel.inspector.headers.chipInfo.charset.description'),
  };
}

function boundaryInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.headers.chipInfo.boundary.title'),
    kicker: t('panel.inspector.headers.chipInfo.contentTypeParamKicker'),
    summary: t('panel.inspector.headers.chipInfo.boundary.summary'),
    description: t('panel.inspector.headers.chipInfo.boundary.description'),
  };
}

function hstsInfo(t: Translate, value: string, parsed: NonNullable<ReturnType<typeof parseHsts>>): InfoPopoverContent {
  return {
    title: 'Strict-Transport-Security',
    kicker: t('panel.inspector.headers.chipInfo.hsts.kicker'),
    summary: t('panel.inspector.headers.chipInfo.hsts.summary', { duration: humanSec(parsed.maxAgeSec) }),
    description: t('panel.inspector.headers.chipInfo.rawValue', { value }),
    sections: [
      {
        heading: t('shared.info.header.section.directives'),
        items: [
          {
            label: `max-age=${parsed.maxAgeSec}`,
            desc: t('shared.info.header.strictTransportSecurity.directive.maxAgeN'),
          },
          ...(parsed.includeSubDomains
            ? [
                {
                  label: 'includeSubDomains',
                  desc: t('shared.info.header.strictTransportSecurity.directive.includeSubDomains'),
                },
              ]
            : []),
          ...(parsed.preload
            ? [{ label: 'preload', desc: t('shared.info.header.strictTransportSecurity.directive.preload') }]
            : []),
        ],
      },
    ],
  };
}

function jwtInfo(t: Translate): InfoPopoverContent {
  return {
    title: 'JWT',
    kicker: t('panel.inspector.headers.chipInfo.authSchemeKicker'),
    summary: t('panel.inspector.headers.chipInfo.jwt.summary'),
    description: t('panel.inspector.headers.chipInfo.jwt.description'),
  };
}

function jwtAlgInfo(t: Translate, alg: string): InfoPopoverContent {
  return {
    title: `JWT alg: ${alg}`,
    kicker: t('panel.inspector.headers.chipInfo.jwtHeaderKicker'),
    summary: t('panel.inspector.headers.chipInfo.jwtAlg.summary'),
    description: t('panel.inspector.headers.chipInfo.jwtAlg.description'),
  };
}

function jwtExpInfo(t: Translate, secondsRemaining: number): InfoPopoverContent {
  if (secondsRemaining < 0) {
    return {
      title: t('panel.inspector.headers.chipInfo.jwtExpired.title'),
      kicker: t('panel.inspector.headers.chipInfo.jwtClaimKicker'),
      summary: t('panel.inspector.headers.chipInfo.jwtExpired.summary', { duration: humanSec(-secondsRemaining) }),
    };
  }
  return {
    title: t('panel.inspector.headers.chipInfo.jwtExpires.title', { duration: humanSec(secondsRemaining) }),
    kicker: t('panel.inspector.headers.chipInfo.jwtClaimKicker'),
    summary:
      secondsRemaining < 300
        ? t('panel.inspector.headers.chipInfo.jwtExpires.soonSummary')
        : t('panel.inspector.headers.chipInfo.jwtExpires.summary'),
  };
}

function bearerSchemeInfo(t: Translate, scheme: string): InfoPopoverContent {
  return {
    title: scheme,
    kicker: t('panel.inspector.headers.chipInfo.authSchemeKicker'),
    summary:
      scheme === 'Bearer'
        ? t('panel.inspector.headers.chipInfo.scheme.bearer')
        : scheme === 'Basic'
          ? t('panel.inspector.headers.chipInfo.scheme.basic')
          : t('panel.inspector.headers.chipInfo.scheme.other'),
  };
}

function SetCookieChips({ value }: { value: string }) {
  const t = useT();
  const info = useMemo(() => parseSetCookie(value), [value]);
  if (!info) return null;
  const chips: React.ReactNode[] = [];
  if (info.httpOnly) chips.push(<Chip key="ho" tone="ok" info={cookieFlagInfo(t, 'HttpOnly')}>HttpOnly</Chip>);
  if (info.secure) chips.push(<Chip key="sec" tone="ok" info={cookieFlagInfo(t, 'Secure')}>Secure</Chip>);
  if (info.partitioned) {
    chips.push(<Chip key="part" tone="ok" info={cookieFlagInfo(t, 'Partitioned')}>Partitioned</Chip>);
  }
  if (info.sameSite) {
    chips.push(<Chip key="ss" tone="info" info={sameSiteInfo(t, info.sameSite)}>SameSite={info.sameSite}</Chip>);
  }
  if (info.expiresAtMs != null) {
    const remainingSec = Math.max(0, Math.round((info.expiresAtMs - Date.now()) / 1000));
    chips.push(
      <Chip
        key="exp"
        tone={remainingSec < 60 ? 'warn' : 'muted'}
        info={cookieExpiryInfo(t, info.expiresAtMs, remainingSec)}
      >
        {t('panel.inspector.headers.chips.expires', { duration: humanSec(remainingSec) })}
      </Chip>,
    );
  } else if (info.session) {
    chips.push(
      <Chip key="sess" tone="muted" info={sessionCookieInfo(t)}>
        {t('panel.inspector.headers.chips.session')}
      </Chip>,
    );
  }
  for (const missing of info.missingFlags) {
    chips.push(
      <Chip key={`miss-${missing}`} tone="warn" info={missingFlagInfo(t, missing)}>
        ⚠ {t('panel.inspector.headers.chips.missingFlag', { flag: missing })}
      </Chip>,
    );
  }
  return <span className="dt-header-chips">{chips}</span>;
}

function CacheControlChip({ value }: { value: string }) {
  const t = useT();
  const parsed = useMemo(() => parseCacheControl(value), [value]);
  if (!parsed.summary) return null;
  const tone = parsed.noStore || parsed.noCache ? 'warn' : parsed.immutable ? 'ok' : 'info';
  return (
    <span className="dt-header-chips">
      <Chip tone={tone} info={cacheControlInfo(t, value, parsed)}>
        {parsed.summary}
      </Chip>
    </span>
  );
}

function ContentTypeChip({ value }: { value: string }) {
  const t = useT();
  const info = useMemo(() => parseContentType(value), [value]);
  if (!info.charset && !info.boundary) return null;
  return (
    <span className="dt-header-chips">
      {info.charset && (
        <Chip tone="muted" info={charsetInfo(t, info.charset)}>
          {info.charset}
        </Chip>
      )}
      {info.boundary && (
        <Chip tone="muted" info={boundaryInfo(t)}>
          boundary
        </Chip>
      )}
    </span>
  );
}

function HstsChip({ value }: { value: string }) {
  const t = useT();
  const parsed = useMemo(() => parseHsts(value), [value]);
  if (!parsed) return null;
  return (
    <span className="dt-header-chips">
      <Chip tone="ok" info={hstsInfo(t, value, parsed)}>
        {parsed.summary}
      </Chip>
    </span>
  );
}

function AuthorizationChip({ value }: { value: string }) {
  const t = useT();
  const info = useMemo(() => parseAuthorization(value), [value]);
  if (!info) return null;
  if (!info.isJwt) {
    return (
      <span className="dt-header-chips">
        <Chip tone="info" info={bearerSchemeInfo(t, info.scheme)}>
          {info.scheme}
        </Chip>
      </span>
    );
  }
  const alg = typeof info.jwtHeader?.alg === 'string' ? info.jwtHeader.alg : 'unknown';
  const chips: React.ReactNode[] = [
    <Chip key="jwt" tone="info" info={jwtInfo(t)}>
      JWT
    </Chip>,
    <Chip key="alg" tone="muted" info={jwtAlgInfo(t, alg)}>
      {alg}
    </Chip>,
  ];
  const exp = info.jwtExpSecondsRemaining;
  if (exp != null) {
    if (exp < 0) {
      chips.push(
        <Chip key="exp" tone="warn" info={jwtExpInfo(t, exp)}>
          {t('panel.inspector.headers.chips.expired')}
        </Chip>,
      );
    } else {
      chips.push(
        <Chip key="exp" tone={exp < 300 ? 'warn' : 'muted'} info={jwtExpInfo(t, exp)}>
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
