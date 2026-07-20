import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

// CJK glyphs render close to the full em box, not the ~0.55em a Latin
// glyph averages — weigh them accordingly when sizing text-driven rules.
const unitLen = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.85 : 1), 0);

/**
 * Field-level sync diagram — two surfaces (popup + workbench) edit the
 * SAME rule at the same time, each touching a DIFFERENT field. The
 * sync engine lets both land — no stale-draft banner, no overwrite,
 * no "someone changed this while you were editing" prompt.
 *
 * Layout: two surface cards on top showing each surface's edit. Both
 * arrows feed into the rule entity below, which renders the merged
 * snapshot with BOTH fields highlighted green. The implementation
 * mechanism is deliberately not surfaced — the diagram shows the
 * observable behavior, not the proprietary engine internals.
 */
type FieldSyncEdit = {
  op: '+' | '~' | '-';
  field: string;
  value?: string;
  src: 'DevTools' | 'Workbench';
};

export const ParadigmFieldSyncDiagram: React.FC = () => {
  const t = useT();
  const ID = 'pg-sync';
  const srcLabel = (src: FieldSyncEdit['src']) =>
    src === 'DevTools'
      ? t('workbench.docs.diagrams.openHeaders.shared.devtools')
      : t('workbench.docs.diagrams.openHeaders.shared.workbench');

  const W = 480;
  const CX = W / 2;

  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  // Each surface = device chassis (laptop OR desktop monitor) wrapping a
  // browser-style window. Larger to fit chrome + action + a Rule X
  // mini-card showing several header edits.
  const SURF_Y = 58;
  const SURF_W = 220;
  const SURF_H = 188;
  const SURF_LEFT_X = 12;
  const SURF_RIGHT_X = W - SURF_W - 12;
  const CHROME_H = 22;
  const ACTION_H = 16;
  const ROW_H_INNER = 16;

  const BAND_Y = SURF_Y + SURF_H + 30;
  const BAND_H = 20;

  // Merged rule — diff-style change log of all six edits, grouped by
  // op so the eye can scan adds / modifies / deletes as blocks.
  const RULE_X = 28;
  const RULE_W = W - 56;
  const RULE_Y = BAND_Y + BAND_H + 18;
  const RULE_HEADER_H = 24;
  const MERGED_ROW_H = 18;
  const GROUP_LABEL_H = 16;
  const NUM_MERGED_ROWS = 6;
  const NUM_GROUPS = 3;
  const RULE_H = RULE_HEADER_H + NUM_GROUPS * GROUP_LABEL_H + NUM_MERGED_ROWS * MERGED_ROW_H + 14;

  const VERDICT_Y = RULE_Y + RULE_H + 16;
  const VERDICT_H = 44;
  const H = VERDICT_Y + VERDICT_H + 14;

  const leftEdits: FieldSyncEdit[] = [
    { op: '+', field: 'X-Trace-Id', value: '"abc-123"', src: 'DevTools' },
    { op: '~', field: 'Authorization', value: '"Bearer v2"', src: 'DevTools' },
    { op: '-', field: 'X-Old-Hdr', src: 'DevTools' },
  ];
  const rightEdits: FieldSyncEdit[] = [
    { op: '+', field: 'Cookie', value: '"session=…"', src: 'Workbench' },
    { op: '~', field: 'User-Agent', value: '"oh/5.0"', src: 'Workbench' },
    { op: '-', field: 'X-Debug-Token', src: 'Workbench' },
  ];
  const merged: FieldSyncEdit[] = [...leftEdits, ...rightEdits];

  const opColor = (op: FieldSyncEdit['op']) =>
    op === '+' ? OH_GREEN : op === '~' ? STROKE_BLUE : 'var(--ant-color-error)';
  const opFill = (op: FieldSyncEdit['op']) =>
    op === '+' ? OH_GREEN_TINT : op === '~' ? FILL_BLUE : 'var(--ant-color-error-bg)';

  const renderInnerEditRow = (x: number, y: number, w: number, e: FieldSyncEdit) => {
    const color = opColor(e.op);
    const fill = opFill(e.op);
    const text = e.value ? `${e.field}: ${e.value}` : e.field;
    return (
      <g>
        <rect x={x} y={y} width={w} height={ROW_H_INNER - 2} rx={3} fill={fill} stroke={color} strokeOpacity={0.55} />
        <text x={x + 6} y={y + 11} fontFamily="monospace" fontSize={10} fontWeight={800} fill={color}>
          {e.op}
        </text>
        <text
          x={x + 18}
          y={y + 11}
          fontFamily="monospace"
          fontSize={9}
          fontWeight={700}
          fill={TEXT}
          textDecoration={e.op === '-' ? 'line-through' : undefined}
        >
          {text}
        </text>
      </g>
    );
  };

  const renderDeviceChassis = (x: number, device: 'laptop' | 'desktop', chasH: number) => {
    if (device === 'laptop') {
      return (
        <g>
          {/* Lid */}
          <rect
            x={x + 4}
            y={SURF_Y}
            width={SURF_W - 8}
            height={chasH}
            rx={6}
            fill="var(--ant-color-fill-secondary)"
            stroke="var(--ant-color-border)"
            strokeWidth={1.5}
          />
          {/* Keyboard deck — wider than the lid to suggest open laptop */}
          <rect
            x={x}
            y={SURF_Y + chasH + 2}
            width={SURF_W}
            height={6}
            rx={2}
            fill="var(--ant-color-fill-tertiary)"
            stroke="var(--ant-color-border)"
          />
          <rect
            x={x + 8}
            y={SURF_Y + chasH + 8}
            width={SURF_W - 16}
            height={3}
            rx={1.5}
            fill="var(--ant-color-border)"
          />
        </g>
      );
    }
    return (
      <g>
        {/* Monitor bezel */}
        <rect
          x={x + 4}
          y={SURF_Y}
          width={SURF_W - 8}
          height={chasH}
          rx={4}
          fill="var(--ant-color-fill-secondary)"
          stroke="var(--ant-color-border)"
          strokeWidth={1.5}
        />
        {/* Neck */}
        <rect
          x={x + SURF_W / 2 - 12}
          y={SURF_Y + chasH}
          width={24}
          height={8}
          fill="var(--ant-color-fill-tertiary)"
          stroke="var(--ant-color-border)"
        />
        {/* Base */}
        <rect x={x + 24} y={SURF_Y + chasH + 8} width={SURF_W - 48} height={5} rx={2} fill="var(--ant-color-border)" />
      </g>
    );
  };

  const renderSurface = (
    x: number,
    device: 'laptop' | 'desktop',
    title: string,
    sideLabel: string,
    action: string,
    edits: FieldSyncEdit[],
  ) => {
    const FRAME_TOP_PAD = 8;
    const FRAME_SIDE_PAD = 10;
    const FRAME_BOT_RESERVE = device === 'laptop' ? 14 : 16;
    const chasH = SURF_H - FRAME_BOT_RESERVE;

    const winX = x + FRAME_SIDE_PAD;
    const winY = SURF_Y + FRAME_TOP_PAD;
    const winW = SURF_W - FRAME_SIDE_PAD * 2;
    const winH = chasH - FRAME_TOP_PAD * 2;

    const ruleX = winX + 6;
    const ruleW = winW - 12;
    const ruleY = winY + CHROME_H + ACTION_H + 4;
    const ruleH = winH - (CHROME_H + ACTION_H + 4) - 8;
    const RULE_HDR = 18;

    return (
      <g>
        {renderDeviceChassis(x, device, chasH)}

        {/* Browser window */}
        <rect
          x={winX}
          y={winY}
          width={winW}
          height={winH}
          rx={5}
          fill="var(--ant-color-bg-container)"
          stroke="var(--ant-color-border)"
        />
        {/* Chrome bar */}
        <rect
          x={winX}
          y={winY}
          width={winW}
          height={CHROME_H}
          rx={5}
          fill="var(--ant-color-fill-secondary)"
          stroke="var(--ant-color-border)"
        />
        <circle cx={winX + 9} cy={winY + CHROME_H / 2} r={3.5} fill="#ff5f57" />
        <circle cx={winX + 19} cy={winY + CHROME_H / 2} r={3.5} fill="#febc2e" />
        <circle cx={winX + 29} cy={winY + CHROME_H / 2} r={3.5} fill="#28c840" />
        <text x={winX + 42} y={winY + CHROME_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
          {title}
        </text>
        <text
          x={winX + winW - 6}
          y={winY + CHROME_H / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {sideLabel}
        </text>

        {/* Action label — what the user is doing on this surface */}
        <text x={winX + 8} y={winY + CHROME_H + 12} fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
          {action}
        </text>

        {/* Inner Rule X blue container */}
        <rect
          x={ruleX}
          y={ruleY}
          width={ruleW}
          height={ruleH}
          rx={4}
          fill="var(--ant-color-bg-container)"
          stroke={STROKE_BLUE}
          strokeWidth={1.2}
        />
        <rect x={ruleX} y={ruleY} width={ruleW} height={RULE_HDR} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={ruleX + 8} y={ruleY + 13} fontSize={10} fontWeight={700} fill={TEXT}>
          {t('workbench.docs.diagrams.openHeaders.fieldSync.ruleX')}
        </text>
        <text x={ruleX + ruleW - 8} y={ruleY + 13} textAnchor="end" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.openHeaders.fieldSync.headersTag')}
        </text>

        {/* Edit rows */}
        {edits.map((e, i) => (
          <g key={i}>{renderInnerEditRow(ruleX + 6, ruleY + RULE_HDR + 6 + i * ROW_H_INNER, ruleW - 12, e)}</g>
        ))}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.fieldSync.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.fieldSync.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.fieldSync.subtitle')}
      </text>

      {renderSurface(
        SURF_LEFT_X,
        'laptop',
        srcLabel('DevTools'),
        t('workbench.docs.diagrams.openHeaders.fieldSync.surfaceA'),
        t('workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders'),
        leftEdits,
      )}
      {renderSurface(
        SURF_RIGHT_X,
        'desktop',
        srcLabel('Workbench'),
        t('workbench.docs.diagrams.openHeaders.fieldSync.surfaceB'),
        t('workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders'),
        rightEdits,
      )}

      {/* Arrows from each surface down into the sync band */}
      <line
        x1={SURF_LEFT_X + SURF_W / 2}
        y1={SURF_Y + SURF_H + 2}
        x2={SURF_LEFT_X + SURF_W / 2}
        y2={BAND_Y - 2}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />
      <line
        x1={SURF_RIGHT_X + SURF_W / 2}
        y1={SURF_Y + SURF_H + 2}
        x2={SURF_RIGHT_X + SURF_W / 2}
        y2={BAND_Y - 2}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />

      {/* Sync band — its own row, clear separation from arrows and rule card */}
      <rect
        x={RULE_X}
        y={BAND_Y}
        width={RULE_W}
        height={BAND_H}
        rx={4}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text
        x={CX}
        y={BAND_Y + BAND_H / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={TEXT_DIM}
        letterSpacing={0.6}
      >
        {t('workbench.docs.diagrams.openHeaders.fieldSync.syncBand')}
      </text>

      {/* Arrow from sync band down into rule card */}
      <line
        x1={CX}
        y1={BAND_Y + BAND_H + 2}
        x2={CX}
        y2={RULE_Y - 2}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />

      {/* Merged rule snapshot */}
      <rect
        x={RULE_X}
        y={RULE_Y}
        width={RULE_W}
        height={RULE_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <rect x={RULE_X} y={RULE_Y} width={RULE_W} height={RULE_HEADER_H} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={RULE_X + 12} y={RULE_Y + 17} fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.fieldSync.ruleX')}
      </text>
      <text x={RULE_X + RULE_W - 12} y={RULE_Y + 17} textAnchor="end" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.fieldSync.mergedTag')}
      </text>

      {/* Diff-style change log — grouped by op so adds / modifies /
       *  deletes read as three visual blocks. */}
      {(() => {
        const groups: { op: FieldSyncEdit['op']; label: string; rows: FieldSyncEdit[] }[] = [
          {
            op: '+',
            label: t('workbench.docs.diagrams.openHeaders.fieldSync.groupAdded'),
            rows: merged.filter((e) => e.op === '+'),
          },
          {
            op: '~',
            label: t('workbench.docs.diagrams.openHeaders.fieldSync.groupModified'),
            rows: merged.filter((e) => e.op === '~'),
          },
          {
            op: '-',
            label: t('workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved'),
            rows: merged.filter((e) => e.op === '-'),
          },
        ];
        let cursor = RULE_Y + RULE_HEADER_H + 6;
        return groups.map((g) => {
          const labelY = cursor;
          const color = opColor(g.op);
          const groupNode = (
            <g key={g.op}>
              <text x={RULE_X + 14} y={labelY + 11} fontSize={9} fontWeight={800} fill={color} letterSpacing={0.6}>
                {g.label.toUpperCase()}
              </text>
              <line
                x1={RULE_X + 14 + Math.round(unitLen(g.label) * 6) + 8}
                y1={labelY + 8}
                x2={RULE_X + RULE_W - 14}
                y2={labelY + 8}
                stroke={color}
                strokeOpacity={0.25}
              />
              {g.rows.map((e, i) => {
                const ry = labelY + GROUP_LABEL_H + i * MERGED_ROW_H;
                const text = e.value ? `${e.field}: ${e.value}` : e.field;
                return (
                  <g key={i}>
                    <rect x={RULE_X + 14} y={ry + 2} width={3} height={MERGED_ROW_H - 4} rx={1.5} fill={color} />
                    <text
                      x={RULE_X + 24}
                      y={ry + 13}
                      fontFamily="monospace"
                      fontSize={11}
                      fontWeight={800}
                      fill={color}
                    >
                      {e.op}
                    </text>
                    <text
                      x={RULE_X + 40}
                      y={ry + 13}
                      fontFamily="monospace"
                      fontSize={10}
                      fontWeight={700}
                      fill={TEXT}
                      textDecoration={e.op === '-' ? 'line-through' : undefined}
                    >
                      {text}
                    </text>
                    <text
                      x={RULE_X + RULE_W - 12}
                      y={ry + 13}
                      textAnchor="end"
                      fontSize={9}
                      fontStyle="italic"
                      fill={TEXT_DIM}
                    >
                      {t('workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix')}
                      {srcLabel(e.src)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
          cursor += GROUP_LABEL_H + g.rows.length * MERGED_ROW_H;
          return groupNode;
        });
      })()}

      {/* Bottom verdict strip — two clear lines, no overflow */}
      <rect x={RULE_X} y={VERDICT_Y} width={RULE_W} height={VERDICT_H} rx={5} fill={OH_GREEN_TINT} stroke={OH_GREEN} />
      <text x={CX} y={VERDICT_Y + 18} textAnchor="middle" fontSize={11} fontWeight={700} fill={OH_GREEN}>
        {t('workbench.docs.diagrams.openHeaders.fieldSync.verdict1')}
      </text>
      <text x={CX} y={VERDICT_Y + 34} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.fieldSync.verdict2')}
      </text>
    </svg>
  );
};
