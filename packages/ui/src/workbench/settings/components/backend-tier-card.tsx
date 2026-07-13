import { Tooltip } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  FILL_BLUE,
  FILL_GREEN,
  STROKE_BLUE,
  STROKE_GREEN,
  TEXT,
  TEXT_DIM,
} from '../../components/docs/diagrams/_shared';
import { OH_GREEN, OH_GREEN_TINT } from '../../components/docs/diagrams/open-headers/_shared';
import type { BackendMode } from '../schema/backend';
import { resolveLabel } from '../localize';
import { TIERS } from './backend-tier-data';
import { CloudGlyph, FooterDetails, IconArt } from './backend-tier-glyphs';

interface Props {
  mode: BackendMode;
}

const VB_W = 600;
// Shared card geometry across all tiers — constant height keeps the
// left column from jumping when the user previews different modes.
const VB_H_TALL = 370;
const RECT_X = 30;
const RECT_Y = 18;
const RECT_W = 540;
const RECT_H_TALL = 280;

const HEADER_COL_W = 140;
const PLATFORM_COL_W = 95;
const COL_GAP = 8;

const HEADER_X = RECT_X + 10;
const SEPARATOR_1_X = HEADER_X + HEADER_COL_W;
const BULLETS_X = SEPARATOR_1_X + COL_GAP;
const PLATFORM_X = RECT_X + RECT_W - PLATFORM_COL_W - 10;
const SEPARATOR_2_X = PLATFORM_X - COL_GAP;

const BULLET_X = BULLETS_X + 16;
const BULLET_H = 14;
const BULLET_H_TIGHT = 12;
const BULLET_H_DENSE = 11;
const PLATFORM_CHIP_H = 16;
const PLATFORM_CHIP_H_DENSE = 13;
const PLATFORM_CHIP_GAP = 5;
const PLATFORM_CHIP_GAP_DENSE = 3;
const PLATFORM_GROUP_LABEL_H = 12;
const PLATFORM_GROUP_GAP = 5;

const MUTED = 'var(--ant-color-text-tertiary)';
const MUTED_DOT = 'var(--ant-color-text-quaternary)';

