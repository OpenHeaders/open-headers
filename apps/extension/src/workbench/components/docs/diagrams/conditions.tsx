/**
 * Conditions — request-attribute mapping diagram.
 *
 * Replaces the old "URL anatomy" diagram which mixed two unrelated
 * visual ideas (URL slices + a footer of orthogonal conditions) and
 * never quite landed. The unifying mental model conditions actually
 * share is: each one tests ONE attribute of an outgoing request, and
 * a rule fires only if every condition's attribute matches (AND).
 *
 * Visual structure:
 *   - Header strip with column titles
 *   - Seven zebra-striped rows, each with a colored left accent bar
 *     (category color) and a filled pill on the right naming the
 *     condition type. Color travels left → right so the visual pair
 *     reads as one unit.
 *   - Bottom green callout ties the whole thing to the AND outcome.
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

interface Row {
  attr: string;
  value: string;
  cond: string;
  fill: string;
  stroke: string;
}

// Diagram-local colors for rows that don't map to one of the four
// shared palette constants. Translucent rgba so they re-tint cleanly
// across light and dark themes.
const FILL_CYAN = 'rgba(19, 194, 194, 0.14)';
const STROKE_CYAN = 'rgba(19, 194, 194, 0.55)';
const FILL_GOLD = 'rgba(250, 173, 20, 0.16)';
const STROKE_GOLD = 'rgba(250, 173, 20, 0.6)';
const FILL_MAGENTA = 'rgba(235, 47, 150, 0.12)';
const STROKE_MAGENTA = 'rgba(235, 47, 150, 0.55)';

/**
 * Host vs Origin clarifier — browser mockup visualizing the two
 * different URLs in a single fetch interaction.
 *
 * Beginners conflate "Request Domains" with "Initiator Domains"
 * because both look like host conditions. The visual hook here:
 * the address bar of the tab shows ONE URL (the page itself = the
 * origin, cyan), and the JS inside that page does fetch() to a
 * DIFFERENT URL (the destination = the host, green). Once a reader
 * sees those are distinct URLs in a real-looking browser, the two
 * conditions stop being the same thing.
 */
export const ConditionsHostVsOriginDiagram: React.FC = () => {
  const browserStroke = 'var(--ant-color-border)';
  const chromeBg = 'var(--ant-color-fill-secondary)';
  const inputBg = 'var(--ant-color-bg-container)';
  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Two URLs in one fetch — the address bar URL is the origin (Initiator Domains); the fetch destination URL is the host (Request Domains)"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Two URLs, two conditions
      </text>

      {/* Browser frame outline */}
      <rect x={20} y={22} width={280} height={128} rx={6} fill="none" stroke={browserStroke} />
      {/* Tab strip */}
      <rect x={21} y={23} width={278} height={24} fill={chromeBg} />
      {/* Content background */}
      <rect x={21} y={47} width={278} height={102} fill={inputBg} />
      <line x1={21} y1={47} x2={299} y2={47} stroke={browserStroke} />

      {/* Traffic lights */}
      <circle cx={32} cy={35} r={2.5} fill="#ef4444" />
      <circle cx={42} cy={35} r={2.5} fill="#f59e0b" />
      <circle cx={52} cy={35} r={2.5} fill="#10b981" />

      {/* Address bar */}
      <rect x={64} y={28} width={228} height={14} rx={2} fill={inputBg} stroke={browserStroke} />
      <rect x={68} y={30} width={130} height={10} rx={1} fill={FILL_CYAN} />
      <text x={76} y={38} fontFamily="monospace" fontSize={9} fill={TEXT}>
        portal.openheaders.io
      </text>

      {/* Caption above code */}
      <text x={160} y={64} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        JS in this page does:
      </text>

      {/* Code box */}
      <rect
        x={32}
        y={76}
        width={256}
        height={28}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={browserStroke}
        strokeDasharray="2 2"
      />
      <text x={44} y={95} fontFamily="monospace" fontSize={11} fill={TEXT_DIM}>
        fetch('
      </text>
      <rect x={92} y={84} width={160} height={16} rx={2} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={172} y={95} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.openheaders.io/v2/users
      </text>
      <text x={256} y={95} fontFamily="monospace" fontSize={11} fill={TEXT_DIM}>
        ')
      </text>

      <text x={160} y={130} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Same fetch — two different URLs.
      </text>

      {/* Legend */}
      <rect
        x={14}
        y={158}
        width={296}
        height={56}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={browserStroke}
        strokeDasharray="2 3"
      />
      <rect x={26} y={170} width={12} height={12} rx={2} fill={FILL_CYAN} stroke={STROKE_CYAN} />
      <text x={44} y={179} fontSize={9} fill={TEXT}>
        <tspan fontWeight={600}>origin</tspan> — the page URL → checked by{' '}
        <tspan fontWeight={600}>Initiator Domains</tspan>
      </text>
      <rect x={26} y={192} width={12} height={12} rx={2} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={44} y={201} fontSize={9} fill={TEXT}>
        <tspan fontWeight={600}>host</tspan> — the fetch destination → checked by{' '}
        <tspan fontWeight={600}>Request Domains</tspan>
      </text>
    </svg>
  );
};

