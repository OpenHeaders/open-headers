import type React from 'react';
import { ArrowDefs,FILL_GREEN,STROKE,STROKE_GREEN,TEXT,TEXT_DIM } from '../_shared';
import { FILL_CYAN,STROKE_CYAN } from './_shared';

/**
 * Request Domains — one entry expands to all subdomains.
 *
 * The unique teaching hook: a single value like "openheaders.io"
 * auto-matches every subdomain (api., cdn., www., deeply-nested) and
 * the apex domain itself. No wildcard syntax needed. The diagram
 * makes that explicit by showing one rule entry fanning into a
 * green-bordered list of all matched hosts, then the "doesn't match"
 * boundary cases (different TLD, not-a-true-subdomain) below.
 */
export const RequestDomainsDiagram: React.FC = () => {
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  return (
    <svg
      viewBox="0 0 320 348"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Request Domains: one entry auto-includes the apex domain plus every subdomain, on any path or query"
    >
      <ArrowDefs id="cn-rd" />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Request Domains — one entry, all subdomains, any path
      </text>

      {/* Rule input box — single value */}
      <rect x={80} y={22} width={160} height={26} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={160} y={39} textAnchor="middle" fontFamily="monospace" fontSize={12} fontWeight={700} fill={TEXT}>
        openheaders.io
      </text>

      {/* Down arrow with caption */}
      <line x1={160} y1={52} x2={160} y2={70} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd="url(#cn-rd)" />
      <text x={170} y={64} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        auto-includes
      </text>

      {/* Matched list — varied paths/queries make the host-only behavior obvious. */}
      <rect
        x={20}
        y={80}
        width={280}
        height={108}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE_GREEN}
      />
      {[
        'openheaders.io',
        'openheaders.io/about',
        'api.openheaders.io/v2/users',
        'cdn.openheaders.io/static/img.png',
        'www.openheaders.io/?q=foo',
        'a.b.c.openheaders.io',
      ].map((host, i) => {
        const y = 98 + i * 14;
        return (
          <g key={host}>
            <text x={36} y={y} fontSize={11} fontWeight={700} fill={matchOk}>
              ✓
            </text>
            <text x={52} y={y} fontFamily="monospace" fontSize={10} fill={TEXT}>
              {host}
            </text>
          </g>
        );
      })}
      <line x1={28} y1={172} x2={292} y2={172} stroke={STROKE_GREEN} strokeDasharray="2 2" />
      <text x={160} y={184} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        host-only match — any path or query string qualifies
      </text>

      <line x1={20} y1={200} x2={300} y2={200} stroke={STROKE} strokeDasharray="2 3" />

      {/* Won't match */}
      <text x={20} y={216} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Doesn't match:
      </text>

      <text x={32} y={238} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={48} y={238} fontFamily="monospace" fontSize={10} fill={TEXT_DIM}>
        openheaders.com
      </text>
      <text x={48} y={250} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        different TLD (.com ≠ .io)
      </text>

      <text x={32} y={272} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={48} y={272} fontFamily="monospace" fontSize={10} fill={TEXT_DIM}>
        not-openheaders.io
      </text>
      <text x={48} y={284} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        not a true subdomain — no dot before "openheaders.io"
      </text>

      {/* Footer hint */}
      <rect
        x={14}
        y={302}
        width={292}
        height={38}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={319} textAnchor="middle" fontSize={9} fill={TEXT}>
        Need to scope by path? Combine with <tspan fontWeight={600}>URL Pattern</tspan>.
      </text>
      <text x={160} y={333} textAnchor="middle" fontSize={9} fill={TEXT}>
        Cross-domain? Add each domain as a separate entry.
      </text>
    </svg>
  );
};

