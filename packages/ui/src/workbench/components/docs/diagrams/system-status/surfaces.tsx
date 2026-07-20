import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs,STROKE,STROKE_BLUE,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS,ERROR,SUCCESS_BG,WARNING_BG,ERROR_BG,GREY_BG,BORDER,FILL_SECONDARY,BG_CONTAINER,Level,dotColor,OhLogo,BrowserFrame } from './_shared';

const SUBSYSTEM_KEYS = [
  'workbench.docs.diagrams.systemStatus.shared.sync',
  'workbench.docs.diagrams.systemStatus.shared.rules',
  'workbench.docs.diagrams.systemStatus.shared.requests',
  'workbench.docs.diagrams.systemStatus.shared.permissions',
  'workbench.docs.diagrams.systemStatus.shared.secrets',
  'workbench.docs.diagrams.systemStatus.shared.live',
] as const;

// CJK glyphs render close to the full em box, not the ~0.55em a Latin
// glyph averages — weigh them accordingly when sizing text-driven pills.
const unitLen = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.85 : 1), 0);

/**
 * Workbench surface: the browser shows a workbench.html tab and the
 * status row lives in the workbench's bottom footer. Inside the body
 * we paint a few faded UI placeholders for context, and a real-looking
 * footer strip with the six pills as the focal point.
 */
export const SystemStatusWorkbenchSurfaceDiagram: React.FC = () => {
  const t = useT();
  const charW = 4.3;
  const PAD_X = 4;
  const DOT_R = 2;
  const DOT_GAP = 3;
  const PILL_H = 14;
  const PILL_GAP = 3;

  const ROW: { name: string; level: Level }[] = SUBSYSTEM_KEYS.map((k) => ({ name: t(k), level: 'green' }));

  // Footer strip lives at the bottom of the body area.
  const FOOTER_H = 22;
  const FOOTER_Y = 178 - FOOTER_H; // frame bottom edge - footer height
  const FOOTER_X = 8;
  const FOOTER_W = 304;

  // Long locale names can outgrow the footer — squeeze the text scale
  // (and font size with it) until the six pills fit the strip.
  const FIXED_W = PAD_X * 2 + DOT_R * 2 + DOT_GAP;
  const rawTextW = ROW.reduce((sum, p) => sum + unitLen(p.name) * charW, 0);
  const availTextW = FOOTER_W - 12 - FIXED_W * ROW.length - PILL_GAP * (ROW.length - 1);
  const k = Math.min(1, availTextW / rawTextW);
  const widthOf = (name: string) => Math.ceil(unitLen(name) * charW * k) + FIXED_W;
  const totalW = ROW.reduce((sum, p) => sum + widthOf(p.name), 0) + PILL_GAP * (ROW.length - 1);
  const pillsStartX = FOOTER_X + (FOOTER_W - totalW) / 2;
  const pillsCenterY = FOOTER_Y + FOOTER_H / 2;

  let cursor = pillsStartX;
  const pills = ROW.map((p) => {
    const w = widthOf(p.name);
    const x = cursor;
    cursor += w + PILL_GAP;
    return (
      <g key={p.name}>
        <rect
          x={x}
          y={pillsCenterY - PILL_H / 2}
          width={w}
          height={PILL_H}
          rx={7}
          fill={BG_CONTAINER}
          stroke={BORDER}
        />
        <circle cx={x + PAD_X + DOT_R} cy={pillsCenterY} r={DOT_R} fill={dotColor(p.level)} />
        <text
          x={x + PAD_X + DOT_R * 2 + DOT_GAP}
          y={pillsCenterY + 3}
          fontSize={8 * k}
          fontWeight={600}
          fill={TEXT}
        >
          {p.name}
        </text>
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.surfacesWorkbench.title')}
      </text>

      <BrowserFrame tabLabel="Open Headers" addressBar="chrome-extension://…/workbench.html">
        {/* Faded body placeholders — sidebar + content panes */}
        <rect x={16} y={72} width={56} height={86} rx={4} fill="var(--ant-color-fill-quaternary)" />
        <rect x={80} y={72} width={232} height={86} rx={4} fill="var(--ant-color-fill-quaternary)" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={22} y={82 + i * 16} width={44} height={6} rx={2} fill="var(--ant-color-fill-tertiary)" />
        ))}
        {[0, 1, 2].map((i) => (
          <rect
            key={`m-${i}`}
            x={88}
            y={82 + i * 16}
            width={216 - i * 40}
            height={6}
            rx={2}
            fill="var(--ant-color-fill-tertiary)"
          />
        ))}

        {/* Footer strip highlighted */}
        <rect
          x={FOOTER_X}
          y={FOOTER_Y}
          width={FOOTER_W}
          height={FOOTER_H}
          fill={FILL_SECONDARY}
          stroke={dotColor('green')}
          strokeWidth={1.5}
        />
        {pills}
      </BrowserFrame>

      {/* Callout */}
      <text x={160} y={204} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout')}
      </text>
    </svg>
  );
};