const ROWS: Row[] = [
  { attr: 'method', value: 'POST', cond: 'Methods', fill: FILL_ORANGE, stroke: STROKE_ORANGE },
  { attr: 'URL', value: 'api.openheaders.io/v2/users', cond: 'URL Pattern', fill: FILL_BLUE, stroke: STROKE_BLUE },
  { attr: 'host', value: 'api.openheaders.io', cond: 'Request Domains', fill: FILL_GREEN, stroke: STROKE_GREEN },
  { attr: 'origin', value: 'portal.openheaders.io', cond: 'Initiator Domains', fill: FILL_CYAN, stroke: STROKE_CYAN },
  { attr: 'type', value: 'xhr', cond: 'Resource Types', fill: FILL_PURPLE, stroke: STROKE_PURPLE },
  { attr: 'party', value: 'third-party', cond: 'Domain Type', fill: FILL_GOLD, stroke: STROKE_GOLD },
  { attr: 'header', value: 'Cookie: session=abc', cond: 'Headers', fill: FILL_MAGENTA, stroke: STROKE_MAGENTA },
];

const ROW_H = 22;
const Y0 = 50;

export const ConditionsMatchingDiagram: React.FC = () => {
  const ID = 'cn-match';
  const tableEnd = Y0 + ROWS.length * ROW_H;
  return (
    <svg
      viewBox="0 0 320 290"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Each condition checks one attribute of a request — colored pills on the right name the condition type that checks each row's attribute. All conditions are AND-combined."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Each condition checks one attribute of a request
      </text>

      {/* Column headers */}
      <text x={100} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        REQUEST ATTRIBUTE
      </text>
      <text x={250} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        CHECKED BY
      </text>
      <line x1={10} y1={40} x2={310} y2={40} stroke={STROKE} strokeDasharray="2 3" />

      {ROWS.map((row, i) => {
        const y = Y0 + i * ROW_H;
        const baseline = y + 14;
        return (
          <g key={row.attr}>
            {/* Subtle zebra striping for readability */}
            {i % 2 === 1 && (
              <rect x={10} y={y} width={300} height={ROW_H} fill="var(--ant-color-fill-quaternary)" />
            )}
            {/* Left accent bar — category color */}
            <rect x={10} y={y + 2} width={3} height={ROW_H - 4} fill={row.stroke} />
            {/* Attribute label + value */}
            <text x={20} y={baseline} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
              {row.attr}:
            </text>
            <text x={58} y={baseline} fontFamily="monospace" fontSize={8} fill={TEXT}>
              {row.value}
            </text>
            {/* Connecting arrow */}
            <line
              x1={192}
              y1={y + ROW_H / 2}
              x2={208}
              y2={y + ROW_H / 2}
              stroke={STROKE}
              strokeWidth={1.25}
              markerEnd={`url(#${ID})`}
            />
            {/* Condition pill — fully filled, category color */}
            <rect
              x={212}
              y={y + 3}
              width={96}
              height={ROW_H - 6}
              rx={(ROW_H - 6) / 2}
              fill={row.fill}
              stroke={row.stroke}
              strokeWidth={1}
            />
            <text x={260} y={baseline} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
              {row.cond}
            </text>
          </g>
        );
      })}

      {/* Outcome — green callout ties everything to the AND result */}
      <line x1={10} y1={tableEnd + 8} x2={310} y2={tableEnd + 8} stroke={STROKE} strokeDasharray="2 3" />
      <rect
        x={50}
        y={tableEnd + 18}
        width={220}
        height={36}
        rx={4}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
      />
      <text
        x={160}
        y={tableEnd + 33}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={TEXT}
      >
        All must match (AND)
      </text>
      <text x={160} y={tableEnd + 47} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        → rule fires
      </text>
    </svg>
  );
};