/**
 * Exclude Domains — subtractive filter visual.
 *
 * Two input boxes at top, color-coded as include (green) and
 * exclude (red), feeding into a single result list. Excluded hosts
 * are shown struck-through with the reason "excluded" or "excluded
 * — subdomains too" to reinforce that the same subdomain rule that
 * makes Request Domains expansive also makes Exclude Domains
 * expansive.
 *
 * The standalone-warning callout at the bottom is the one thing
 * beginners must internalize: Exclude Domains does NOT match
 * anything on its own — it only subtracts from another condition's
 * candidates.
 */
export const ExcludeDomainsDiagram: React.FC = () => {
  const includeFill = FILL_GREEN;
  const includeStroke = STROKE_GREEN;
  const excludeFill = 'var(--ant-color-error-bg)';
  const excludeStroke = 'var(--ant-color-error-border)';
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  const warnFill = 'rgba(250, 173, 20, 0.18)';
  const warnStroke = 'rgba(250, 173, 20, 0.7)';
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Exclude Domains subtracts hosts from another condition's matches; it does not match anything on its own"
    >
      <ArrowDefs id="cn-ex" />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Exclude Domains — subtracts from another condition
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Subtracts from another condition's matches
      </text>

      {/* Two side-by-side input boxes */}
      <rect x={10} y={42} width={144} height={36} rx={4} fill={includeFill} stroke={includeStroke} />
      <text x={82} y={56} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        + REQUEST DOMAINS
      </text>
      <text x={82} y={71} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        openheaders.io
      </text>

      <rect x={166} y={42} width={144} height={36} rx={4} fill={excludeFill} stroke={excludeStroke} />
      <text x={238} y={56} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        − EXCLUDE DOMAINS
      </text>
      <text x={238} y={71} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        staging.openheaders.io
      </text>

      {/* Down arrow */}
      <line x1={160} y1={84} x2={160} y2={104} stroke={STROKE} strokeWidth={1.5} markerEnd="url(#cn-ex)" />

      {/* Result list */}
      <rect x={20} y={114} width={280} height={132} rx={4} fill="var(--ant-color-fill-quaternary)" stroke={STROKE} />
      <text x={32} y={132} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Final matched hosts:
      </text>

      {/* Matched (3) */}
      <text x={36} y={152} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={52} y={152} fontFamily="monospace" fontSize={10} fill={TEXT}>
        openheaders.io
      </text>

      <text x={36} y={168} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={52} y={168} fontFamily="monospace" fontSize={10} fill={TEXT}>
        api.openheaders.io
      </text>

      <text x={36} y={184} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={52} y={184} fontFamily="monospace" fontSize={10} fill={TEXT}>
        cdn.openheaders.io
      </text>

      {/* Excluded (2) — struck-through, dim */}
      <text x={36} y={206} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={52} y={206} fontFamily="monospace" fontSize={10} fill={TEXT_DIM} textDecoration="line-through">
        staging.openheaders.io
      </text>
      <text x={52} y={218} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        excluded
      </text>

      <text x={36} y={232} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={52} y={232} fontFamily="monospace" fontSize={10} fill={TEXT_DIM} textDecoration="line-through">
        a.b.staging.openheaders.io
      </text>
      <text x={52} y={244} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        excluded — subdomain rule applies to Exclude too
      </text>

      {/* Warning callout */}
      <rect x={14} y={260} width={292} height={42} rx={4} fill={warnFill} stroke={warnStroke} />
      <text x={26} y={279} fontSize={13} fontWeight={700} fill={warnStroke}>
        ⚠
      </text>
      <text x={44} y={277} fontSize={9} fontWeight={700} fill={TEXT}>
        Exclude alone matches nothing.
      </text>
      <text x={44} y={291} fontSize={9} fill={TEXT}>
        It only subtracts from another condition's matches.
      </text>
    </svg>
  );
};