export const BackendTierCard: React.FC<Props> = ({ mode }) => {
  const t = useT();
  const tier = TIERS[mode];
  if (!tier) return null;
  const title = t(tier.titleKey);
  const inheritsFromTitle = tier.inheritsFrom ? t(TIERS[tier.inheritsFrom]?.titleKey ?? tier.titleKey) : null;

  // All tiers share the taller card geometry so the left rectangle is
  // a consistent height across modes. The right-side topology still
  // varies (single-monitor vs 2x2 device grid) — only the card is fixed.
  const VB_H = VB_H_TALL;
  const RECT_H = RECT_H_TALL;

  const isToday = tier.badge === 'TODAY';
  // Card border is always a neutral grey — the TODAY / ROADMAP signal
  // lives in the header badge, not the frame, so all four cards read as
  // siblings rather than the first two grabbing attention with a blue
  // outline.
  const accent = 'var(--ant-color-border)';
  const badgeStroke = isToday ? STROKE_BLUE : 'rgba(212, 145, 0, 1)';
  const badgeBg = isToday ? FILL_BLUE : 'rgba(250, 173, 20, 0.18)';

  const headerCX = HEADER_X + HEADER_COL_W / 2;
  const iconCY = RECT_Y + 38;
  const titleY = RECT_Y + 78;
  const subY = RECT_Y + 92;
  const badgeY = RECT_Y + 104;

  const carried = tier.bullets.filter((b) => b.status === 'carried');
  const newOnes = tier.bullets.filter((b) => b.status === 'new');

  const dense = tier.bullets.length > 10;
  const lineH = dense ? BULLET_H_DENSE : BULLET_H_TIGHT;
  const hasGroupLabels = tier.platforms.some((g) => g.labelKey);
  const chipH = dense || hasGroupLabels ? PLATFORM_CHIP_H_DENSE : PLATFORM_CHIP_H;
  const chipGap = dense || hasGroupLabels ? PLATFORM_CHIP_GAP_DENSE : PLATFORM_CHIP_GAP;

  const platformsStartY = RECT_Y + 14;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label={t('workbench.settings.backendPane.tier.cardAria', { title })}
    >
      <rect
        x={RECT_X}
        y={RECT_Y}
        width={RECT_W}
        height={RECT_H}
        rx={10}
        fill="var(--ant-color-bg-container)"
        stroke={accent}
        strokeWidth={1.2}
      />

      <line
        x1={SEPARATOR_1_X}
        y1={RECT_Y + 14}
        x2={SEPARATOR_1_X}
        y2={RECT_Y + RECT_H - 14}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 3"
      />
      <line
        x1={SEPARATOR_2_X}
        y1={RECT_Y + 14}
        x2={SEPARATOR_2_X}
        y2={RECT_Y + RECT_H - 14}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 3"
      />

      <IconArt kind={tier.icon} cx={headerCX} cy={iconCY} />
      <text x={headerCX} y={titleY} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
        {title}
      </text>
      <text x={headerCX} y={subY} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t(tier.subKey)}
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
        fill={isToday ? TEXT : badgeStroke}
        letterSpacing={1}
      >
        {t(
          isToday
            ? 'workbench.settings.backendPane.tier.badge.today'
            : 'workbench.settings.backendPane.tier.badge.roadmap',
        ).toUpperCase()}
      </text>

      {!tier.inheritsFrom ? (
        (() => {
          const startY = RECT_Y + 24;
          return (
            <g>
              {tier.bullets.map((b, j) => (
                <g key={`b-${j}`}>
                  <circle cx={BULLET_X} cy={startY + j * BULLET_H} r={2} fill={STROKE_BLUE} />
                  <text x={BULLET_X + 8} y={startY + 3 + j * BULLET_H} fontSize={10} fill={TEXT}>
                    {t(b.textKey)}
                  </text>
                </g>
              ))}
            </g>
          );
        })()
      ) : (
        (() => {
          const captionY = RECT_Y + 18;
          const carriedStartY = captionY + 20;
          const carriedEndY = carriedStartY + carried.length * lineH;
          const dottedY = carriedEndY + 2;
          const dottedX = BULLETS_X + 8;
          const dottedW = SEPARATOR_2_X - BULLETS_X - 16;
          const newCaptionY = dottedY + 12;
          const newStartY = newCaptionY + 8;
          const dottedH = newOnes.length * lineH + 18;
          return (
            <g>
              <text
                x={BULLET_X - 4}
                y={captionY}
                fontSize={9}
                fontWeight={700}
                fill={MUTED}
                letterSpacing={0.5}
              >
                {t('workbench.settings.backendPane.tier.inheritsFrom', {
                  tier: inheritsFromTitle ?? '',
                }).toUpperCase()}
              </text>
              {carried.map((b, j) => (
                <g key={`c-${j}`}>
                  <circle cx={BULLET_X} cy={carriedStartY + j * lineH} r={1.6} fill={MUTED_DOT} />
                  <text x={BULLET_X + 8} y={carriedStartY + 3 + j * lineH} fontSize={9} fill={MUTED}>
                    {t(b.textKey)}
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
                y={newCaptionY}
                fontSize={9}
                fontWeight={800}
                fill={OH_GREEN}
                letterSpacing={0.6}
              >
                {t('workbench.settings.backendPane.tier.newInTier').toUpperCase()}
              </text>
              {newOnes.map((b, j) => (
                <g key={`n-${j}`}>
                  <circle cx={BULLET_X} cy={newStartY + j * lineH} r={2} fill={STROKE_BLUE} />
                  <text
                    x={BULLET_X + 8}
                    y={newStartY + 3 + j * lineH}
                    fontSize={dense ? 9.5 : 10}
                    fontWeight={600}
                    fill={TEXT}
                  >
                    {t(b.textKey)}
                  </text>
                </g>
              ))}
            </g>
          );
        })()
      )}

      {tier.footer && (() => {
        const footer = tier.footer;
        const cx = HEADER_X + HEADER_COL_W / 2;
        const cy = RECT_Y + RECT_H - 32;
        const glyph =
          footer.kind === 'cloud' ? (
            <CloudGlyph cx={cx} cy={cy} scale={1.3} label={t(footer.labelKey)} />
          ) : (
            <g>
              <rect
                x={cx - 44}
                y={cy - 9}
                width={88}
                height={18}
                rx={9}
                fill={FILL_GREEN}
                stroke={STROKE_GREEN}
                strokeWidth={1}
              />
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
                {t(footer.labelKey)}
              </text>
            </g>
          );
        const urlY = cy + 22;
        // Estimate URL text width to position the (i) icon right after.
        // Monospace at fontSize=10 ≈ 6px/char; centered text, so info
        // icon sits a half-width + 8px to the right of cx.
        const urlHalfW = (footer.url.length * 6) / 2;
        const infoCx = cx + urlHalfW + 10;
        const infoCy = urlY - 4;
        return (
          <g>
            {glyph}
            <text
              x={cx}
              y={urlY}
              textAnchor="middle"
              fontSize={10}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={TEXT}
            >
              {footer.url}
            </text>
            {footer.categories && (
              <Tooltip
                title={<FooterDetails categories={footer.categories} />}
                placement="top"
                color="var(--ant-color-bg-elevated)"
                overlayStyle={{ maxWidth: 560 }}
                overlayInnerStyle={{
                  backgroundColor: 'var(--ant-color-bg-elevated)',
                  color: 'var(--ant-color-text)',
                  boxShadow: 'var(--ant-box-shadow-secondary)',
                  border: '1px solid var(--ant-color-border-secondary)',
                }}
                styles={{ root: { maxWidth: 560 } }}
              >
                <g style={{ cursor: 'help' }}>
                  <circle
                    cx={infoCx}
                    cy={infoCy}
                    r={6}
                    fill="var(--ant-color-fill-tertiary)"
                    stroke="var(--ant-color-border)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={infoCx}
                    y={infoCy + 3}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={700}
                    fontStyle="italic"
                    fill={TEXT_DIM}
                  >
                    i
                  </text>
                </g>
              </Tooltip>
            )}
          </g>
        );
      })()}

      <text x={PLATFORM_X} y={platformsStartY + 8} fontSize={9} fontWeight={800} fill={MUTED} letterSpacing={0.6}>
        {t('workbench.settings.backendPane.tier.supports').toUpperCase()}
      </text>
      {(() => {
        const els: React.ReactNode[] = [];
        let cursorY = platformsStartY + 22;
        tier.platforms.forEach((group, gi) => {
          if (group.labelKey) {
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
                {t(group.labelKey).toUpperCase()}
              </text>,
            );
            cursorY += PLATFORM_GROUP_LABEL_H;
          }
          group.items.forEach((p, pi) => {
            const chipY = cursorY;
            const itemLabel = resolveLabel(p, t);
            els.push(
              <g key={`p-${gi}-${pi}`}>
                <rect
                  x={PLATFORM_X}
                  y={chipY}
                  width={PLATFORM_COL_W}
                  height={chipH}
                  rx={3}
                  fill={FILL_BLUE}
                  stroke={STROKE_BLUE}
                  strokeWidth={0.8}
                />
                <text
                  x={PLATFORM_X + 6}
                  y={chipY + chipH - 4}
                  fontSize={chipH <= 13 ? 8.5 : 9}
                  fontWeight={700}
                  fill={TEXT}
                >
                  {itemLabel}
                </text>
                {p.noteKey && (
                  <text
                    x={PLATFORM_X + PLATFORM_COL_W - 6}
                    y={chipY + chipH - 4}
                    textAnchor="end"
                    fontSize={7}
                    fontStyle="italic"
                    fill={MUTED}
                  >
                    {t(p.noteKey)}
                  </text>
                )}
              </g>,
            );
            cursorY += chipH + chipGap;
          });
          if (gi < tier.platforms.length - 1) cursorY += PLATFORM_GROUP_GAP;
        });
        return els;
      })()}
    </svg>
  );
};
