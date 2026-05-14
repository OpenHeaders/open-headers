import type React from 'react';
import { ArrowDefs, FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap — Self-hosted web app.
 *
 * Server (your origin) → browser tab on your custom domain. The
 * browser-window card has an address bar showing the user's URL; the
 * page body shows the Workbench surface, identical to extension /
 * desktop. The point: same UI, your origin, your domain.
 */
export const RoadmapWebAppDiagram: React.FC = () => {
  const ID = 'rm-web';
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const SERVER_W = 120;
  const SERVER_H = 110;
  const SERVER_X = 24;
  const SERVER_Y = 70;

  const BROWSER_X = 180;
  const BROWSER_Y = 60;
  const BROWSER_W = W - BROWSER_X - 14;
  const BROWSER_H = 140;
  const CHROME_H = 24;
  const ADDR_H = 24;

  const VERDICT_Y = BROWSER_Y + BROWSER_H + 16;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Roadmap milestone — Self-hosted web app. Your origin serves the same UI bundle; users open it as a browser tab on a domain you control. Same Workbench surface, no extension required."
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Self-hosted VM deployment + Web App
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Your VM serves the web bundle — your origin, your domain, your users.
      </text>

      {/* Your origin / server */}
      <rect
        x={SERVER_X}
        y={SERVER_Y}
        width={SERVER_W}
        height={SERVER_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
      />
      <rect x={SERVER_X} y={SERVER_Y} width={SERVER_W} height={22} rx={6} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text
        x={SERVER_X + SERVER_W / 2}
        y={SERVER_Y + 15}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        Your VM
      </text>
      {[{ label: 'index.html' }, { label: 'assets/*' }, { label: 'sw.js' }].map((f, i) => (
        <g key={f.label}>
          <rect
            x={SERVER_X + 10}
            y={SERVER_Y + 32 + i * 22}
            width={SERVER_W - 20}
            height={18}
            rx={3}
            fill="var(--ant-color-fill-quaternary)"
            stroke="var(--ant-color-border)"
          />
          <text
            x={SERVER_X + SERVER_W / 2}
            y={SERVER_Y + 44 + i * 22}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize={9}
            fontWeight={700}
            fill={TEXT}
          >
            {f.label}
          </text>
        </g>
      ))}

      {/* Arrow server → browser */}
      <line
        x1={SERVER_X + SERVER_W + 4}
        y1={SERVER_Y + SERVER_H / 2}
        x2={BROWSER_X - 4}
        y2={BROWSER_Y + BROWSER_H / 2}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={(SERVER_X + SERVER_W + BROWSER_X) / 2}
        y={SERVER_Y + SERVER_H / 2 - 8}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fontWeight={700}
        fill={OH_GREEN}
      >
        serves
      </text>

      {/* Browser window */}
      <rect
        x={BROWSER_X}
        y={BROWSER_Y}
        width={BROWSER_W}
        height={BROWSER_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      {/* Chrome */}
      <rect
        x={BROWSER_X}
        y={BROWSER_Y}
        width={BROWSER_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      <circle cx={BROWSER_X + 12} cy={BROWSER_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
      <circle cx={BROWSER_X + 24} cy={BROWSER_Y + CHROME_H / 2} r={4} fill="#febc2e" />
      <circle cx={BROWSER_X + 36} cy={BROWSER_Y + CHROME_H / 2} r={4} fill="#28c840" />
      <text
        x={BROWSER_X + BROWSER_W / 2}
        y={BROWSER_Y + CHROME_H / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        Open Headers · web
      </text>
      {/* Address bar */}
      <rect
        x={BROWSER_X}
        y={BROWSER_Y + CHROME_H}
        width={BROWSER_W}
        height={ADDR_H}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
      />
      <rect
        x={BROWSER_X + 8}
        y={BROWSER_Y + CHROME_H + 5}
        width={BROWSER_W - 16}
        height={ADDR_H - 10}
        rx={(ADDR_H - 10) / 2}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text
        x={BROWSER_X + 18}
        y={BROWSER_Y + CHROME_H + ADDR_H / 2 + 4}
        fontFamily="monospace"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        https://oh.your-company.com/workbench
      </text>
      {/* Page body — workbench placeholder */}
      <rect
        x={BROWSER_X + 8}
        y={BROWSER_Y + CHROME_H + ADDR_H + 6}
        width={BROWSER_W - 16}
        height={BROWSER_H - CHROME_H - ADDR_H - 14}
        rx={4}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
      />
      <text
        x={BROWSER_X + BROWSER_W / 2}
        y={BROWSER_Y + CHROME_H + ADDR_H + 32}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        Workbench
      </text>
      <text
        x={BROWSER_X + BROWSER_W / 2}
        y={BROWSER_Y + CHROME_H + ADDR_H + 50}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        same surface as extension + desktop
      </text>

      {/* Verdict */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={OH_GREEN}>
        Same UI · your origin · no extension required
      </text>
    </svg>
  );
};