/**
 * Conditions → rule fires → request changes — before/after diagram.
 *
 * Closes the loop opened by the matching diagram. The matching diagram
 * shows that all conditions test the request; this one shows what
 * happens AFTER all of them match — the rule's action runs and the
 * outgoing request is modified. Visualized as side-by-side BEFORE
 * and AFTER request cards, with the modified header struck-out red
 * on the left and highlighted green on the right.
 */
export const ConditionsRuleFiresDiagram: React.FC = () => {
  const ID = 'cn-fires';
  const cardStroke = 'var(--ant-color-border)';
  const cardBg = 'var(--ant-color-bg-container)';
  const errBg = 'var(--ant-color-error-bg)';
  const errStroke = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="When all conditions match, the rule fires — the Authorization header is replaced before the request leaves the browser"
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Conditions match → rule fires → request changes
      </text>

      {/* Rule definition card */}
      <rect
        x={20}
        y={24}
        width={280}
        height={26}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={cardStroke}
      />
      <text x={32} y={42} fontSize={10} fontWeight={600} fill={TEXT_DIM}>
        Rule:
      </text>
      <rect x={64} y={28} width={50} height={18} rx={9} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={89} y={41} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Override
      </text>
      <text x={122} y={42} fontFamily="monospace" fontSize={9} fill={TEXT}>
        Authorization: Bearer NEW
      </text>

      {/* Column labels */}
      <text x={80} y={70} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        BEFORE
      </text>
      <text x={240} y={70} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        AFTER
      </text>

      {/* BEFORE card */}
      <rect x={12} y={78} width={136} height={130} rx={4} fill={cardBg} stroke={cardStroke} />
      <text x={20} y={96} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        POST
      </text>
      <text x={20} y={108} fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.openheaders.io
      </text>
      <text x={20} y={120} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        /v2/users
      </text>
      <line x1={20} y1={128} x2={140} y2={128} stroke={cardStroke} strokeDasharray="2 2" />
      <text x={20} y={144} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Authorization:
      </text>
      <rect x={20} y={150} width={120} height={14} rx={2} fill={errBg} stroke={errStroke} />
      <text
        x={28}
        y={160}
        fontFamily="monospace"
        fontSize={10}
        fill={TEXT_DIM}
        textDecoration="line-through"
      >
        Bearer OLD
      </text>
      <text x={20} y={184} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Cookie:
      </text>
      <text x={20} y={196} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        session=abc
      </text>

      {/* Arrow between cards (aligned with the Authorization pill row) */}
      <line
        x1={152}
        y1={157}
        x2={168}
        y2={157}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text x={160} y={148} textAnchor="middle" fontSize={9} fontWeight={600} fill={STROKE_BLUE}>
        rule
      </text>
      <text x={160} y={172} textAnchor="middle" fontSize={9} fontWeight={600} fill={STROKE_BLUE}>
        fires
      </text>

      {/* AFTER card */}
      <rect x={172} y={78} width={136} height={130} rx={4} fill={cardBg} stroke={cardStroke} />
      <text x={180} y={96} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        POST
      </text>
      <text x={180} y={108} fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.openheaders.io
      </text>
      <text x={180} y={120} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        /v2/users
      </text>
      <line x1={180} y1={128} x2={300} y2={128} stroke={cardStroke} strokeDasharray="2 2" />
      <text x={180} y={144} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Authorization:
      </text>
      <rect x={180} y={150} width={120} height={14} rx={2} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={188} y={160} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Bearer NEW
      </text>
      <text x={180} y={184} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Cookie:
      </text>
      <text x={180} y={196} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        session=abc
      </text>

      {/* Footer */}
      <text x={160} y={232} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Rule changes only its target — rest passes through.
      </text>
    </svg>
  );
};

