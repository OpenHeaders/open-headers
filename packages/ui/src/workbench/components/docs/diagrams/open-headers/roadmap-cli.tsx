import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN } from './_shared';

/**
 * Roadmap — CLI.
 *
 * A single terminal window with chrome bar (traffic lights styled as
 * red close / yellow minimize / green maximize) and a dark body showing
 * four example commands with output. The terminal is the surface; the
 * back-end is the same daemon the UI uses.
 */
export const RoadmapCliDiagram: React.FC = () => {
  const t = useT();
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const TERM_X = 30;
  const TERM_W = W - 60;
  const TERM_Y = 64;
  const TERM_H = 224;
  const CHROME_H = 24;
  const TERM_BG = 'var(--ant-color-text)'; // dark — flips in dark mode

  const VERDICT_Y = TERM_Y + TERM_H + 16;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  type Line = { kind: 'prompt' | 'output' | 'comment'; text: string };
  const LINES: Line[] = [
    { kind: 'prompt', text: '$ oh rules list' },
    { kind: 'output', text: '  3 enabled · 1 disabled · workspace acme' },
    { kind: 'prompt', text: '$ oh env switch staging' },
    { kind: 'output', text: '  active environment: staging (env-a1)' },
    { kind: 'prompt', text: '$ oh request send ping' },
    { kind: 'output', text: '  GET api.openheaders.com/ping → 200 OK · 11 B · 83 ms' },
    { kind: 'comment', text: t('workbench.docs.diagrams.openHeaders.roadmapCli.comment') },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.roadmapCli.aria')}
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.roadmapCli.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.roadmapCli.subtitle')}
      </text>

      {/* Terminal window */}
      <rect
        x={TERM_X}
        y={TERM_Y}
        width={TERM_W}
        height={TERM_H}
        rx={8}
        fill={TERM_BG}
        stroke="var(--ant-color-border)"
        strokeWidth={1.4}
      />
      {/* Chrome bar */}
      <rect
        x={TERM_X}
        y={TERM_Y}
        width={TERM_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <circle cx={TERM_X + 12} cy={TERM_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
      <circle cx={TERM_X + 24} cy={TERM_Y + CHROME_H / 2} r={4} fill="#febc2e" />
      <circle cx={TERM_X + 36} cy={TERM_Y + CHROME_H / 2} r={4} fill="#28c840" />
      <text
        x={TERM_X + TERM_W / 2}
        y={TERM_Y + CHROME_H / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        {t('workbench.docs.diagrams.openHeaders.roadmapCli.termTitle')}
      </text>

      {/* Lines */}
      {LINES.map((l, i) => {
        const y = TERM_Y + CHROME_H + 22 + i * 22;
        const color =
          l.kind === 'prompt'
            ? OH_GREEN
            : l.kind === 'comment'
              ? 'var(--ant-color-bg-container)'
              : 'var(--ant-color-bg-container)';
        const opacity = l.kind === 'output' ? 0.78 : l.kind === 'comment' ? 0.5 : 1;
        const style = l.kind === 'comment' ? 'italic' : undefined;
        return (
          <text
            key={i}
            x={TERM_X + 16}
            y={y}
            fontFamily="monospace"
            fontSize={11}
            fontWeight={l.kind === 'prompt' ? 700 : 500}
            fill={color}
            opacity={opacity}
            fontStyle={style}
          >
            {l.text}
          </text>
        );
      })}
      {/* Blinking cursor */}
      <rect x={TERM_X + 16} y={TERM_Y + CHROME_H + 22 + LINES.length * 22 - 11} width={8} height={12} fill={OH_GREEN}>
        <animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="indefinite" />
      </rect>

      {/* Verdict */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.roadmapCli.verdict')}
      </text>
    </svg>
  );
};
