import type React from 'react';
import { FILL_ORANGE,FILL_PURPLE,STROKE,STROKE_GREEN,STROKE_ORANGE,STROKE_PURPLE,TEXT,TEXT_DIM } from '../_shared';
import { Row,FILL_CYAN,STROKE_CYAN,FILL_GOLD,STROKE_GOLD,FILL_MAGENTA,STROKE_MAGENTA } from './_shared';

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
  // 9 types — matches what the rule editor's Resource Types multi-select
  // exposes. Chrome DNR has more enum values (sub_frame, ping, etc.) but
  // the editor curates these 9 as the user-pickable set.
  const row1: { name: string; selected: boolean }[] = [
    { name: 'Page', selected: true },
    { name: 'XHR', selected: true },
    { name: 'Script', selected: false },
    { name: 'CSS', selected: false },
    { name: 'Image', selected: false },
  ];
  const row2: { name: string; selected: boolean }[] = [
    { name: 'Font', selected: false },
    { name: 'Media', selected: false },
    { name: 'WS', selected: false },
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

      {/* Row 1 — 5 pills, centered (5 × 40 + 4 × 4 = 216 → start x=52) */}
      {row1.map((m, i) => renderPill(m.name, 52 + i * 44, 42, m.selected))}
      {/* Row 2 — 4 pills, centered (4 × 40 + 3 × 4 = 172 → start x=74) */}
      {row2.map((m, i) => renderPill(m.name, 74 + i * 44, 68, m.selected))}

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
 * Response Headers — exact name + exact value match.
 *
 * Chrome DNR only exposes RESPONSE-side header matching; there's no
 * way to match on a request header from a rule condition. The
 * diagram therefore frames everything around responses: rule sample
 * is `Content-Type = application/json`, test cases are response
 * header lines, and failure modes cover value mismatch, different
 * header name, and absent header.
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
      aria-label="Response Headers condition — exact name plus exact value, response-side only (Chrome DNR doesn't match on request headers)"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Response Headers — exact name + exact value
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Response-side only — Chrome DNR doesn't match request headers
      </text>

      {/* Rule visualization */}
      <text x={20} y={60} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Rule:
      </text>
      <rect x={56} y={48} width={84} height={20} rx={3} fill={headerFill} stroke={headerStroke} strokeWidth={1.5} />
      <text x={98} y={62} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        Content-Type
      </text>
      <text x={148} y={63} textAnchor="middle" fontSize={14} fontWeight={700} fill={TEXT_DIM}>
        =
      </text>
      <rect x={156} y={48} width={120} height={20} rx={3} fill={headerFill} stroke={headerStroke} strokeWidth={1.5} />
      <text x={216} y={62} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        application/json
      </text>
      <text x={98} y={82} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        exact name
      </text>
      <text x={216} y={82} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        exact value
      </text>

      <line x1={20} y1={96} x2={300} y2={96} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test response headers */}
      <text x={20} y={112} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Test response headers:
      </text>

      <text x={24} y={132} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={132} fontFamily="monospace" fontSize={9} fill={TEXT}>
        Content-Type: application/json
      </text>

      <text x={24} y={154} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={154} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        Content-Type: text/html
      </text>
      <text x={40} y={166} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        name matches, but value differs
      </text>

      <text x={24} y={186} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={186} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        Server: nginx
      </text>
      <text x={40} y={198} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        different header name
      </text>

      <text x={24} y={218} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={218} fontFamily="monospace" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        (response without Content-Type)
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
        Common use: filter rules by response Content-Type or custom flags
      </text>
    </svg>
  );
};