/**
 * Popup surface: the extension popup hangs from the toolbar icon.
 * Inside the popup, the status indicator lives in the FOOTER (not
 * the header) — rendered as a colored dot + "System status" label.
 * Matches the real UI: small `● System status 2026.7.0` strip at the
 * bottom of the popup, alongside the Debug + help icons.
 */
export const SystemStatusPopupSurfaceDiagram: React.FC = () => {
  const t = useT();
  // Popup dimensions — anchored BELOW the address bar so the
  // browser-frame separators don't draw through the popup header.
  const PU_W = 172;
  const PU_H = 110;
  const PU_X = 312 - PU_W - 4;
  const PU_Y = 76;
  const HEAD_H = 22;
  const FOOTER_H = 22;
  const BODY_Y = PU_Y + HEAD_H;
  const FOOTER_Y = PU_Y + PU_H - FOOTER_H;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.surfacesPopup.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.surfacesPopup.title')}
      </text>

      <BrowserFrame tabLabel="example.com" addressBar="https://example.com">
        {/* Page content placeholders (dimmed) */}
        <g opacity={0.4}>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={16}
              y={86 + i * 14}
              width={290 - i * 28}
              height={6}
              rx={2}
              fill="var(--ant-color-fill-tertiary)"
            />
          ))}
        </g>

        {/* Toolbar extension icon — actual Open Headers logo */}
        <OhLogo x={286} y={53} size={20} idSuffix="popup-icon" />
        <rect
          x={284}
          y={51}
          width={24}
          height={24}
          rx={5}
          fill="transparent"
          stroke={STROKE_BLUE}
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />

        {/* Popup window */}
        <rect x={PU_X} y={PU_Y} width={PU_W} height={PU_H} rx={5} fill={BG_CONTAINER} stroke={BORDER} />

        {/* Popup header (top) — OH logo + name + small chip suggesting the workspace selector */}
        <rect x={PU_X} y={PU_Y} width={PU_W} height={HEAD_H} rx={5} fill={FILL_SECONDARY} stroke={BORDER} />
        <OhLogo x={PU_X + 6} y={PU_Y + 5} size={12} idSuffix="popup-head" />
        <text x={PU_X + 22} y={PU_Y + HEAD_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
          Open Headers
        </text>
        <rect x={PU_X + PU_W - 32} y={PU_Y + 5} width={26} height={12} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
        <text x={PU_X + PU_W - 19} y={PU_Y + 14} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip')}
        </text>

        {/* Popup body — a few faded placeholder rows */}
        <g opacity={0.55}>
          {[0, 1, 2].map((i) => (
            <rect
              key={`pbr-${i}`}
              x={PU_X + 10}
              y={BODY_Y + 10 + i * 12}
              width={PU_W - 24 - i * 18}
              height={5}
              rx={2}
              fill="var(--ant-color-fill-tertiary)"
            />
          ))}
        </g>

        {/* Popup footer — the focal point, with the status pill highlighted */}
        <rect
          x={PU_X}
          y={FOOTER_Y}
          width={PU_W}
          height={FOOTER_H}
          fill={FILL_SECONDARY}
          stroke={dotColor('green')}
          strokeWidth={1.5}
        />
        {/* Help icon on the left */}
        <circle cx={PU_X + 14} cy={FOOTER_Y + FOOTER_H / 2} r={6} fill={BG_CONTAINER} stroke={BORDER} />
        <text
          x={PU_X + 14}
          y={FOOTER_Y + FOOTER_H / 2 + 3}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          fill={TEXT_DIM}
        >
          ?
        </text>
        {/* Status pill — dot + label */}
        <circle cx={PU_X + 38} cy={FOOTER_Y + FOOTER_H / 2} r={3.5} fill={SUCCESS} />
        <text x={PU_X + 46} y={FOOTER_Y + FOOTER_H / 2 + 3} fontSize={9} fontWeight={700} fill={TEXT}>
          {t('workbench.docs.diagrams.systemStatus.shared.systemStatus')}
        </text>
        {/* Right-aligned version chip */}
        <text x={PU_X + PU_W - 8} y={FOOTER_Y + FOOTER_H / 2 + 3} textAnchor="end" fontSize={8} fill={TEXT_DIM}>
          2026.7.0
        </text>
      </BrowserFrame>

      <text x={160} y={204} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.surfacesPopup.callout')}
      </text>
    </svg>
  );
};