/**
 * URL Pattern — wildcard anatomy + match/no-match examples.
 *
 * Shows the pattern as three colored segments:
 *   - gold = wildcard chunks (`*://` and `/*`) — match anything
 *   - green = literal host (must match exactly)
 *
 * Below the pattern, four test URLs marked ✓ / ✗ make the
 * subdomain-mismatch failure mode concrete. Footer points at
 * Request Domains for the "all subdomains" case.
 */
export const UrlPatternDiagram: React.FC = () => {
  const wildcardFill = 'rgba(250, 173, 20, 0.18)';
  const wildcardStroke = 'rgba(250, 173, 20, 0.6)';
  const literalFill = FILL_GREEN;
  const literalStroke = STROKE_GREEN;
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="URL Pattern uses wildcards on the full URL — pattern anatomy plus match and no-match examples"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        URL Pattern — wildcards (*) on the full URL
      </text>

      {/* Pattern: 3 colored segments rendered side-by-side */}
      <rect x={70} y={26} width={28} height={20} rx={2} fill={wildcardFill} stroke={wildcardStroke} />
      <rect x={98} y={26} width={132} height={20} rx={2} fill={literalFill} stroke={literalStroke} />
      <rect x={230} y={26} width={20} height={20} rx={2} fill={wildcardFill} stroke={wildcardStroke} />

      <text x={84} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        *://
      </text>
      <text x={164} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        api.openheaders.io
      </text>
      <text x={240} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        /*
      </text>

      {/* Connector lines from each segment down to its label */}
      <line x1={84} y1={48} x2={84} y2={60} stroke={wildcardStroke} strokeWidth={1} />
      <line x1={164} y1={48} x2={164} y2={60} stroke={literalStroke} strokeWidth={1} />
      <line x1={240} y1={48} x2={240} y2={60} stroke={wildcardStroke} strokeWidth={1} />

      <text x={84} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        any
      </text>
      <text x={84} y={84} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        protocol
      </text>

      <text x={164} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        literal host
      </text>
      <text x={164} y={84} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        (no wildcards)
      </text>

      <text x={240} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        any path
      </text>
      <text x={240} y={84} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        + query string
      </text>

      {/* Color legend */}
      <rect x={20} y={100} width={10} height={10} fill={wildcardFill} stroke={wildcardStroke} />
      <text x={36} y={109} fontSize={9} fill={TEXT_DIM}>
        wildcard — matches anything
      </text>
      <rect x={170} y={100} width={10} height={10} fill={literalFill} stroke={literalStroke} />
      <text x={186} y={109} fontSize={9} fill={TEXT_DIM}>
        literal — exact match
      </text>

      <line x1={20} y1={124} x2={300} y2={124} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test URLs */}
      <text x={20} y={140} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Tested against URLs:
      </text>

      <text x={24} y={162} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={162} fontFamily="monospace" fontSize={9} fill={TEXT}>
        https://api.openheaders.io/v2/users
      </text>

      <text x={24} y={180} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={180} fontFamily="monospace" fontSize={9} fill={TEXT}>
        http://api.openheaders.io/health?ok=1
      </text>

      <text x={24} y={206} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={206} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        https://cdn.openheaders.io/img.png
      </text>
      <text x={40} y={218} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        "cdn" ≠ "api" — subdomain mismatch
      </text>

      <text x={24} y={240} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={240} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        https://other-site.com/api
      </text>
      <text x={40} y={252} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        different host entirely
      </text>

      {/* Footer suggestion */}
      <rect
        x={14}
        y={272}
        width={292}
        height={42}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={289} textAnchor="middle" fontSize={9} fill={TEXT}>
        Need to match all subdomains at once?
      </text>
      <text x={160} y={303} textAnchor="middle" fontSize={9} fill={TEXT}>
        Use <tspan fontWeight={600}>Request Domains: openheaders.io</tspan> instead.
      </text>
    </svg>
  );
};

/**
 * URL Regex — RE2 anatomy + match/no-match examples.
 *
 * Same teaching shape as UrlPatternDiagram but the colors carry
 * regex-specific meaning:
 *   - purple = regex syntax (anchors, character classes, quantifiers)
 *   - green = literal characters
 *
 * Beginners think anything containing a backslash is "regex magic";
 * the diagram makes it explicit that `\.` is just a literal dot —
 * the only real regex bits are `^` (start anchor) and `[0-9]+`
 * (digit class with one-or-more quantifier).
 */
