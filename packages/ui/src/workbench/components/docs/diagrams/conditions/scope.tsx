import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_ORANGE,FILL_PURPLE,STROKE,STROKE_GREEN,STROKE_ORANGE,STROKE_PURPLE,TEXT,TEXT_DIM } from '../_shared';
import { FILL_CYAN,STROKE_CYAN,FILL_GOLD,STROKE_GOLD,FILL_MAGENTA,STROKE_MAGENTA } from './_shared';

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
  const t = useT();
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
      aria-label={t('workbench.docs.diagrams.conditions.methods.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.methods.title')}
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.methods.subtitle')}
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
        {t('workbench.docs.diagrams.conditions.shared.testRequests')}
      </text>

      <text x={24} y={118} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={118} fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.methods.testGet')}
      </text>

      <text x={24} y={136} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={136} fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.methods.testPost')}
      </text>

      <text x={24} y={158} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={158} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.methods.testPut')}
      </text>
      <text x={40} y={170} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.methods.notSelected')}
      </text>

      <text x={24} y={192} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={192} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.methods.testDelete')}
      </text>
      <text x={40} y={204} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.methods.notSelected')}
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
        {t('workbench.docs.diagrams.conditions.methods.footerQ')}
      </text>
      <text x={160} y={253} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.methods.footerA')}
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
  const t = useT();
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
      aria-label={t('workbench.docs.diagrams.conditions.resourceTypes.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.title')}
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.subtitle')}
      </text>

      {/* Row 1 — 5 pills, centered (5 × 40 + 4 × 4 = 216 → start x=52) */}
      {row1.map((m, i) => renderPill(m.name, 52 + i * 44, 42, m.selected))}
      {/* Row 2 — 4 pills, centered (4 × 40 + 3 × 4 = 172 → start x=74) */}
      {row2.map((m, i) => renderPill(m.name, 74 + i * 44, 68, m.selected))}

      <line x1={20} y1={104} x2={300} y2={104} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test requests */}
      <text x={20} y={120} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.testRequests')}
      </text>

      <text x={24} y={142} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={142} fontFamily="monospace" fontSize={9} fill={TEXT}>
        fetch('/api/users')
      </text>
      <text x={210} y={142} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.kindXhr')}
      </text>

      <text x={24} y={160} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={160} fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.testVisit')}
      </text>
      <text x={210} y={160} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.kindPage')}
      </text>

      <text x={24} y={182} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={182} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.testImage')}
      </text>
      <text x={210} y={182} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped')}
      </text>

      <text x={24} y={200} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={200} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.testScript')}
      </text>
      <text x={210} y={200} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped')}
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
        {t('workbench.docs.diagrams.conditions.resourceTypes.footerQ')}
      </text>
      <text x={160} y={253} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.resourceTypes.footerA')}
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
  const t = useT();
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  const fpFill = 'var(--ant-color-fill-quaternary)';
  const fpStroke = 'var(--ant-color-border)';
  const tpFill = FILL_GOLD;
  const tpStroke = STROKE_GOLD;
  const rows: { dest: string; party: string; matched: boolean }[] = [
    {
      dest: 'api.openheaders.com',
      party: t('workbench.docs.diagrams.conditions.domainType.partyFirst'),
      matched: false,
    },
    {
      dest: 'cdn.openheaders.com',
      party: t('workbench.docs.diagrams.conditions.domainType.partyFirst'),
      matched: false,
    },
    {
      dest: 'analytics.google.com',
      party: t('workbench.docs.diagrams.conditions.domainType.partyThird'),
      matched: true,
    },
    {
      dest: 'ads.example.com',
      party: t('workbench.docs.diagrams.conditions.domainType.partyThird'),
      matched: true,
    },
  ];
  return (
    <svg
      viewBox="0 0 320 290"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.conditions.domainType.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.domainType.title')}
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.subtitle')}
      </text>

      {/* Page banner */}
      <rect x={40} y={36} width={240} height={22} rx={3} fill={FILL_CYAN} stroke={STROKE_CYAN} />
      <text x={56} y={51} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.pageLabel')}
      </text>
      <text x={88} y={51} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        portal.openheaders.com
      </text>

      {/* Rule selector */}
      <text x={20} y={80} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.ruleSelection')}
      </text>
      <rect x={120} y={70} width={74} height={20} rx={3} fill={fpFill} stroke={fpStroke} />
      <text x={157} y={84} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={500} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.pillFirstParty')}
      </text>
      <rect x={200} y={70} width={74} height={20} rx={3} fill={tpFill} stroke={tpStroke} strokeWidth={1.5} />
      <text x={237} y={84} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.domainType.pillThirdParty')}
      </text>

      <line x1={20} y1={104} x2={300} y2={104} stroke={STROKE} strokeDasharray="2 3" />

      {/* Table header */}
      <text x={28} y={120} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.colDestination')}
      </text>
      <text x={195} y={120} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.colType')}
      </text>
      <text x={290} y={120} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.domainType.colMatch')}
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
        {t('workbench.docs.diagrams.conditions.domainType.footerBoth')}
      </text>
      <text x={160} y={275} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.domainType.footerRemove')}
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
  const t = useT();
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
      aria-label={t('workbench.docs.diagrams.conditions.headers.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.headers.title')}
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.subtitle')}
      </text>

      {/* Rule visualization */}
      <text x={20} y={60} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.ruleLabel')}
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
        {t('workbench.docs.diagrams.conditions.headers.exactName')}
      </text>
      <text x={216} y={82} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.exactValue')}
      </text>

      <line x1={20} y1={96} x2={300} y2={96} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test response headers */}
      <text x={20} y={112} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.testHeaders')}
      </text>

      <text x={24} y={132} fontSize={11} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={132} fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.headers.testJson')}
      </text>

      <text x={24} y={154} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={154} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.testHtml')}
      </text>
      <text x={40} y={166} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.reasonValue')}
      </text>

      <text x={24} y={186} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={186} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.testServer')}
      </text>
      <text x={40} y={198} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.reasonName')}
      </text>

      <text x={24} y={218} fontSize={11} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={218} fontFamily="monospace" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.absentLine')}
      </text>
      <text x={40} y={230} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.headers.reasonAbsent')}
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
        {t('workbench.docs.diagrams.conditions.headers.footer')}
      </text>
    </svg>
  );
};