// ─── Worst-level aggregator ───────────────────────────────────────

export const SystemStatusWorstLevelDiagram: React.FC = () => {
  const t = useT();
  // A scenario where two subsystems mis-fire — Permissions yellow,
  // Secrets red. Composite output is red.
  const ROWS: { name: string; level: Level; msg: string }[] = [
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.sync'),
      level: 'green',
      msg: t('workbench.docs.diagrams.systemStatus.worstLevel.msgConnected'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.rules'),
      level: 'green',
      msg: t('workbench.docs.diagrams.systemStatus.worstLevel.msgActive'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.requests'),
      level: 'grey',
      msg: t('workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.permissions'),
      level: 'yellow',
      msg: t('workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.secrets'),
      level: 'red',
      msg: t('workbench.docs.diagrams.systemStatus.worstLevel.msgCipher'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.live'),
      level: 'green',
      msg: t('workbench.docs.diagrams.systemStatus.worstLevel.msgFresh'),
    },
  ];

  const ID = 'sys-worst';
  const ROW_X = 16;
  const ROW_Y0 = 36;
  const ROW_H = 18;
  const ROW_GAP = 4;
  const ROW_W = 168;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.worstLevel.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.worstLevel.title')}
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.worstLevel.subtitle')}
      </text>

      {ROWS.map((row, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const fill =
          row.level === 'red'
            ? ERROR_BG
            : row.level === 'yellow'
              ? WARNING_BG
              : row.level === 'green'
                ? SUCCESS_BG
                : GREY_BG;
        const stroke = dotColor(row.level);
        return (
          <g key={row.name}>
            <rect x={ROW_X} y={y} width={ROW_W} height={ROW_H} rx={3} fill={fill} stroke={stroke} />
            <circle cx={ROW_X + 10} cy={y + ROW_H / 2} r={3.5} fill={dotColor(row.level)} />
            <text x={ROW_X + 22} y={y + ROW_H / 2 + 3} fontSize={9} fontWeight={700} fill={TEXT}>
              {row.name}
            </text>
            <text
              x={ROW_X + ROW_W - 8}
              y={y + ROW_H / 2 + 3}
              textAnchor="end"
              fontSize={8}
              fontStyle="italic"
              fill={TEXT_DIM}
            >
              {row.msg}
            </text>
          </g>
        );
      })}

      {/* Aggregation arrow */}
      <line
        x1={ROW_X + ROW_W + 4}
        y1={ROW_Y0 + (ROW_H * 6 + ROW_GAP * 5) / 2}
        x2={236}
        y2={ROW_Y0 + (ROW_H * 6 + ROW_GAP * 5) / 2}
        stroke={STROKE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={(ROW_X + ROW_W + 236) / 2}
        y={ROW_Y0 + (ROW_H * 6 + ROW_GAP * 5) / 2 - 4}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {t('workbench.docs.diagrams.systemStatus.worstLevel.maxFn')}
      </text>

      {/* Composite output */}
      <rect x={240} y={68} width={64} height={64} rx={6} fill={ERROR_BG} stroke={ERROR} />
      <circle cx={272} cy={94} r={8} fill={ERROR} />
      <text x={272} y={120} textAnchor="middle" fontSize={9} fontWeight={700} fill={ERROR}>
        {t('workbench.docs.diagrams.systemStatus.shared.red')}
      </text>
      <text x={272} y={144} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.worstLevel.composite')}
      </text>
      <text x={272} y={156} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.worstLevel.dot')}
      </text>

      <text x={160} y={186} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.worstLevel.footer')}
      </text>
    </svg>
  );
};

// ─── Sync subsystem — topology + lifecycle ────────────────────────
export const SystemStatusPopoverDiagram: React.FC = () => {
  const t = useT();
  const noEvents = t('workbench.docs.diagrams.systemStatus.shared.noEventsYet');
  const GREYS = [
    { name: t('workbench.docs.diagrams.systemStatus.shared.requests'), msg: noEvents },
    { name: t('workbench.docs.diagrams.systemStatus.shared.live'), msg: noEvents },
  ];
  const COLOREDS: { name: string; level: Exclude<Level, 'grey'>; msg: string }[] = [
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.sync'),
      level: 'green',
      msg: t('workbench.docs.diagrams.systemStatus.popover.msgConnected'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.rules'),
      level: 'green',
      msg: t('workbench.docs.diagrams.systemStatus.popover.msgActiveRules'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.permissions'),
      level: 'yellow',
      msg: t('workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.shared.secrets'),
      level: 'red',
      msg: t('workbench.docs.diagrams.systemStatus.popover.msgCipherFailed'),
    },
  ];

  const PAD_X = 14;
  const ROW_H = 16;
  const ROW_GAP = 3;
  const TAG_W = 70;
  const TAG_X = PAD_X;
  const FRAME_X = 30;
  const FRAME_W = 260;

  let y = 50;

  const renderRow = (
    name: string,
    msg: string,
    level: Level,
    options: { isGrey?: boolean } = {},
  ): React.ReactElement => {
    const localY = y;
    y += ROW_H + ROW_GAP;
    const fillTag = options.isGrey
      ? GREY_BG
      : level === 'red'
        ? ERROR_BG
        : level === 'yellow'
          ? WARNING_BG
          : SUCCESS_BG;
    const strokeTag = dotColor(level);
    return (
      <g key={`${name}-${localY}`}>
        <rect x={FRAME_X + TAG_X} y={localY} width={TAG_W} height={ROW_H} rx={3} fill={fillTag} stroke={strokeTag} />
        <text
          x={FRAME_X + TAG_X + TAG_W / 2}
          y={localY + ROW_H / 2 + 3}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          fill={TEXT}
        >
          {name}
        </text>
        <text x={FRAME_X + TAG_X + TAG_W + 10} y={localY + ROW_H / 2 + 3} fontSize={9} fill={TEXT}>
          {msg}
        </text>
      </g>
    );
  };

  // We need to render greys first, then divider, then coloreds. Using
  // a closure over `y` because the rows wrap with their own local y.
  const greyRows = GREYS.map((r) => renderRow(r.name, r.msg, 'grey', { isGrey: true }));
  const dividerY = y + 2;
  y += 10;
  const coloredRows = COLOREDS.map((r) => renderRow(r.name, r.msg, r.level));
  const frameH = y + 6 - 36;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.popover.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.popover.title')}
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.popover.subtitle')}
      </text>

      {/* Popover frame */}
      <rect x={FRAME_X} y={36} width={FRAME_W} height={frameH} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      {/* Header inside the popover */}
      <text x={FRAME_X + 14} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.popover.header')}
      </text>
      <circle cx={FRAME_X + 14 - 7} cy={45} r={3.5} fill={ERROR} />

      {greyRows}

      {/* Divider between tiers */}
      <line
        x1={FRAME_X + 14}
        y1={dividerY}
        x2={FRAME_X + FRAME_W - 14}
        y2={dividerY}
        stroke={BORDER}
        strokeDasharray="2 2"
      />
      <text
        x={FRAME_X + FRAME_W - 14}
        y={dividerY - 2}
        textAnchor="end"
        fontSize={7}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {t('workbench.docs.diagrams.systemStatus.popover.dividerNote')}
      </text>

      {coloredRows}

      <text x={160} y={210} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.popover.footer')}
      </text>
    </svg>
  );
};