export const UrlRegexDiagram: React.FC = () => {
  const regexFill = FILL_PURPLE;
  const regexStroke = STROKE_PURPLE;
  const literalFill = FILL_GREEN;
  const literalStroke = STROKE_GREEN;
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="URL Regex anatomy plus match and no-match examples — purple bits are real regex; everything else is literal"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        URL Regex — RE2 regex on the full URL
      </text>

      {/* Pattern: 3 segments — ^ (regex), literal middle, [0-9]+ (regex) */}
      <rect x={32} y={26} width={14} height={20} rx={2} fill={regexFill} stroke={regexStroke} />
      <rect x={46} y={26} width={198} height={20} rx={2} fill={literalFill} stroke={literalStroke} />
      <rect x={244} y={26} width={44} height={20} rx={2} fill={regexFill} stroke={regexStroke} />

      <text x={39} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        ^
      </text>
      <text x={145} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        https://api\.openheaders\.io/v
      </text>
      <text x={266} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        [0-9]+
      </text>

      {/* Connectors */}
      <line x1={39} y1={48} x2={39} y2={60} stroke={regexStroke} strokeWidth={1} />
      <line x1={145} y1={48} x2={145} y2={60} stroke={literalStroke} strokeWidth={1} />
      <line x1={266} y1={48} x2={266} y2={60} stroke={regexStroke} strokeWidth={1} />

      {/* Labels */}
      <text x={39} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        start
      </text>
      <text x={39} y={84} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        anchor
      </text>

      <text x={145} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        literal characters
      </text>
      <text x={145} y={84} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        (\. matches the . character)
      </text>

      <text x={266} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        one or more
      </text>
      <text x={266} y={84} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        digits
      </text>

      {/* Color legend */}
      <rect x={50} y={100} width={10} height={10} fill={regexFill} stroke={regexStroke} />
      <text x={66} y={109} fontSize={9} fill={TEXT_DIM}>
        regex syntax — special meaning
      </text>
      <rect x={210} y={100} width={10} height={10} fill={literalFill} stroke={literalStroke} />
      <text x={226} y={109} fontSize={9} fill={TEXT_DIM}>
        literal — exact match
      </text>

      <line x1={20} y1={124} x2={300} y2={124} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test URLs */}
      <text x={20} y={140} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Tested against URLs:
      </text>

      <text x={24} y={162} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={162} fontFamily="monospace" fontSize={9} fill={TEXT}>
        https://api.openheaders.io/v2
      </text>

      <text x={24} y={180} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={180} fontFamily="monospace" fontSize={9} fill={TEXT}>
        https://api.openheaders.io/v42/items?q=1
      </text>

      <text x={24} y={206} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={206} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        http://api.openheaders.io/v2
      </text>
      <text x={40} y={218} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        regex specifies https:// — http isn't matched
      </text>

      <text x={24} y={240} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={240} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        https://api.openheaders.io/latest
      </text>
      <text x={40} y={252} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        "latest" doesn't match /v[0-9]+
      </text>

      {/* Footer hint */}
      <rect
        x={14}
        y={272}
        width={292}
        height={42}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={289} textAnchor="middle" fontSize={9} fill={TEXT}>
        Want both http and https?
      </text>
      <text x={160} y={303} textAnchor="middle" fontSize={9} fill={TEXT}>
        Use{' '}
        <tspan fontFamily="monospace" fontWeight={600}>
          ^https?://
        </tspan>{' '}
        — the{' '}
        <tspan fontFamily="monospace" fontWeight={600}>
          ?
        </tspan>{' '}
        makes the s optional.
      </text>
    </svg>
  );
};

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
        Need to scope by path? Combine with{' '}
        <tspan fontWeight={600}>URL Pattern</tspan>.
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
      <rect
        x={20}
        y={114}
        width={280}
        height={132}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
      />
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
      <text
        x={52}
        y={206}
        fontFamily="monospace"
        fontSize={10}
        fill={TEXT_DIM}
        textDecoration="line-through"
      >
        staging.openheaders.io
      </text>
      <text x={52} y={218} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        excluded
      </text>

      <text x={36} y={232} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text
        x={52}
        y={232}
        fontFamily="monospace"
        fontSize={10}
        fill={TEXT_DIM}
        textDecoration="line-through"
      >
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

