import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Front-end chooser — mirrors the back-end chooser one tier down.
 * Each card is a front-end form factor (Browser Extension, Desktop app,
 * CLI, Web App), lists the surfaces it exposes, the back-ends it can
 * connect to (the first chip is the default), and the platforms it
 * runs on. The point: every front-end talks to the same canonical data
 * via a back-end of your choice — pick any, use all, stay in sync.
 */
export const ParadigmFrontEndsDiagram: React.FC = () => {
  type FrontIcon = 'browser-ext' | 'desktop-app' | 'cli' | 'web';
  type Surface = { label: string; note?: string };
  type BackEndChip = { label: string; note?: string; isDefault?: boolean };
  type PlatformItem = { label: string; note?: string };
  type PlatformGroup = { label?: string; items: PlatformItem[] };
  type FrontEnd = {
    title: string;
    sub: string;
    badge: 'TODAY' | 'ROADMAP';
    icon: FrontIcon;
    surfaces: Surface[];
    backEnds: BackEndChip[];
    platforms: PlatformGroup[];
  };

  const CHOICES: FrontEnd[] = [
    {
      title: 'Browser Extension',
      sub: 'inside a browser',
      badge: 'TODAY',
      icon: 'browser-ext',
      surfaces: [{ label: 'Workbench' }, { label: 'Popup' }, { label: 'Side-panel' }, { label: 'DevTools' }],
      backEnds: [
        { label: 'In-browser', isDefault: true },
        { label: 'Desktop app' },
        { label: 'Local daemon' },
        { label: 'Your VM' },
      ],
      platforms: [
        {
          items: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari', note: 'soon' }],
        },
      ],
    },
    {
      title: 'Desktop app',
      sub: 'native window',
      badge: 'ROADMAP',
      icon: 'desktop-app',
      surfaces: [{ label: 'Workbench' }],
      backEnds: [{ label: 'Embedded', isDefault: true }, { label: 'Local daemon' }, { label: 'Your VM' }],
      platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    },
    {
      title: 'CLI',
      sub: 'command-line',
      badge: 'ROADMAP',
      icon: 'cli',
      surfaces: [{ label: 'Command-line' }],
      backEnds: [{ label: 'Desktop app' }, { label: 'Local daemon' }, { label: 'Your VM' }],
      platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    },
    {
      title: 'Web App',
      sub: 'browser tab',
      badge: 'ROADMAP',
      icon: 'web',
      surfaces: [{ label: 'Workbench' }],
      backEnds: [
        { label: 'Desktop app', note: 'localhost:8137' },
        { label: 'Local daemon', note: 'LAN' },
        { label: 'Your VM', note: 'WAN', isDefault: true },
      ],
      platforms: [{ items: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari' }] }],
    },
  ];

  const W = 540;
  const PAD = 12;
  const CARD_X = PAD;
  const CARD_W = W - PAD * 2;
  const CARD_GAP = 12;

  const INNER_PAD = 4;
  const HEADER_COL_W = 130;
  const BULLETS_COL_W = 240;
  const PLATFORM_COL_W = 110;
  const COL_GAP = 14;

  const HEADER_X = CARD_X + INNER_PAD;
  const SEPARATOR_1_X = HEADER_X + HEADER_COL_W;
  const BULLETS_X = SEPARATOR_1_X + COL_GAP;
  const SEPARATOR_2_X = BULLETS_X + BULLETS_COL_W;
  const PLATFORM_X = SEPARATOR_2_X + COL_GAP;

  const BULLET_X = BULLETS_X + 6;
  const BULLET_H = 16;
  const SECTION_LABEL_H = 14;
  const SECTION_GAP = 8;
  const CHIP_H = 16;
  const CHIP_GAP = 4;
  const CHIP_ROW_GAP = 4;
  const HEADER_MIN_H = 120;

  const PLATFORM_CHIP_H = 14;
  const PLATFORM_CHIP_GAP = 3;
  const PLATFORM_GROUP_LABEL_H = 14;
  const PLATFORM_GROUP_GAP = 6;
  const PLATFORM_SECTION_LABEL_H = 14;

  const GOLD = 'rgba(212, 145, 0, 1)';
  const GOLD_BG = 'rgba(250, 173, 20, 0.18)';
  const MUTED = 'var(--ant-color-text-tertiary)';

  const chipWidth = (c: BackEndChip) => {
    const charW = 6.5;
    const padX = 10;
    const labelLen = c.label.length + (c.note ? c.note.length + 3 : 0);
    return Math.round(labelLen * charW + padX * 2 + (c.isDefault ? 12 : 0));
  };

  /** Pack back-end chips into rows that fit BULLETS_COL_W. */
  const packChipsIntoRows = (chips: BackEndChip[]): BackEndChip[][] => {
    const maxW = BULLETS_COL_W - 8;
    const rows: BackEndChip[][] = [[]];
    let rowW = 0;
    for (const c of chips) {
      const w = chipWidth(c);
      const lastRow = rows[rows.length - 1];
      const sep = lastRow.length ? CHIP_GAP : 0;
      if (rowW + sep + w > maxW) {
        rows.push([c]);
        rowW = w;
      } else {
        lastRow.push(c);
        rowW += sep + w;
      }
    }
    return rows;
  };

  const cardBodyHeight = (c: FrontEnd) => {
    const chipRows = packChipsIntoRows(c.backEnds);
    const bulletsCol =
      SECTION_LABEL_H +
      c.surfaces.length * BULLET_H +
      SECTION_GAP +
      SECTION_LABEL_H +
      chipRows.length * (CHIP_H + CHIP_ROW_GAP) +
      8;

    const platformsCol = (() => {
      let h = PLATFORM_SECTION_LABEL_H;
      c.platforms.forEach((g) => {
        if (g.label) h += PLATFORM_GROUP_LABEL_H;
        h += g.items.length * (PLATFORM_CHIP_H + PLATFORM_CHIP_GAP);
        h += PLATFORM_GROUP_GAP;
      });
      return h;
    })();

    return Math.max(bulletsCol, platformsCol, HEADER_MIN_H);
  };
  const cardTotalHeight = (c: FrontEnd) => 14 + cardBodyHeight(c) + 14;

  const TITLE_Y = 24;
  const SUBTITLE_Y = 44;
  const CARDS_Y0 = SUBTITLE_Y + 26;

  let cursor = CARDS_Y0;
  const cardLayout = CHOICES.map((c) => {
    const h = cardTotalHeight(c);
    const y = cursor;
    cursor += h + CARD_GAP;
    return { y, h };
  });

  const STRIP_Y = cursor + 4;
  const STRIP_H = 50;
  const FOOTER_Y = STRIP_Y + STRIP_H + 22;
  const H = FOOTER_Y + 14;

  const renderIcon = (icon: FrontIcon, cx: number, cy: number) => {
    const stroke = STROKE_BLUE;
    const fill = FILL_BLUE;
    switch (icon) {
      case 'browser-ext':
        return (
          <g>
            {/* Browser window */}
            <rect
              x={cx - 22}
              y={cy - 14}
              width={44}
              height={28}
              rx={3}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
            />
            <rect x={cx - 22} y={cy - 14} width={44} height={7} rx={3} fill={fill} stroke={stroke} />
            <circle cx={cx - 18} cy={cy - 10.5} r={1.2} fill={stroke} />
            <circle cx={cx - 14} cy={cy - 10.5} r={1.2} fill={stroke} />
            <circle cx={cx - 10} cy={cy - 10.5} r={1.2} fill={stroke} />
            {/* Puzzle-piece extension overlay */}
            <rect
              x={cx + 4}
              y={cy - 3}
              width={14}
              height={14}
              rx={2}
              fill={OH_GREEN_TINT}
              stroke={OH_GREEN}
              strokeWidth={1.2}
            />
            <circle cx={cx + 11} cy={cy - 3} r={2} fill={OH_GREEN_TINT} stroke={OH_GREEN} strokeWidth={1.2} />
          </g>
        );
      case 'desktop-app':
        return (
          <g>
            <rect
              x={cx - 22}
              y={cy - 16}
              width={44}
              height={26}
              rx={2}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
            />
            <rect x={cx - 19} y={cy - 13} width={38} height={20} fill={fill} stroke={stroke} />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={cx - 16}
                y={cy - 10 + i * 4}
                width={32 - i * 6}
                height={1.8}
                rx={0.8}
                fill="var(--ant-color-bg-container)"
                opacity={0.7}
              />
            ))}
            <rect x={cx - 4} y={cy + 10} width={8} height={4} fill={stroke} />
            <rect x={cx - 10} y={cy + 14} width={20} height={2} rx={1} fill={stroke} />
          </g>
        );
      case 'cli':
        return (
          <g>
            <rect x={cx - 22} y={cy - 14} width={44} height={28} rx={3} fill="var(--ant-color-text)" stroke={stroke} />
            <rect x={cx - 22} y={cy - 14} width={44} height={6} rx={3} fill={fill} stroke={stroke} />
            <circle cx={cx - 18} cy={cy - 11} r={1} fill="#ff5f57" />
            <circle cx={cx - 14} cy={cy - 11} r={1} fill="#febc2e" />
            <circle cx={cx - 10} cy={cy - 11} r={1} fill="#28c840" />
            <text x={cx - 18} y={cy + 4} fontFamily="monospace" fontSize={10} fontWeight={800} fill={OH_GREEN}>
              $ _
            </text>
            <rect x={cx - 2} y={cy + 7} width={6} height={2} fill={OH_GREEN}>
              <animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="indefinite" />
            </rect>
          </g>
        );
      case 'web':
        return (
          <g>
            <rect
              x={cx - 22}
              y={cy - 14}
              width={44}
              height={28}
              rx={3}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
            />
            <rect x={cx - 22} y={cy - 14} width={44} height={7} rx={3} fill={fill} stroke={stroke} />
            <circle cx={cx - 18} cy={cy - 10.5} r={1.2} fill={stroke} />
            <circle cx={cx - 14} cy={cy - 10.5} r={1.2} fill={stroke} />
            <circle cx={cx - 10} cy={cy - 10.5} r={1.2} fill={stroke} />
            {/* Globe — meridians/parallels on the body */}
            <circle
              cx={cx}
              cy={cy + 3}
              r={7}
              fill="var(--ant-color-bg-container)"
              stroke={STROKE_BLUE}
              strokeWidth={1.2}
            />
            <ellipse cx={cx} cy={cy + 3} rx={3} ry={7} fill="none" stroke={STROKE_BLUE} strokeWidth={1} />
            <line x1={cx - 7} y1={cy + 3} x2={cx + 7} y2={cy + 3} stroke={STROKE_BLUE} strokeWidth={1} />
          </g>
        );
    }
  };

  const renderPlatforms = (groups: PlatformGroup[], startY: number) => {
    const els: React.ReactNode[] = [];
    els.push(
      <text key="hdr" x={PLATFORM_X} y={startY} fontSize={9} fontWeight={800} fill={MUTED} letterSpacing={0.6}>
        SUPPORTS
      </text>,
    );
    let cursorY = startY + PLATFORM_SECTION_LABEL_H;
    groups.forEach((g, gi) => {
      if (g.label) {
        els.push(
          <text
            key={`gl-${gi}`}
            x={PLATFORM_X}
            y={cursorY + 9}
            fontSize={8}
            fontWeight={700}
            fill={MUTED}
            letterSpacing={0.4}
          >
            {g.label.toUpperCase()}
          </text>,
        );
        cursorY += PLATFORM_GROUP_LABEL_H;
      }
      g.items.forEach((p, pi) => {
        const chipY = cursorY;
        els.push(
          <g key={`p-${gi}-${pi}`}>
            <rect
              x={PLATFORM_X}
              y={chipY}
              width={PLATFORM_COL_W}
              height={PLATFORM_CHIP_H}
              rx={3}
              fill={FILL_BLUE}
              stroke={STROKE_BLUE}
              strokeWidth={0.8}
            />
            <text x={PLATFORM_X + 6} y={chipY + 10} fontSize={8.5} fontWeight={700} fill={TEXT}>
              {p.label}
            </text>
            {p.note && (
              <text
                x={PLATFORM_X + PLATFORM_COL_W - 6}
                y={chipY + 10}
                textAnchor="end"
                fontSize={7}
                fontStyle="italic"
                fill={MUTED}
              >
                {p.note}
              </text>
            )}
          </g>,
        );
        cursorY += PLATFORM_CHIP_H + PLATFORM_CHIP_GAP;
      });
      cursorY += PLATFORM_GROUP_GAP;
    });
    return els;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 600 }}
      role="img"
      aria-label="Choose your front-end — how you access and manage your data. Four front-end form factors stacked vertically: browser extension, desktop app, CLI app, and web app. Each card lists the surfaces it exposes, the back-ends it can connect to (first chip is the default), and the platforms it runs on."
    >
      <text x={W / 2} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Choose your front-end — how you access &amp; manage your data
      </text>
      <text x={W / 2} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Same data, any front-end — pick one, use all, every surface stays in sync.
      </text>

      {CHOICES.map((c, i) => {
        const { y, h } = cardLayout[i];
        const isToday = c.badge === 'TODAY';
        const accent = isToday ? STROKE_BLUE : 'var(--ant-color-border)';
        const badgeStroke = isToday ? OH_GREEN : GOLD;
        const badgeBg = isToday ? OH_GREEN_TINT : GOLD_BG;

        const headerCX = HEADER_X + HEADER_COL_W / 2;
        const iconCY = y + 34;
        const titleY = y + 68;
        const subY = y + 80;
        const badgeY = y + 92;

        const chipRows = packChipsIntoRows(c.backEnds);

        // Bullets column: SURFACES section + BACK-ENDS section
        const surfacesLabelY = y + 18;
        const surfacesStartY = surfacesLabelY + SECTION_LABEL_H;
        const backEndsLabelY = surfacesStartY + c.surfaces.length * BULLET_H + SECTION_GAP;
        const backEndsStartY = backEndsLabelY + SECTION_LABEL_H;

        return (
          <g key={c.title}>
            <rect
              x={CARD_X}
              y={y}
              width={CARD_W}
              height={h}
              rx={8}
              fill="var(--ant-color-bg-container)"
              stroke={accent}
              strokeWidth={isToday ? 2 : 1.2}
            />

            <line
              x1={SEPARATOR_1_X}
              y1={y + 10}
              x2={SEPARATOR_1_X}
              y2={y + h - 10}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />
            <line
              x1={SEPARATOR_2_X}
              y1={y + 10}
              x2={SEPARATOR_2_X}
              y2={y + h - 10}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />

            {/* Header */}
            {renderIcon(c.icon, headerCX, iconCY)}
            <text x={headerCX} y={titleY} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
              {c.title}
            </text>
            <text x={headerCX} y={subY} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
              {c.sub}
            </text>
            <rect
              x={headerCX - 36}
              y={badgeY}
              width={72}
              height={18}
              rx={9}
              fill={badgeBg}
              stroke={badgeStroke}
              strokeWidth={1.2}
            />
            <text
              x={headerCX}
              y={badgeY + 12}
              textAnchor="middle"
              fontSize={9}
              fontWeight={800}
              fill={badgeStroke}
              letterSpacing={1}
            >
              {c.badge}
            </text>

            {/* Bullets column: SURFACES */}
            <text
              x={BULLET_X - 4}
              y={surfacesLabelY + 10}
              fontSize={9}
              fontWeight={800}
              fill={MUTED}
              letterSpacing={0.6}
            >
              SURFACES
            </text>
            {c.surfaces.map((s, j) => (
              <g key={`s-${j}`}>
                <circle cx={BULLET_X} cy={surfacesStartY + 6 + j * BULLET_H} r={2} fill={STROKE_BLUE} />
                <text x={BULLET_X + 8} y={surfacesStartY + 9 + j * BULLET_H} fontSize={10} fontWeight={600} fill={TEXT}>
                  {s.label}
                </text>
                {s.note && (
                  <text
                    x={BULLETS_X + BULLETS_COL_W - 10}
                    y={surfacesStartY + 9 + j * BULLET_H}
                    textAnchor="end"
                    fontSize={8.5}
                    fontStyle="italic"
                    fill={TEXT_DIM}
                  >
                    {s.note}
                  </text>
                )}
              </g>
            ))}

            {/* Bullets column: CONNECTS TO BACK-END */}
            <text
              x={BULLET_X - 4}
              y={backEndsLabelY + 10}
              fontSize={9}
              fontWeight={800}
              fill={MUTED}
              letterSpacing={0.6}
            >
              CONNECTS TO BACK-END
            </text>
            {chipRows.map((row, rIdx) => {
              let cx = BULLETS_X + 4;
              const ry = backEndsStartY + rIdx * (CHIP_H + CHIP_ROW_GAP);
              return (
                <g key={`r-${rIdx}`}>
                  {row.map((chip, cIdx) => {
                    const w = chipWidth(chip);
                    const x = cx;
                    cx += w + CHIP_GAP;
                    const chipFill = chip.isDefault ? OH_GREEN_TINT : FILL_BLUE;
                    const chipStroke = chip.isDefault ? OH_GREEN : STROKE_BLUE;
                    return (
                      <g key={`c-${rIdx}-${cIdx}`}>
                        <rect
                          x={x}
                          y={ry}
                          width={w}
                          height={CHIP_H}
                          rx={CHIP_H / 2}
                          fill={chipFill}
                          stroke={chipStroke}
                          strokeWidth={1}
                        />
                        {chip.isDefault && (
                          <text x={x + 8} y={ry + 11} fontSize={9} fontWeight={900} fill={OH_GREEN}>
                            ★
                          </text>
                        )}
                        <text x={x + (chip.isDefault ? 18 : 10)} y={ry + 11} fontSize={9} fontWeight={700} fill={TEXT}>
                          {chip.label}
                          {chip.note && (
                            <tspan fontWeight={500} fontStyle="italic" fill={TEXT_DIM}>
                              {' · '}
                              {chip.note}
                            </tspan>
                          )}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Platforms column */}
            {renderPlatforms(c.platforms, y + 18)}
          </g>
        );
      })}

      {/* Bottom posture strip */}
      <rect
        x={PAD}
        y={STRIP_Y}
        width={W - PAD * 2}
        height={STRIP_H}
        rx={8}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeWidth={1.5}
      />
      <text
        x={W / 2}
        y={STRIP_Y + 18}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={OH_GREEN}
        letterSpacing={0.5}
      >
        PICK A FRONT-END, OR PICK THEM ALL — IT'S THE SAME DATA
      </text>
      <text x={W / 2} y={STRIP_Y + 36} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        ✓ extension · ✓ desktop · ✓ CLI · ✓ web — all reading the same canonical entities
      </text>

      <text x={W / 2} y={FOOTER_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={STROKE_BLUE}>
        Same data, any way you reach it — every surface stays in sync.
      </text>
    </svg>
  );
};
