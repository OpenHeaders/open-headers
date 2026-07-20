import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * vs Cloud API platforms — where each piece of data physically lives.
 *
 * Two side-by-side panels, each with the same vertical rhythm:
 * (1) a small iconic visual, (2) a three-row "what lives where" table
 * with ✗ / ✓ glyphs. Symmetric so the eye reads the comparison row by
 * row.
 */
export const ComparisonVsCloudDiagram: React.FC = () => {
  const t = useT();
  const W = 480;
  const CX = W / 2;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const PANEL_Y = 60;
  const PANEL_W = (W - 36) / 2;
  const PANEL_LEFT_X = 12;
  const PANEL_RIGHT_X = W - PANEL_W - 12;
  const PANEL_HEADER_H = 24;

  const VISUAL_H = 88;
  const ROW_H = 18;
  const ROWS = 3;
  const PANEL_H = PANEL_HEADER_H + VISUAL_H + ROWS * ROW_H + 14;

  const VERDICT_Y = PANEL_Y + PANEL_H + 10;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;

  const ERR_RED = 'var(--ant-color-error)';
  const ERR_RED_BG = 'var(--ant-color-error-bg)';
  const ERR_RED_BORDER = 'var(--ant-color-error-border)';

  type Row = { label: string };
  const cloudRows: Row[] = [
    { label: t('workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials') },
    { label: t('workbench.docs.diagrams.openHeaders.vsCloud.rowRules') },
    { label: t('workbench.docs.diagrams.openHeaders.vsCloud.rowLogs') },
  ];

  const renderRows = (panelX: number, rows: Row[], tone: 'bad' | 'good') => {
    const startY = PANEL_Y + PANEL_HEADER_H + VISUAL_H + 4;
    const color = tone === 'good' ? OH_GREEN : ERR_RED;
    const glyph = tone === 'good' ? '✓' : '✗';
    const suffix =
      tone === 'good'
        ? t('workbench.docs.diagrams.openHeaders.vsCloud.onDevice')
        : t('workbench.docs.diagrams.openHeaders.vsCloud.onVendor');
    return rows.map((r, i) => (
      <g key={`${tone}-${i}`}>
        <text x={panelX + 14} y={startY + 12 + i * ROW_H} fontSize={10} fontWeight={800} fill={color}>
          {glyph}
        </text>
        <text x={panelX + 28} y={startY + 12 + i * ROW_H} fontSize={10} fontWeight={600} fill={TEXT}>
          {r.label}
        </text>
        <text
          x={panelX + PANEL_W - 12}
          y={startY + 12 + i * ROW_H}
          textAnchor="end"
          fontSize={9}
          fontStyle="italic"
          fill={color}
        >
          {suffix}
        </text>
      </g>
    ));
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.vsCloud.aria')}
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.vsCloud.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.vsCloud.subtitle')}
      </text>

      {/* LEFT panel — cloud, styled as a browser window */}
      <rect
        x={PANEL_LEFT_X}
        y={PANEL_Y}
        width={PANEL_W}
        height={PANEL_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={ERR_RED_BORDER}
        strokeWidth={1.4}
      />
      <rect
        x={PANEL_LEFT_X}
        y={PANEL_Y}
        width={PANEL_W}
        height={PANEL_HEADER_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={ERR_RED_BORDER}
      />
      <circle cx={PANEL_LEFT_X + 12} cy={PANEL_Y + PANEL_HEADER_H / 2} r={4} fill="#ff5f57" />
      <circle cx={PANEL_LEFT_X + 24} cy={PANEL_Y + PANEL_HEADER_H / 2} r={4} fill="#febc2e" />
      <circle cx={PANEL_LEFT_X + 36} cy={PANEL_Y + PANEL_HEADER_H / 2} r={4} fill="#28c840" />
      <text x={PANEL_LEFT_X + 50} y={PANEL_Y + PANEL_HEADER_H / 2 + 4} fontSize={11} fontWeight={700} fill={ERR_RED}>
        {t('workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform')}
      </text>

      {/* Cloud panel visual — device → cloud */}
      {(() => {
        const cx = PANEL_LEFT_X + PANEL_W / 2;
        const top = PANEL_Y + PANEL_HEADER_H + 8;
        const deviceX = cx - 70;
        const deviceY = top + 24;
        return (
          <g>
            {/* Device */}
            <rect
              x={deviceX}
              y={deviceY}
              width={48}
              height={36}
              rx={4}
              fill="var(--ant-color-bg-container)"
              stroke={STROKE_BLUE}
              strokeWidth={1.2}
            />
            <rect x={deviceX} y={deviceY} width={48} height={10} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={deviceX + 24} y={deviceY + 26} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
              {t('workbench.docs.diagrams.openHeaders.vsCloud.you')}
            </text>

            {/* Arrow */}
            <line
              x1={deviceX + 50}
              y1={deviceY + 18}
              x2={cx + 22}
              y2={deviceY + 18}
              stroke={ERR_RED}
              strokeWidth={1.4}
            />
            <polygon
              points={`${cx + 22},${deviceY + 18} ${cx + 18},${deviceY + 15} ${cx + 18},${deviceY + 21}`}
              fill={ERR_RED}
            />
            <text
              x={(deviceX + 50 + cx + 22) / 2}
              y={deviceY + 12}
              textAnchor="middle"
              fontSize={8.5}
              fontStyle="italic"
              fill={ERR_RED}
            >
              {t('workbench.docs.diagrams.openHeaders.vsCloud.yourData')}
            </text>

            {/* Cloud */}
            <path
              d={`M ${cx + 24} ${deviceY + 28}
                  c -10 0 -10 -12 0 -12
                  c 0 -10 14 -10 16 -2
                  c 2 -8 18 -6 18 4
                  c 8 0 8 10 0 10 Z`}
              fill={ERR_RED_BG}
              stroke={ERR_RED}
              strokeWidth={1.5}
            />
            <text x={cx + 44} y={deviceY + 22} textAnchor="middle" fontSize={9} fontWeight={800} fill={ERR_RED}>
              {t('workbench.docs.diagrams.openHeaders.vsCloud.cloud')}
            </text>
          </g>
        );
      })()}

      {renderRows(PANEL_LEFT_X, cloudRows, 'bad')}

      {/* RIGHT panel — Open Headers, same browser-window styling */}
      <rect
        x={PANEL_RIGHT_X}
        y={PANEL_Y}
        width={PANEL_W}
        height={PANEL_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={OH_GREEN}
        strokeWidth={2}
      />
      <rect
        x={PANEL_RIGHT_X}
        y={PANEL_Y}
        width={PANEL_W}
        height={PANEL_HEADER_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={OH_GREEN}
      />
      <circle cx={PANEL_RIGHT_X + 12} cy={PANEL_Y + PANEL_HEADER_H / 2} r={4} fill="#ff5f57" />
      <circle cx={PANEL_RIGHT_X + 24} cy={PANEL_Y + PANEL_HEADER_H / 2} r={4} fill="#febc2e" />
      <circle cx={PANEL_RIGHT_X + 36} cy={PANEL_Y + PANEL_HEADER_H / 2} r={4} fill="#28c840" />
      <text x={PANEL_RIGHT_X + 50} y={PANEL_Y + PANEL_HEADER_H / 2 + 4} fontSize={11} fontWeight={700} fill={OH_GREEN}>
        {t('workbench.docs.diagrams.openHeaders.shared.openHeaders')}
      </text>

      {/* OH panel visual — single device, contents inside */}
      {(() => {
        const cx = PANEL_RIGHT_X + PANEL_W / 2;
        const top = PANEL_Y + PANEL_HEADER_H + 8;
        const deviceW = 124;
        const deviceH = 60;
        const deviceX = cx - deviceW / 2;
        const deviceY = top + 12;
        return (
          <g>
            <rect
              x={deviceX}
              y={deviceY}
              width={deviceW}
              height={deviceH}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke={STROKE_BLUE}
              strokeWidth={1.5}
            />
            <rect x={deviceX} y={deviceY} width={deviceW} height={14} rx={5} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={cx} y={deviceY + 10} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={TEXT}>
              {t('workbench.docs.diagrams.openHeaders.vsCloud.yourDevice')}
            </text>
            <rect
              x={deviceX + 8}
              y={deviceY + 20}
              width={deviceW - 16}
              height={32}
              rx={3}
              fill={OH_GREEN_TINT}
              stroke={OH_GREEN}
              strokeOpacity={0.5}
            />
            <text x={cx} y={deviceY + 34} textAnchor="middle" fontSize={9} fontWeight={700} fill={OH_GREEN}>
              {t('workbench.docs.diagrams.openHeaders.vsCloud.deviceContents')}
            </text>
            <text x={cx} y={deviceY + 46} textAnchor="middle" fontSize={8.5} fontStyle="italic" fill={TEXT_DIM}>
              {t('workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace')}
            </text>
          </g>
        );
      })()}

      {renderRows(PANEL_RIGHT_X, cloudRows, 'good')}

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
        {t('workbench.docs.diagrams.openHeaders.vsCloud.verdict')}
      </text>
    </svg>
  );
};
