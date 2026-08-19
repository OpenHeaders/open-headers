import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs,FILL_BLUE,FILL_GREEN,FILL_ORANGE,FILL_PURPLE,STROKE,STROKE_BLUE,STROKE_GREEN,STROKE_ORANGE,STROKE_PURPLE,TEXT,TEXT_DIM } from '../_shared';
import { Row,FILL_CYAN,STROKE_CYAN,FILL_GOLD,STROKE_GOLD,FILL_MAGENTA,STROKE_MAGENTA } from './_shared';

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
  const t = useT();
  const browserStroke = 'var(--ant-color-border)';
  const chromeBg = 'var(--ant-color-fill-secondary)';
  const inputBg = 'var(--ant-color-bg-container)';
  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.conditions.hostVsOrigin.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.hostVsOrigin.title')}
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
        portal.openheaders.com
      </text>

      {/* Caption above code */}
      <text x={160} y={64} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes')}
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
        {t('workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen')}
      </text>
      <rect x={92} y={84} width={160} height={16} rx={2} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={172} y={95} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.openheaders.com/v2/users
      </text>
      <text x={256} y={95} fontFamily="monospace" fontSize={11} fill={TEXT_DIM}>
        ')
      </text>

      <text x={160} y={130} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch')}
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
        <tspan fontWeight={600}>{t('workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm')}</tspan>
        {t('workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest')}
        <tspan fontWeight={600}>{t('workbench.docs.diagrams.conditions.shared.initiatorDomainsName')}</tspan>
      </text>
      <rect x={26} y={192} width={12} height={12} rx={2} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={44} y={201} fontSize={9} fill={TEXT}>
        <tspan fontWeight={600}>{t('workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm')}</tspan>
        {t('workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest')}
        <tspan fontWeight={600}>{t('workbench.docs.diagrams.conditions.shared.requestDomainsName')}</tspan>
      </text>
    </svg>
  );
};

const ROW_H = 22;
const Y0 = 50;

