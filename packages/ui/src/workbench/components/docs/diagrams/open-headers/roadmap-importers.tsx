import type React from 'react';
import { ArrowDefs, FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap — More importers.
 *
 * Funnel: five source formats on the left (cURL / HAR / Postman /
 * Insomnia / OpenAPI), all flowing into a single Open Headers workspace
 * on the right. Existing importers vs roadmap importers visually
 * distinguished — today's set is solid green, roadmap items are
 * dashed.
 */
export const RoadmapImportersDiagram: React.FC = () => {
  const ID = 'rm-imp';
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  type Source = { label: string; status: 'today' | 'roadmap'; note?: string };
  const SOURCES: Source[] = [
    { label: 'cURL', status: 'today' },
    { label: 'HAR', status: 'today', note: 'headers' },
    { label: 'Postman collection', status: 'today' },
    { label: 'HAR (full requests)', status: 'roadmap' },
    { label: 'Insomnia collection', status: 'roadmap' },
    { label: 'OpenAPI spec', status: 'roadmap' },
  ];

  const SRC_X = 16;
  const SRC_W = 168;
  const SRC_H = 30;
  const SRC_GAP = 6;
  const SRC_TOP = 64;
  const totalSrcH = SOURCES.length * SRC_H + (SOURCES.length - 1) * SRC_GAP;

  const WS_W = 200;
  const WS_H = 130;
  const WS_X = W - WS_W - 16;
  const WS_Y = SRC_TOP + (totalSrcH - WS_H) / 2;
  const CHROME_H = 24;

  const VERDICT_Y = SRC_TOP + totalSrcH + 18;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Roadmap milestone — Importers. Six source formats funnel into one Open Headers workspace. Today: cURL, HAR headers, Postman. Roadmap: HAR full requests, Insomnia, OpenAPI."
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Importers · bring your collection across
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        cURL, HAR, Postman today — Insomnia, OpenAPI, full HAR requests on the roadmap.
      </text>

      {/* Source format chips */}
      {SOURCES.map((s, i) => {
        const y = SRC_TOP + i * (SRC_H + SRC_GAP);
        const isToday = s.status === 'today';
        const stroke = isToday ? OH_GREEN : 'var(--ant-color-border)';
        const fill = isToday ? OH_GREEN_TINT : 'var(--ant-color-fill-quaternary)';
        const textColor = isToday ? TEXT : TEXT_DIM;
        const tagColor = isToday ? OH_GREEN : 'rgba(212, 145, 0, 1)';
        const tagBg = isToday ? OH_GREEN_TINT : 'rgba(250, 173, 20, 0.18)';
        return (
          <g key={s.label}>
            <rect
              x={SRC_X}
              y={y}
              width={SRC_W}
              height={SRC_H}
              rx={5}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.2}
              strokeDasharray={isToday ? undefined : '4 3'}
            />
            <text x={SRC_X + 12} y={y + SRC_H / 2 + 4} fontSize={10} fontWeight={700} fill={textColor}>
              {s.label}
            </text>
            {s.note && (
              <text
                x={SRC_X + 12 + s.label.length * 6.5 + 8}
                y={y + SRC_H / 2 + 4}
                fontSize={8.5}
                fontStyle="italic"
                fill={TEXT_DIM}
              >
                · {s.note}
              </text>
            )}
            {/* tier tag */}
            <rect
              x={SRC_X + SRC_W - 48}
              y={y + (SRC_H - 14) / 2}
              width={40}
              height={14}
              rx={7}
              fill={tagBg}
              stroke={tagColor}
              strokeWidth={1}
            />
            <text
              x={SRC_X + SRC_W - 28}
              y={y + SRC_H / 2 + 4}
              textAnchor="middle"
              fontSize={8}
              fontWeight={800}
              fill={tagColor}
              letterSpacing={0.4}
            >
              {isToday ? 'TODAY' : 'NEXT'}
            </text>
            {/* Funnel line to workspace */}
            <line
              x1={SRC_X + SRC_W + 2}
              y1={y + SRC_H / 2}
              x2={WS_X - 4}
              y2={WS_Y + WS_H / 2}
              stroke={isToday ? OH_GREEN : 'var(--ant-color-border)'}
              strokeWidth={1}
              strokeOpacity={isToday ? 0.7 : 0.45}
              strokeDasharray={isToday ? undefined : '3 2'}
              markerEnd={isToday ? `url(#${ID})` : undefined}
            />
          </g>
        );
      })}

      {/* Workspace target card — browser-styled */}
      <rect
        x={WS_X}
        y={WS_Y}
        width={WS_W}
        height={WS_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <rect
        x={WS_X}
        y={WS_Y}
        width={WS_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      <circle cx={WS_X + 12} cy={WS_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
      <circle cx={WS_X + 24} cy={WS_Y + CHROME_H / 2} r={4} fill="#febc2e" />
      <circle cx={WS_X + 36} cy={WS_Y + CHROME_H / 2} r={4} fill="#28c840" />
      <text x={WS_X + 50} y={WS_Y + CHROME_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
        Open Headers
      </text>
      <text
        x={WS_X + WS_W - 10}
        y={WS_Y + CHROME_H / 2 + 4}
        textAnchor="end"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        workspace
      </text>
      {/* Body — what arrives */}
      <text x={WS_X + 14} y={WS_Y + CHROME_H + 20} fontSize={9} fontWeight={800} fill={TEXT_DIM} letterSpacing={0.4}>
        IMPORTED INTO
      </text>
      {['HTTP Rules', 'API Request Collections', 'Environments', 'Vault entries'].map((label, i) => (
        <g key={label}>
          <circle cx={WS_X + 18} cy={WS_Y + CHROME_H + 36 + i * 16} r={2} fill={STROKE_BLUE} />
          <text x={WS_X + 26} y={WS_Y + CHROME_H + 39 + i * 16} fontSize={10} fontWeight={600} fill={TEXT}>
            {label}
          </text>
        </g>
      ))}

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
        Bring it across in one step — keep working
      </text>
    </svg>
  );
};
