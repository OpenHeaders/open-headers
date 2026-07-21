/**
 * "How rules execute" — diagrams.
 *
 * Two diagrams for this section:
 *
 *   • ExecutionStackDiagram (intro) — shows where each engine
 *     intercepts the request lifecycle. The visual hook is that
 *     JS-initiated requests pass through BOTH engines (Script first,
 *     then DNR), while static / navigation requests bypass Script
 *     entirely and only hit DNR. That asymmetry is the whole point
 *     of the section.
 *
 *   • ExecutionScriptReachDiagram (Script subsection) — a paired
 *     "caught vs missed" visualization. Beginners need to see
 *     concretely what the script engine handles and what it ignores
 *     before the limitation callout makes sense.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ArrowDefs,
  Box,
  FILL_BLUE,
  FILL_GREEN,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

export const ExecutionStackDiagram: React.FC = () => {
  const t = useT();
  const ID = 'ex-stack';
  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.execution.stackAria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.stackTitle')}
      </text>

      {/* Source labels (above each top box) */}
      <text x={80} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.stackJsLane')}
      </text>
      <text x={240} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.stackStaticLane')}
      </text>

      {/* Top sources */}
      <Box
        x={30}
        y={38}
        w={100}
        h={36}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        label={t('workbench.docs.diagrams.execution.stackPageJs')}
        sub={t('workbench.docs.diagrams.execution.stackPageJsSub')}
      />
      <Box
        x={190}
        y={38}
        w={100}
        h={36}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        label={t('workbench.docs.diagrams.execution.stackBrowser')}
        sub={t('workbench.docs.diagrams.execution.stackBrowserSub')}
      />

      {/* Left lane — solid arrow into Script engine */}
      <line x1={80} y1={74} x2={80} y2={94} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Script Engine (left lane only) */}
      <Box
        x={30}
        y={96}
        w={100}
        h={36}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        label={t('workbench.docs.diagrams.execution.stackScriptEngine')}
        sub={t('workbench.docs.diagrams.execution.stackScriptEngineSub')}
      />

      {/* Right lane — long dashed arrow indicating "passes through, no script intercept" */}
      <line
        x1={240}
        y1={74}
        x2={240}
        y2={170}
        stroke={STROKE}
        strokeWidth={1.25}
        strokeDasharray="3 2"
        markerEnd={`url(#${ID})`}
      />
      <text x={250} y={120} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.stackBypasses1')}
      </text>
      <text x={250} y={132} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.stackBypasses2')}
      </text>

      {/* Left lane — Script down to DNR */}
      <line x1={80} y1={132} x2={80} y2={170} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* DNR engine — full width, both lanes terminate here */}
      <Box
        x={30}
        y={172}
        w={260}
        h={36}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
        label={t('workbench.docs.diagrams.execution.stackDnrEngine')}
        sub={t('workbench.docs.diagrams.execution.stackDnrEngineSub')}
      />

      {/* Down to network */}
      <line x1={160} y1={208} x2={160} y2={234} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <Box
        x={110}
        y={236}
        w={100}
        h={28}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE}
        label={t('workbench.docs.diagrams.execution.stackNetwork')}
      />

      <text x={160} y={275} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.stackFooter')}
      </text>
    </svg>
  );
};

/**
 * DNR reach — green checked-list of every resource type DNR sees.
 *
 * Pairs with the DNR subsection's "broad reach" claim. Beginners need
 * to see that "broad" is concrete: every kind of network request the
 * browser makes goes through DNR. The Script reach diagram is a
 * "caught vs missed" comparison; DNR's "missed" column is essentially
 * empty, so the parallel here is a single all-green list that
 * emphasizes coverage.
 */
export const ExecutionDnrReachDiagram: React.FC = () => {
  const t = useT();
  const items: [string, string][] = [
    [t('workbench.docs.diagrams.execution.dnrItemNav'), t('workbench.docs.diagrams.execution.dnrItemImages')],
    [t('workbench.docs.diagrams.execution.dnrItemSubFrame'), t('workbench.docs.diagrams.execution.dnrItemFonts')],
    [t('workbench.docs.diagrams.execution.dnrItemFetch'), t('workbench.docs.diagrams.execution.dnrItemMedia')],
    [t('workbench.docs.diagrams.execution.dnrItemScripts'), t('workbench.docs.diagrams.execution.dnrItemWebsocket')],
    [t('workbench.docs.diagrams.execution.dnrItemStylesheets'), t('workbench.docs.diagrams.execution.dnrItemPing')],
  ];
  return (
    <svg
      viewBox="0 0 320 180"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.execution.dnrAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.dnrTitle')}
      </text>

      <rect x={20} y={26} width={280} height={130} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />

      {items.map(([left, right], i) => {
        const y = 50 + i * 22;
        return (
          <g key={left}>
            <text x={36} y={y} fontSize={11} fontWeight={700} fill={STROKE_GREEN}>
              ✓
            </text>
            <text x={52} y={y} fontSize={11} fill={TEXT}>
              {left}
            </text>
            <text x={176} y={y} fontSize={11} fontWeight={700} fill={STROKE_GREEN}>
              ✓
            </text>
            <text x={192} y={y} fontSize={11} fill={TEXT}>
              {right}
            </text>
          </g>
        );
      })}

      <text x={160} y={172} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.dnrFooter')}
      </text>
    </svg>
  );
};

export const ExecutionScriptReachDiagram: React.FC = () => {
  const t = useT();
  const errBg = 'var(--ant-color-error-bg)';
  const errStroke = 'var(--ant-color-error-border)';
  const errText = 'var(--ant-color-error)';
  const okText = STROKE_GREEN;
  const codeFont = 'monospace';
  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.execution.reachAria')}
    >
      {/* Header bar — title */}
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachTitle')}
      </text>

      {/* LEFT — Caught */}
      <rect x={10} y={26} width={145} height={166} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={82} y={44} textAnchor="middle" fontSize={11} fontWeight={700} fill={okText}>
        {t('workbench.docs.diagrams.execution.reachCaught')}
      </text>
      <text x={82} y={58} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.reachCaughtSub')}
      </text>
      <line x1={20} y1={68} x2={145} y2={68} stroke={STROKE_GREEN} />
      <text x={20} y={88} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachFetch')}
      </text>
      <text x={20} y={108} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachXhr')}
      </text>
      <text x={20} y={128} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachSwFetch')}
      </text>
      <text x={32} y={140} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.reachInScope')}
      </text>

      {/* RIGHT — Missed */}
      <rect x={165} y={26} width={145} height={166} rx={4} fill={errBg} stroke={errStroke} />
      <text x={237} y={44} textAnchor="middle" fontSize={11} fontWeight={700} fill={errText}>
        {t('workbench.docs.diagrams.execution.reachMissed')}
      </text>
      <text x={237} y={58} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.reachMissedSub')}
      </text>
      <line x1={175} y1={68} x2={300} y2={68} stroke={errStroke} />
      <text x={175} y={88} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachImgSrc')}
      </text>
      <text x={175} y={108} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachScriptSrc')}
      </text>
      <text x={175} y={128} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachPageNav')}
      </text>
      <text x={175} y={148} fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.execution.reachBrowserInternal')}
      </text>
      <text x={175} y={168} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.execution.reachFaviconEtc')}
      </text>
    </svg>
  );
};