export const ConditionsMatchingDiagram: React.FC = () => {
  const t = useT();
  const ID = 'cn-match';
  const rows: Row[] = [
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrMethod'),
      value: 'POST',
      cond: t('workbench.docs.diagrams.conditions.matching.condMethods'),
      fill: FILL_ORANGE,
      stroke: STROKE_ORANGE,
    },
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrUrl'),
      value: 'api.openheaders.com/v2/users',
      cond: t('workbench.docs.diagrams.conditions.matching.condUrlPattern'),
      fill: FILL_BLUE,
      stroke: STROKE_BLUE,
    },
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrHost'),
      value: 'api.openheaders.com',
      cond: t('workbench.docs.diagrams.conditions.matching.condRequestDomains'),
      fill: FILL_GREEN,
      stroke: STROKE_GREEN,
    },
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrOrigin'),
      value: 'portal.openheaders.com',
      cond: t('workbench.docs.diagrams.conditions.matching.condInitiatorDomains'),
      fill: FILL_CYAN,
      stroke: STROKE_CYAN,
    },
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrType'),
      value: 'xhr',
      cond: t('workbench.docs.diagrams.conditions.matching.condResourceTypes'),
      fill: FILL_PURPLE,
      stroke: STROKE_PURPLE,
    },
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrParty'),
      value: 'third-party',
      cond: t('workbench.docs.diagrams.conditions.matching.condDomainType'),
      fill: FILL_GOLD,
      stroke: STROKE_GOLD,
    },
    {
      attr: t('workbench.docs.diagrams.conditions.matching.attrHeader'),
      value: 'Content-Type: application/json',
      cond: t('workbench.docs.diagrams.conditions.matching.condHeaders'),
      fill: FILL_MAGENTA,
      stroke: STROKE_MAGENTA,
    },
  ];
  const tableEnd = Y0 + rows.length * ROW_H;
  return (
    <svg
      viewBox="0 0 380 290"
      width="100%"
      style={{ maxWidth: 460 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.conditions.matching.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={190} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.matching.title')}
      </text>

      {/* Column headers */}
      <text x={110} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.matching.colAttribute')}
      </text>
      <text x={300} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.matching.colCheckedBy')}
      </text>
      <line x1={10} y1={40} x2={370} y2={40} stroke={STROKE} strokeDasharray="2 3" />

      {rows.map((row, i) => {
        const y = Y0 + i * ROW_H;
        const baseline = y + 14;
        return (
          <g key={row.attr}>
            {/* Subtle zebra striping for readability */}
            {i % 2 === 1 && <rect x={10} y={y} width={360} height={ROW_H} fill="var(--ant-color-fill-quaternary)" />}
            {/* Left accent bar — category color */}
            <rect x={10} y={y + 2} width={3} height={ROW_H - 4} fill={row.stroke} />
            {/* Attribute label + value */}
            <text x={20} y={baseline} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
              {row.attr}
            </text>
            <text x={72} y={baseline} fontFamily="monospace" fontSize={8} fill={TEXT}>
              {row.value}
            </text>
            {/* Connecting arrow */}
            <line
              x1={222}
              y1={y + ROW_H / 2}
              x2={238}
              y2={y + ROW_H / 2}
              stroke={STROKE}
              strokeWidth={1.25}
              markerEnd={`url(#${ID})`}
            />
            {/* Condition pill — fully filled, category color */}
            <rect
              x={242}
              y={y + 3}
              width={116}
              height={ROW_H - 6}
              rx={(ROW_H - 6) / 2}
              fill={row.fill}
              stroke={row.stroke}
              strokeWidth={1}
            />
            <text x={300} y={baseline} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
              {row.cond}
            </text>
          </g>
        );
      })}

      {/* Outcome — green callout ties everything to the AND result */}
      <line x1={10} y1={tableEnd + 8} x2={370} y2={tableEnd + 8} stroke={STROKE} strokeDasharray="2 3" />
      <rect x={80} y={tableEnd + 18} width={220} height={36} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={190} y={tableEnd + 33} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.matching.allMustMatch')}
      </text>
      <text x={190} y={tableEnd + 47} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.matching.ruleFires')}
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
  const t = useT();
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
      aria-label={t('workbench.docs.diagrams.conditions.ruleFires.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.ruleFires.title')}
      </text>

      {/* Rule definition card */}
      <rect x={20} y={24} width={280} height={26} rx={4} fill="var(--ant-color-fill-quaternary)" stroke={cardStroke} />
      <text x={32} y={42} fontSize={10} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.ruleLabel')}
      </text>
      <rect x={64} y={28} width={50} height={18} rx={9} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={89} y={41} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.ruleFires.opOverride')}
      </text>
      <text x={122} y={42} fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.ruleFires.ruleValue')}
      </text>

      {/* Column labels */}
      <text x={80} y={70} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.beforeKicker')}
      </text>
      <text x={240} y={70} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.afterKicker')}
      </text>

      {/* BEFORE card */}
      <rect x={12} y={78} width={136} height={130} rx={4} fill={cardBg} stroke={cardStroke} />
      <text x={20} y={96} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        POST
      </text>
      <text x={20} y={108} fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.openheaders.com
      </text>
      <text x={20} y={120} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        /v2/users
      </text>
      <line x1={20} y1={128} x2={140} y2={128} stroke={cardStroke} strokeDasharray="2 2" />
      <text x={20} y={144} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Authorization:
      </text>
      <rect x={20} y={150} width={120} height={14} rx={2} fill={errBg} stroke={errStroke} />
      <text x={28} y={160} fontFamily="monospace" fontSize={10} fill={TEXT_DIM} textDecoration="line-through">
        {t('workbench.docs.diagrams.conditions.ruleFires.beforeOld')}
      </text>
      <text x={20} y={184} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Cookie:
      </text>
      <text x={20} y={196} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.ruleFires.lineSession')}
      </text>

      {/* Arrow between cards (aligned with the Authorization pill row) */}
      <line x1={152} y1={157} x2={168} y2={157} stroke={STROKE_BLUE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={160} y={148} textAnchor="middle" fontSize={9} fontWeight={600} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.conditions.ruleFires.arrowRule')}
      </text>
      <text x={160} y={172} textAnchor="middle" fontSize={9} fontWeight={600} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.conditions.ruleFires.arrowFires')}
      </text>

      {/* AFTER card */}
      <rect x={172} y={78} width={136} height={130} rx={4} fill={cardBg} stroke={cardStroke} />
      <text x={180} y={96} fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        POST
      </text>
      <text x={180} y={108} fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.openheaders.com
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
        {t('workbench.docs.diagrams.conditions.ruleFires.afterNew')}
      </text>
      <text x={180} y={184} fontFamily="monospace" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Cookie:
      </text>
      <text x={180} y={196} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.ruleFires.lineSession')}
      </text>

      {/* Footer */}
      <text x={160} y={232} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.ruleFires.footer')}
      </text>
    </svg>
  );
};
