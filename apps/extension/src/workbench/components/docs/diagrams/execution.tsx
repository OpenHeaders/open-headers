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
  const ID = 'ex-stack';
  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Where each engine intercepts the request flow — JS goes through Script then DNR; static and navigation skip Script"
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Where each engine intercepts
      </text>

      {/* Source labels (above each top box) */}
      <text x={80} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        JS-initiated
      </text>
      <text x={240} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Static / navigation
      </text>

      {/* Top sources */}
      <Box x={30} y={38} w={100} h={36} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Page JS" sub="fetch / XHR" />
      <Box x={190} y={38} w={100} h={36} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Browser" sub="<img>, nav, etc." />

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
        label="Script engine"
        sub="monkey-patch"
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
        bypasses
      </text>
      <text x={250} y={132} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        script engine
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
        label="DNR engine"
        sub="Chrome network — catches everything"
      />

      {/* Down to network */}
      <line x1={160} y1={208} x2={160} y2={234} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <Box x={110} y={236} w={100} h={28} fill="var(--ant-color-fill-secondary)" stroke={STROKE} label="Network" />

      <text x={160} y={275} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        DNR is broad; Script is narrow but can read response bodies.
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
  const items: [string, string][] = [
    ['page navigation', 'images'],
    ['sub-frame', 'fonts'],
    ['fetch / XHR', 'media'],
    ['scripts', 'websocket'],
    ['stylesheets', 'ping / beacon'],
  ];
  return (
    <svg
      viewBox="0 0 320 180"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="DNR's broad reach — every resource type the browser fetches is intercepted"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        DNR catches every kind of request
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
        every resource type the browser fetches
      </text>
    </svg>
  );
};

export const ExecutionScriptReachDiagram: React.FC = () => {
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
      aria-label="Script engine reach — what it catches versus what it bypasses"
    >
      {/* Header bar — title */}
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        What the script engine actually sees
      </text>

      {/* LEFT — Caught */}
      <rect x={10} y={26} width={145} height={166} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={82} y={44} textAnchor="middle" fontSize={11} fontWeight={700} fill={okText}>
        ✓ caught
      </text>
      <text x={82} y={58} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        the engine sees these
      </text>
      <line x1={20} y1={68} x2={145} y2={68} stroke={STROKE_GREEN} />
      <text x={20} y={88} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        fetch()
      </text>
      <text x={20} y={108} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        XMLHttpRequest
      </text>
      <text x={20} y={128} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        SW fetch
      </text>
      <text x={32} y={140} fontSize={9} fill={TEXT_DIM}>
        (in scope)
      </text>

      {/* RIGHT — Missed */}
      <rect x={165} y={26} width={145} height={166} rx={4} fill={errBg} stroke={errStroke} />
      <text x={237} y={44} textAnchor="middle" fontSize={11} fontWeight={700} fill={errText}>
        ✗ missed
      </text>
      <text x={237} y={58} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        bypasses entirely
      </text>
      <line x1={175} y1={68} x2={300} y2={68} stroke={errStroke} />
      <text x={175} y={88} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {'<img src>'}
      </text>
      <text x={175} y={108} fontFamily={codeFont} fontSize={10} fill={TEXT}>
        {'<script src>'}
      </text>
      <text x={175} y={128} fontSize={10} fill={TEXT}>
        page navigation
      </text>
      <text x={175} y={148} fontSize={10} fill={TEXT}>
        browser-internal
      </text>
      <text x={175} y={168} fontSize={9} fill={TEXT_DIM}>
        (favicon, etc.)
      </text>
    </svg>
  );
};