/**
 * Methods — multi-select pills + verb-based test requests.
 *
 * Beginners see "Methods" and assume single-select. The pill grid
 * shows all 7 common HTTP verbs at once with two visibly different
 * states — orange-filled = selected, gray-bordered = not selected —
 * so the multi-select nature is immediate. Test requests below tie
 * each verb back to a concrete request like `GET /api/users` so the
 * connection between selection and outcome is explicit.
 */
export const MethodsDiagram: React.FC = () => {
  const selectedFill = FILL_ORANGE;
  const selectedStroke = STROKE_ORANGE;
  const unselectedFill = 'var(--ant-color-fill-quaternary)';
  const unselectedStroke = 'var(--ant-color-border)';
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  const methods: { name: string; selected: boolean }[] = [
    { name: 'GET', selected: true },
    { name: 'POST', selected: true },
    { name: 'PUT', selected: false },
    { name: 'PATCH', selected: false },
    { name: 'DELETE', selected: false },
    { name: 'HEAD', selected: false },
    { name: 'OPTIONS', selected: false },
  ];
  return (
    <svg
      viewBox="0 0 320 268"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Methods — multi-select HTTP verbs; only the selected (orange) methods match"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Methods — pick which HTTP verbs match
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Multi-select — orange methods match; the rest don't trigger the rule
      </text>

      {/* Method pills */}
      {methods.map((m, i) => {
        const x = 12 + i * 44;
        const cx = x + 20;
        return (
          <g key={m.name}>
            <rect
              x={x}
              y={42}
              width={40}
              height={22}
              rx={3}
              fill={m.selected ? selectedFill : unselectedFill}
              stroke={m.selected ? selectedStroke : unselectedStroke}
              strokeWidth={m.selected ? 1.5 : 1}
            />
            <text
              x={cx}
              y={57}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={9}
              fontWeight={m.selected ? 700 : 500}
              fill={m.selected ? TEXT : TEXT_DIM}
            >
              {m.name}
            </text>
          </g>
        );
      })}

      <line x1={20} y1={80} x2={300} y2={80} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test requests */}
      <text x={20} y={96} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Test requests:
      </text>

      <text x={24} y={118} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={118} fontFamily="monospace" fontSize={9} fill={TEXT}>
        GET /api/users
      </text>

      <text x={24} y={136} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={136} fontFamily="monospace" fontSize={9} fill={TEXT}>
        POST /api/login
      </text>

      <text x={24} y={158} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={158} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        PUT /api/users/1
      </text>
      <text x={40} y={170} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        method not in selected list
      </text>

      <text x={24} y={192} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={192} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        DELETE /api/users/1
      </text>
      <text x={40} y={204} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        method not in selected list
      </text>

      {/* Footer */}
      <rect
        x={14}
        y={222}
        width={292}
        height={38}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={239} textAnchor="middle" fontSize={9} fill={TEXT}>
        Want to match every method?
      </text>
      <text x={160} y={253} textAnchor="middle" fontSize={9} fill={TEXT}>
        Remove this condition — it defaults to all methods.
      </text>
    </svg>
  );
};

/**
 * Resource Types — multi-select pills + kind-based test requests.
 *
 * Same teaching shape as MethodsDiagram so the multi-select pattern
 * transfers between the two conditions. Two rows of pills cover
 * Chrome's 11 ResourceType values; selected pills (Page + XHR) are
 * highlighted in purple. Each test request below names its kind
 * inline so the link from request → resource type → outcome is
 * traceable in one glance.
 */
