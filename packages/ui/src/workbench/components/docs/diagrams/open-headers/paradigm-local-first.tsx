import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Local-first diagram — four hosting choices laid out as a vertical
 * stack with PROGRESSIVE DISCLOSURE. Each card has a fixed-width
 * header column on the left (icon + title + sub + tier badge); the
 * right column shows two zones — the bullets it INHERITS from the
 * previous tier (muted grey) and the bullets it ADDS in this tier
 * (highlighted inside a green dotted rectangle captioned "+ new in
 * this tier"). The first card has no inheritance so it renders its
 * bullets in the normal style without the dotted box.
 *
 * Visual story: capability grows additively as you move through the
 * tiers. The user sees what they keep AND what they gain at each step.
 *
 * Third column on the right of each card lists the platforms each
 * hosting tier supports (browsers / OSes / clouds), grouped where it
 * helps. This fills the right side of the card and answers "but where
 * can I actually run it?" without leaving the diagram.
 */
export const ParadigmLocalFirstDiagram: React.FC = () => {
  const t = useT();
  type Icon = 'browser' | 'desktop' | 'daemon' | 'vm';
  type Bullet = { text: string; status: 'carried' | 'new' };
  type PlatformItem = { label: string; note?: string };
  type PlatformGroup = { label?: string; items: PlatformItem[] };
  type Choice = {
    title: string;
    sub: string;
    badge: string;
    today?: boolean;
    icon: Icon;
    bullets: Bullet[];
    inheritsFrom?: string;
    platforms: PlatformGroup[];
  };

  const badgeToday = t('workbench.docs.diagrams.openHeaders.shared.badgeToday');
  const inBrowser = t('workbench.docs.diagrams.openHeaders.shared.inBrowser');
  const desktopApp = t('workbench.docs.diagrams.openHeaders.shared.desktopApp');
  const localDaemon = t('workbench.docs.diagrams.openHeaders.shared.localDaemon');
  const yourVm = t('workbench.docs.diagrams.openHeaders.shared.yourVm');
  const soon = t('workbench.docs.diagrams.openHeaders.shared.soon');

  const bZeroSetup = t('workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup');
  const bSingleDevice = t('workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice');
  const bPerBrowser = t('workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser');
  const bMultiSurface = t('workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface');
  const bMultiWindow = t('workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow');
  const bLocalhostOnly = t('workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly');
  const bMultiBrowser = t('workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser');
  const bPerApp = t('workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp');
  const bFilesystem = t('workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem');
  const bYaml = t('workbench.docs.diagrams.openHeaders.localFirst.bulletYaml');
  const bGit = t('workbench.docs.diagrams.openHeaders.localFirst.bulletGit');
  const bMinimalSetup = t('workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup');
  const bLan = t('workbench.docs.diagrams.openHeaders.localFirst.bulletLan');
  const bMultiApp = t('workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp');
  const bMultiDevice = t('workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice');
  const bFrontEnds = t('workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds');

  const CHOICES: Choice[] = [
    {
      title: inBrowser,
      sub: t('workbench.docs.diagrams.openHeaders.localFirst.subBrowser'),
      badge: badgeToday,
      today: true,
      icon: 'browser',
      bullets: [
        { text: bZeroSetup, status: 'new' },
        { text: bSingleDevice, status: 'new' },
        { text: bPerBrowser, status: 'new' },
        { text: bMultiSurface, status: 'new' },
        { text: bMultiWindow, status: 'new' },
        { text: bLocalhostOnly, status: 'new' },
        { text: 'browser.storage.local', status: 'new' },
      ],
      platforms: [
        {
          items: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari', note: soon }],
        },
      ],
    },
    {
      title: desktopApp,
      sub: t('workbench.docs.diagrams.openHeaders.localFirst.subDesktop'),
      badge: badgeToday,
      today: true,
      icon: 'desktop',
      inheritsFrom: inBrowser,
      bullets: [
        { text: bZeroSetup, status: 'carried' },
        { text: bSingleDevice, status: 'carried' },
        { text: bMultiSurface, status: 'carried' },
        { text: bMultiWindow, status: 'carried' },
        { text: bLocalhostOnly, status: 'carried' },
        { text: bMultiBrowser, status: 'new' },
        { text: bPerApp, status: 'new' },
        { text: bFilesystem, status: 'new' },
        { text: bYaml, status: 'new' },
        { text: bGit, status: 'new' },
      ],
      platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    },
    {
      title: localDaemon,
      sub: t('workbench.docs.diagrams.openHeaders.localFirst.subDaemon'),
      badge: badgeToday,
      today: true,
      icon: 'daemon',
      inheritsFrom: desktopApp,
      bullets: [
        { text: bMinimalSetup, status: 'new' },
        { text: bLan, status: 'new' },
        { text: bMultiBrowser, status: 'carried' },
        { text: bMultiApp, status: 'new' },
        { text: bMultiSurface, status: 'carried' },
        { text: bMultiWindow, status: 'carried' },
        { text: bFilesystem, status: 'carried' },
        { text: bYaml, status: 'carried' },
        { text: bGit, status: 'carried' },
        { text: bMultiDevice, status: 'new' },
        { text: bFrontEnds, status: 'new' },
      ],
      platforms: [
        {
          label: t('workbench.docs.diagrams.openHeaders.localFirst.platAllOs'),
          items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }],
        },
        {
          label: t('workbench.docs.diagrams.openHeaders.localFirst.platEmbedded'),
          items: [
            { label: 'Raspberry Pi' },
            { label: 'NAS' },
            { label: t('workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc') },
            { label: t('workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer') },
            { label: t('workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop') },
          ],
        },
      ],
    },
    {
      title: yourVm,
      sub: t('workbench.docs.diagrams.openHeaders.localFirst.subVm'),
      badge: badgeToday,
      today: true,
      icon: 'vm',
      inheritsFrom: localDaemon,
      bullets: [
        { text: bMultiDevice, status: 'carried' },
        { text: bMultiBrowser, status: 'carried' },
        { text: bMultiApp, status: 'carried' },
        { text: bMultiSurface, status: 'carried' },
        { text: bMultiWindow, status: 'carried' },
        { text: bFilesystem, status: 'carried' },
        { text: bYaml, status: 'carried' },
        { text: bGit, status: 'carried' },
        { text: bFrontEnds, status: 'carried' },
        { text: t('workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup'), status: 'new' },
        { text: t('workbench.docs.diagrams.openHeaders.localFirst.bulletWan'), status: 'new' },
        { text: t('workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady'), status: 'new' },
        { text: t('workbench.docs.diagrams.openHeaders.localFirst.bulletSso'), status: 'new' },
        { text: t('workbench.docs.diagrams.openHeaders.localFirst.bulletRbac'), status: 'new' },
        { text: t('workbench.docs.diagrams.openHeaders.localFirst.bulletAudit'), status: 'new' },
      ],
      platforms: [
        {
          label: t('workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers'),
          items: [{ label: 'AWS' }, { label: 'Azure' }, { label: 'Google Cloud' }],
        },
        {
          label: t('workbench.docs.diagrams.openHeaders.localFirst.platEuNative'),
          items: [{ label: 'Scaleway' }, { label: 'OVHcloud' }, { label: 'Hetzner' }, { label: 'IONOS' }],
        },
        {
          label: t('workbench.docs.diagrams.openHeaders.localFirst.platOther'),
          items: [{ label: 'DigitalOcean' }, { label: 'Heroku' }],
        },
        {
          label: t('workbench.docs.diagrams.openHeaders.localFirst.platEnterprise'),
          items: [
            { label: t('workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud') },
            { label: t('workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem') },
          ],
        },
      ],
    },
  ];

  // Canvas geometry — wider viewBox to fit the third column.
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
  const BULLET_H = 14;
  const HEADER_MIN_H = 116;

  const PLATFORM_CHIP_H = 14;
  const PLATFORM_CHIP_GAP = 3;
  const PLATFORM_GROUP_LABEL_H = 14;
  const PLATFORM_GROUP_GAP = 6;
  const PLATFORM_SECTION_LABEL_H = 14;

  /** Compute card body height — accounts for the inherits caption,
   *  carried-bullets block, dotted-rectangle wrapping the new bullets,
   *  and the platform list height (we take the tallest of the three
   *  columns as the body height floor). */
  const cardBodyHeight = (c: Choice) => {
    const carried = c.bullets.filter((b) => b.status === 'carried');
    const newOnes = c.bullets.filter((b) => b.status === 'new');
    const bulletsCol = !c.inheritsFrom
      ? c.bullets.length * BULLET_H + 8
      : 14 + carried.length * BULLET_H + 10 + 18 + newOnes.length * BULLET_H + 12;

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
  const cardTotalHeight = (c: Choice) => 14 + cardBodyHeight(c) + 14;

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

  const GOLD = 'rgba(212, 145, 0, 1)';
  const GOLD_BG = 'rgba(250, 173, 20, 0.18)';
  const MUTED = 'var(--ant-color-text-tertiary)';
  const MUTED_DOT = 'var(--ant-color-text-quaternary)';

  const renderIcon = (icon: Icon, cx: number, cy: number) => {
    const stroke = STROKE_BLUE;
    const fill = FILL_BLUE;
    switch (icon) {
      case 'browser':
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
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={cx - 18}
                y={cy - 4 + i * 5}
                width={36 - i * 8}
                height={2}
                rx={1}
                fill="var(--ant-color-fill-tertiary)"
              />
            ))}
          </g>
        );
      case 'desktop':
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
      case 'daemon':
        return (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect
                  x={cx - 22}
                  y={cy - 16 + i * 11}
                  width={44}
                  height={9}
                  rx={2}
                  fill={FILL_PURPLE}
                  stroke={STROKE_PURPLE}
                />
                <circle cx={cx - 17} cy={cy - 11.5 + i * 11} r={1.8} fill={OH_GREEN} />
                <rect
                  x={cx - 12}
                  y={cy - 13 + i * 11}
                  width={28}
                  height={2}
                  rx={1}
                  fill="var(--ant-color-fill-tertiary)"
                />
              </g>
            ))}
          </g>
        );
      case 'vm':
        return (
          <g>
            <path
              d={`M ${cx - 18} ${cy + 6}
                  c -8 0 -8 -10 0 -10
                  c 0 -8 12 -8 14 -2
                  c 2 -6 14 -4 14 4
                  c 6 0 6 8 0 8 Z`}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
              strokeWidth={1.5}
            />
            <rect x={cx - 4} y={cy - 2} width={8} height={6} rx={1} fill={fill} stroke={stroke} />
            <path d={`M ${cx - 3} ${cy - 2} v -2 a 3 3 0 0 1 6 0 v 2`} fill="none" stroke={stroke} strokeWidth={1.2} />
          </g>
        );
    }
  };

  /** Render the platforms column for a card, top-anchored at startY. */
  const renderPlatforms = (groups: PlatformGroup[], startY: number) => {
    const els: React.ReactNode[] = [];
    els.push(
      <text key="hdr" x={PLATFORM_X} y={startY} fontSize={9} fontWeight={800} fill={MUTED} letterSpacing={0.6}>
        {t('workbench.docs.diagrams.openHeaders.shared.supports')}
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
      aria-label={t('workbench.docs.diagrams.openHeaders.localFirst.aria')}
    >
      <text x={W / 2} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.localFirst.title')}
      </text>
      <text x={W / 2} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.localFirst.subtitle')}
      </text>

      {CHOICES.map((c, i) => {
        const { y, h } = cardLayout[i];
        const isToday = !!c.today;
        const accent = isToday ? STROKE_BLUE : 'var(--ant-color-border)';
        const badgeStroke = isToday ? OH_GREEN : GOLD;
        const badgeBg = isToday ? OH_GREEN_TINT : GOLD_BG;

        const headerCX = HEADER_X + HEADER_COL_W / 2;
        const iconCY = y + 34;
        const titleY = y + 68;
        const subY = y + 80;
        const badgeY = y + 92;

        const carried = c.bullets.filter((b) => b.status === 'carried');
        const newOnes = c.bullets.filter((b) => b.status === 'new');

        return (
          <g key={c.title}>
            {/* Card frame */}
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

            {/* Header / bullets separator */}
            <line
              x1={SEPARATOR_1_X}
              y1={y + 10}
              x2={SEPARATOR_1_X}
              y2={y + h - 10}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />
            {/* Bullets / platforms separator */}
            <line
              x1={SEPARATOR_2_X}
              y1={y + 10}
              x2={SEPARATOR_2_X}
              y2={y + h - 10}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />

            {/* Header column */}
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

            {/* Bullets column */}
            {!c.inheritsFrom ? (
              <g>
                {c.bullets.map((b, j) => (
                  <g key={`b-${j}`}>
                    <circle cx={BULLET_X} cy={y + 22 + j * BULLET_H} r={2} fill={STROKE_BLUE} />
                    <text x={BULLET_X + 8} y={y + 25 + j * BULLET_H} fontSize={10} fill={TEXT}>
                      {b.text}
                    </text>
                  </g>
                ))}
              </g>
            ) : (
              (() => {
                const captionY = y + 18;
                const carriedStartY = captionY + 14;
                const carriedEndY = carriedStartY + carried.length * BULLET_H;
                const dottedY = carriedEndY + 8;
                const dottedCaptionH = 18;
                const dottedPadding = 12;
                const dottedH = dottedCaptionH + newOnes.length * BULLET_H + dottedPadding;
                // Dotted box constrained to the bullets column only.
                const dottedX = BULLET_X - 6;
                const dottedW = BULLETS_COL_W - 10;

                return (
                  <g>
                    <text x={BULLET_X - 4} y={captionY} fontSize={9} fontWeight={700} fill={MUTED} letterSpacing={0.5}>
                      {t('workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom', {
                        tier: c.inheritsFrom.toUpperCase(),
                      })}
                    </text>
                    {carried.map((b, j) => (
                      <g key={`c-${j}`}>
                        <circle cx={BULLET_X} cy={carriedStartY + 4 + j * BULLET_H} r={1.6} fill={MUTED_DOT} />
                        <text x={BULLET_X + 8} y={carriedStartY + 7 + j * BULLET_H} fontSize={9} fill={MUTED}>
                          {b.text}
                        </text>
                      </g>
                    ))}

                    <rect
                      x={dottedX}
                      y={dottedY}
                      width={dottedW}
                      height={dottedH}
                      rx={6}
                      fill={OH_GREEN_TINT}
                      stroke={OH_GREEN}
                      strokeWidth={1.3}
                      strokeDasharray="4 3"
                    />
                    <text
                      x={BULLET_X - 2}
                      y={dottedY + 12}
                      fontSize={9}
                      fontWeight={800}
                      fill={OH_GREEN}
                      letterSpacing={0.6}
                    >
                      {t('workbench.docs.diagrams.openHeaders.localFirst.newInTier')}
                    </text>
                    {newOnes.map((b, j) => (
                      <g key={`n-${j}`}>
                        <circle
                          cx={BULLET_X}
                          cy={dottedY + dottedCaptionH + 4 + j * BULLET_H}
                          r={2}
                          fill={STROKE_BLUE}
                        />
                        <text
                          x={BULLET_X + 8}
                          y={dottedY + dottedCaptionH + 7 + j * BULLET_H}
                          fontSize={10}
                          fontWeight={600}
                          fill={TEXT}
                        >
                          {b.text}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()
            )}

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
        {t('workbench.docs.diagrams.openHeaders.localFirst.strip1')}
      </text>
      <text x={W / 2} y={STRIP_Y + 36} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.localFirst.strip2')}
      </text>

      <text x={W / 2} y={FOOTER_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.openHeaders.localFirst.footer')}
      </text>
    </svg>
  );
};