/**
 * Initiator Domains — same fetch, different page origins.
 *
 * Beginners assume "domain conditions" all behave like Request
 * Domains (matching the destination). Initiator Domains matches the
 * PAGE the request came from. The visual hook: two side-by-side
 * scenario cards, both making the same fetch to api.openheaders.io,
 * but from different pages (portal.openheaders.io vs other-site.com).
 * Identical destination, different initiators → opposite outcomes.
 */
export const InitiatorDomainsDiagram: React.FC = () => {
  const matchBg = FILL_GREEN;
  const matchStroke = STROKE_GREEN;
  const failBg = 'var(--ant-color-error-bg)';
  const failStroke = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Initiator Domains: same destination, different page origins, opposite outcomes"
    >
      <ArrowDefs id="cn-init" />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Initiator Domains — match by which page made the call
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Same fetch, two page contexts → different outcomes
      </text>

      {/* Rule banner */}
      <rect x={36} y={36} width={248} height={22} rx={3} fill={FILL_CYAN} stroke={STROKE_CYAN} />
      <text x={160} y={51} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Initiator Domains: portal.openheaders.io
      </text>

      {/* LEFT scenario — page is portal.openheaders.io */}
      <rect x={10} y={70} width={140} height={80} rx={4} fill="var(--ant-color-bg-container)" stroke={STROKE_CYAN} />
      <text x={80} y={84} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT_DIM}>
        OPEN PAGE
      </text>
      <rect x={20} y={88} width={120} height={14} rx={2} fill={FILL_CYAN} stroke={STROKE_CYAN} />
      <text x={80} y={98} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        portal.openheaders.io
      </text>
      <text x={80} y={118} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        ↓ fetches
      </text>
      <text x={80} y={138} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        api.openheaders.io
      </text>

      {/* RIGHT scenario — page is other-site.com */}
      <rect
        x={170}
        y={70}
        width={140}
        height={80}
        rx={4}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE}
        strokeDasharray="2 2"
      />
      <text x={240} y={84} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT_DIM}>
        OPEN PAGE
      </text>
      <rect
        x={180}
        y={88}
        width={120}
        height={14}
        rx={2}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 2"
      />
      <text x={240} y={98} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        other-site.com
      </text>
      <text x={240} y={118} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        ↓ fetches
      </text>
      <text x={240} y={138} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        api.openheaders.io
      </text>

      {/* Down arrows to outcomes */}
      <line x1={80} y1={154} x2={80} y2={172} stroke={matchStroke} strokeWidth={1.5} markerEnd="url(#cn-init)" />
      <line x1={240} y1={154} x2={240} y2={172} stroke={failStroke} strokeWidth={1.5} markerEnd="url(#cn-init)" />

      {/* Outcome boxes */}
      <rect x={10} y={176} width={140} height={64} rx={4} fill={matchBg} stroke={matchStroke} />
      <text x={80} y={196} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        ✓ MATCHES
      </text>
      <line x1={20} y1={206} x2={140} y2={206} stroke={matchStroke} strokeDasharray="2 2" />
      <text x={80} y={222} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        initiator =
      </text>
      <text x={80} y={234} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={TEXT}>
        portal.openheaders.io
      </text>

      <rect x={170} y={176} width={140} height={64} rx={4} fill={failBg} stroke={failStroke} />
      <text x={240} y={196} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        ✗ NO MATCH
      </text>
      <line x1={180} y1={206} x2={300} y2={206} stroke={failStroke} strokeDasharray="2 2" />
      <text x={240} y={222} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        initiator =
      </text>
      <text x={240} y={234} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={TEXT}>
        other-site.com
      </text>

      {/* Footer hint */}
      <rect
        x={14}
        y={258}
        width={292}
        height={42}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={275} textAnchor="middle" fontSize={9} fill={TEXT}>
        Want to match by destination, not origin?
      </text>
      <text x={160} y={289} textAnchor="middle" fontSize={9} fill={TEXT}>
        Use <tspan fontWeight={600}>Request Domains</tspan> instead.
      </text>
    </svg>
  );
};