export const ResourceTypesDiagram: React.FC = () => {
  const selectedFill = FILL_PURPLE;
  const selectedStroke = STROKE_PURPLE;
  const unselectedFill = 'var(--ant-color-fill-quaternary)';
  const unselectedStroke = 'var(--ant-color-border)';
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  const row1: { name: string; selected: boolean }[] = [
    { name: 'Page', selected: true },
    { name: 'Frame', selected: false },
    { name: 'XHR', selected: true },
    { name: 'Script', selected: false },
    { name: 'CSS', selected: false },
    { name: 'Image', selected: false },
  ];
  const row2: { name: string; selected: boolean }[] = [
    { name: 'Font', selected: false },
    { name: 'Media', selected: false },
    { name: 'WS', selected: false },
    { name: 'Ping', selected: false },
    { name: 'Other', selected: false },
  ];
  const renderPill = (name: string, x: number, y: number, selected: boolean) => (
    <g key={`${y}-${name}`}>
      <rect
        x={x}
        y={y}
        width={40}
        height={22}
        rx={3}
        fill={selected ? selectedFill : unselectedFill}
        stroke={selected ? selectedStroke : unselectedStroke}
        strokeWidth={selected ? 1.5 : 1}
      />
      <text
        x={x + 20}
        y={y + 15}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={9}
        fontWeight={selected ? 700 : 500}
        fill={selected ? TEXT : TEXT_DIM}
      >
        {name}
      </text>
    </g>
  );
  return (
    <svg
      viewBox="0 0 320 268"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Resource Types — multi-select request kinds; selected purple types match, others are skipped"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Resource Types — multi-select request kinds
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Purple kinds match; the rest don't trigger the rule
      </text>

      {/* Row 1 — 6 pills, centered */}
      {row1.map((m, i) => renderPill(m.name, 30 + i * 44, 42, m.selected))}
      {/* Row 2 — 5 pills, centered */}
      {row2.map((m, i) => renderPill(m.name, 52 + i * 44, 68, m.selected))}

      <line x1={20} y1={104} x2={300} y2={104} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test requests */}
      <text x={20} y={120} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Test requests:
      </text>

      <text x={24} y={142} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={142} fontFamily="monospace" fontSize={9} fill={TEXT}>
        fetch('/api/users')
      </text>
      <text x={210} y={142} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        xhr
      </text>

      <text x={24} y={160} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={160} fontFamily="monospace" fontSize={9} fill={TEXT}>
        visit /dashboard
      </text>
      <text x={210} y={160} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        page
      </text>

      <text x={24} y={182} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={182} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        GET /img/logo.png
      </text>
      <text x={210} y={182} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        image — skipped
      </text>

      <text x={24} y={200} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={200} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        GET /js/app.js
      </text>
      <text x={210} y={200} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        script — skipped
      </text>

      {/* Footer */}
      <rect
        x={14}
        y={222}
        width={292}
        height={38}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={239} textAnchor="middle" fontSize={9} fill={TEXT}>
        Want to match every resource type?
      </text>
      <text x={160} y={253} textAnchor="middle" fontSize={9} fill={TEXT}>
        Remove this condition — it defaults to all kinds.
      </text>
    </svg>
  );
};

/**
 * Domain Type — first-party vs third-party classifier.
 *
 * Each request from a page gets classified by whether its destination
 * shares the page's registrable domain (first-party) or not (third-
 * party). Diagram structure: page banner shows the origin, rule
 * selector pills mark which type the rule matches, and a 3-column
 * test table walks four destinations through their classification
 * and final match outcome. Reading left-to-right per row:
 * destination → its type → did it match the rule.
 */
export const DomainTypeDiagram: React.FC = () => {
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  const fpFill = 'var(--ant-color-fill-quaternary)';
  const fpStroke = 'var(--ant-color-border)';
  const tpFill = FILL_GOLD;
  const tpStroke = STROKE_GOLD;
  const rows: { dest: string; party: string; matched: boolean }[] = [
    { dest: 'api.openheaders.io', party: 'first-party', matched: false },
    { dest: 'cdn.openheaders.io', party: 'first-party', matched: false },
    { dest: 'analytics.google.com', party: 'third-party', matched: true },
    { dest: 'ads.example.com', party: 'third-party', matched: true },
  ];
  return (
    <svg
      viewBox="0 0 320 290"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Domain Type — each request is classified first-party (same registrable domain) or third-party; the rule selector decides which type matches"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Domain Type — first-party vs third-party
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Classified by relationship between the page and the request URL
      </text>

      {/* Page banner */}
      <rect x={40} y={36} width={240} height={22} rx={3} fill={FILL_CYAN} stroke={STROKE_CYAN} />
      <text x={56} y={51} fontSize={9} fill={TEXT_DIM}>
        Page:
      </text>
      <text x={88} y={51} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        portal.openheaders.io
      </text>

      {/* Rule selector */}
      <text x={20} y={80} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Rule selection:
      </text>
      <rect x={120} y={70} width={74} height={20} rx={3} fill={fpFill} stroke={fpStroke} />
      <text x={157} y={84} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={500} fill={TEXT_DIM}>
        firstParty
      </text>
      <rect x={200} y={70} width={74} height={20} rx={3} fill={tpFill} stroke={tpStroke} strokeWidth={1.5} />
      <text x={237} y={84} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        thirdParty
      </text>

      <line x1={20} y1={104} x2={300} y2={104} stroke={STROKE} strokeDasharray="2 3" />

      {/* Table header */}
      <text x={28} y={120} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        DESTINATION
      </text>
      <text x={195} y={120} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        TYPE
      </text>
      <text x={290} y={120} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        MATCH
      </text>

      {/* Rows */}
      {rows.map((r, i) => {
        const y = 142 + i * 22;
        return (
          <g key={r.dest}>
            <text x={28} y={y} fontFamily="monospace" fontSize={9} fill={r.matched ? TEXT : TEXT_DIM}>
              {r.dest}
            </text>
            <text x={195} y={y} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
              {r.party}
            </text>
            <text
              x={290}
              y={y}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={r.matched ? matchOk : matchFail}
            >
              {r.matched ? '✓' : '✗'}
            </text>
          </g>
        );
      })}

      {/* Footer */}
      <rect
        x={14}
        y={244}
        width={292}
        height={38}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={261} textAnchor="middle" fontSize={9} fill={TEXT}>
        Want both? Select firstParty AND thirdParty.
      </text>
      <text x={160} y={275} textAnchor="middle" fontSize={9} fill={TEXT}>
        Or remove the condition — defaults to both.
      </text>
    </svg>
  );
};

/**
 * Request / Response Headers — exact name + exact value match.
 *
 * Two magenta pills (header name and header value) joined by an
 * "=" sign make the two-part nature obvious. Sub-labels under each
 * pill spell out "exact name" / "exact value" so the no-wildcards
 * rule can't be missed. Test cases below cover the three distinct
 * failure modes — value differs, different header name, and header
 * absent entirely — so beginners see why exact match is strict.
 */
export const HeadersConditionDiagram: React.FC = () => {
  const headerFill = FILL_MAGENTA;
  const headerStroke = STROKE_MAGENTA;
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  return (
    <svg
      viewBox="0 0 320 282"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Headers condition — exact header name plus exact value, with test cases for each failure mode"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Headers — exact name + exact value match
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Both halves must match exactly — no wildcards, no partial matching
      </text>

      {/* Rule visualization */}
      <text x={20} y={60} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Rule:
      </text>
      <rect x={56} y={48} width={84} height={20} rx={3} fill={headerFill} stroke={headerStroke} strokeWidth={1.5} />
      <text
        x={98}
        y={62}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        Authorization
      </text>
      <text x={148} y={63} textAnchor="middle" fontSize={14} fontWeight={700} fill={TEXT_DIM}>
        =
      </text>
      <rect x={156} y={48} width={120} height={20} rx={3} fill={headerFill} stroke={headerStroke} strokeWidth={1.5} />
      <text
        x={216}
        y={62}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        Bearer test-token
      </text>
      <text x={98} y={82} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        exact name
      </text>
      <text x={216} y={82} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        exact value
      </text>

      <line x1={20} y1={96} x2={300} y2={96} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test request headers */}
      <text x={20} y={112} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Test request headers:
      </text>

      <text x={24} y={132} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={132} fontFamily="monospace" fontSize={9} fill={TEXT}>
        Authorization: Bearer test-token
      </text>

      <text x={24} y={154} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={154} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        Authorization: Bearer other-token
      </text>
      <text x={40} y={166} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        name matches, but value differs
      </text>

      <text x={24} y={186} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={186} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        Cookie: session=abc
      </text>
      <text x={40} y={198} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        different header name
      </text>

      <text x={24} y={218} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={218} fontFamily="monospace" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        (no Authorization header)
      </text>
      <text x={40} y={230} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        header absent — must be present to match
      </text>

      {/* Footer */}
      <rect
        x={14}
        y={248}
        width={292}
        height={26}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={265} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Common use: scope rules to authenticated or typed requests
      </text>
    </svg>
  );
};
