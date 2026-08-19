/**
 * Redirect — diagrams.
 *
 *   • RedirectStaticDiagram — single URL substitution.
 *   • RedirectRegexDiagram — capture groups in a URL Regex match.
 *   • RedirectUseCasesDiagram — common patterns at a glance.
 *   • RedirectWontApplyDiagram — gotchas (already-loaded + loops).
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_BLUE, FILL_GREEN, STROKE, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from './_shared';

/**
 * Static redirect — full URL goes in, full URL comes out. Reads
 * top-to-bottom: incoming URL → DNR rule → outgoing URL. The
 * destination URL is highlighted green to mark it as the result.
 */
export const RedirectStaticDiagram: React.FC = () => {
  const t = useT();
  const ID = 'rds';
  const RULE_Y = 22;
  const RULE_H = 22;
  const STATE_X = 30;
  const STATE_W = 260;
  const BEFORE_Y = 70;
  const ROW_H = 38;
  const ARROW_Y_START = BEFORE_Y + ROW_H + 4;
  const ARROW_Y_END = ARROW_Y_START + 22;
  const AFTER_Y = ARROW_Y_END + 4;
  const STAMP_Y = AFTER_Y + ROW_H + 22;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.redirect.staticAria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.ruleKicker')}
      </text>
      <rect x={20} y={RULE_Y} width={280} height={RULE_H} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text
        x={160}
        y={RULE_Y + 15}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        {t('workbench.docs.diagrams.redirect.ruleStatic')}
      </text>

      <rect
        x={STATE_X}
        y={BEFORE_Y}
        width={STATE_W}
        height={ROW_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={STATE_X + 8} y={BEFORE_Y + 13} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.redirect.originalRequestKicker')}
      </text>
      <text x={STATE_X + 10} y={BEFORE_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        https://openheaders.com/old-page
      </text>

      <line
        x1={STATE_X + STATE_W / 2}
        y1={ARROW_Y_START}
        x2={STATE_X + STATE_W / 2}
        y2={ARROW_Y_END}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={STATE_X + STATE_W / 2 + 12}
        y={(ARROW_Y_START + ARROW_Y_END) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_BLUE}
      >
        {t('workbench.docs.diagrams.redirect.urlRewritten')}
      </text>

      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={ROW_H} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.redirect.redirectedToKicker')}
      </text>
      <text x={STATE_X + 10} y={AFTER_Y + 30} fontFamily="monospace" fontSize={10} fontWeight={700} fill={STROKE_GREEN}>
        https://openheaders.com/new-page
      </text>

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.redirect.staticStamp')}
      </text>
      <text x={160} y={STAMP_Y + 14} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.redirect.staticStampSub')}
      </text>
    </svg>
  );
};

/**
 * Regex redirect — the destination URL contains backreferences
 * (\1, \2, …) to capture groups in the URL Regex condition. The
 * diagram pulls the captured group out into a labeled chip so the
 * substitution is visible.
 */
export const RedirectRegexDiagram: React.FC = () => {
  const t = useT();
  const ID = 'rdr';
  const GOLD = 'rgba(212, 145, 0, 1)';
  const GOLD_BG = 'rgba(250, 173, 20, 0.18)';

  const RULE_Y = 22;
  const RULE_H = 22;
  const STATE_X = 30;
  const STATE_W = 260;
  const BEFORE_Y = 76;
  const ROW_H = 56;
  const ARROW_Y = BEFORE_Y + ROW_H + 4;
  const ARROW_END = ARROW_Y + 22;
  const AFTER_Y = ARROW_END + 4;
  const STAMP_Y = AFTER_Y + 38 + 22;

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.redirect.regexAria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.ruleKicker')}
      </text>
      <rect x={20} y={RULE_Y} width={280} height={RULE_H + 12} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={RULE_Y + 14} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.redirect.ruleRegexLine1')}
      </text>
      <text
        x={160}
        y={RULE_Y + 28}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        {t('workbench.docs.diagrams.redirect.ruleRegexLine2')}
      </text>

      {/* MATCHED URL with capture group highlighted */}
      <rect
        x={STATE_X}
        y={BEFORE_Y}
        width={STATE_W}
        height={ROW_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={STATE_X + 8} y={BEFORE_Y + 13} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.redirect.originalUrlKicker')}
      </text>
      <text x={STATE_X + 10} y={BEFORE_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        http://
        <tspan fill={GOLD} fontWeight={700}>
          openheaders.com/page
        </tspan>
      </text>
      {/* Capture-group chip below */}
      <rect x={STATE_X + 80} y={BEFORE_Y + 36} width={140} height={14} rx={3} fill={GOLD_BG} stroke={GOLD} />
      <text
        x={STATE_X + 150}
        y={BEFORE_Y + 47}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fontWeight={700}
        fill={GOLD}
      >
        {t('workbench.docs.diagrams.redirect.captureChip')}
      </text>

      <line
        x1={STATE_X + STATE_W / 2}
        y1={ARROW_Y}
        x2={STATE_X + STATE_W / 2}
        y2={ARROW_END}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={STATE_X + STATE_W / 2 + 12}
        y={(ARROW_Y + ARROW_END) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_BLUE}
      >
        {t('workbench.docs.diagrams.redirect.substituted')}
      </text>

      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={38} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.redirect.redirectedToKicker')}
      </text>
      <text x={STATE_X + 10} y={AFTER_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        https://
        <tspan fill={GOLD} fontWeight={700}>
          openheaders.com/page
        </tspan>
      </text>

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.redirect.regexStamp')}
      </text>
    </svg>
  );
};

/**
 * Use-case grid for Redirect — four typical patterns. Same 2×2
 * shape as Block's use-cases diagram for visual consistency.
 */
export const RedirectUseCasesDiagram: React.FC = () => {
  const t = useT();
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    { title: 'HTTP → HTTPS', example: t('workbench.docs.diagrams.redirect.card1Example') },
    { title: t('workbench.docs.diagrams.redirect.card2Title'), example: 'old.com → new.com' },
    { title: t('workbench.docs.diagrams.redirect.card3Title'), example: '/v1/* → /v2/*' },
    { title: t('workbench.docs.diagrams.redirect.card4Title'), example: 'cdn.example → localhost' },
  ];

  const CARD_W = 142;
  const CARD_H = 60;
  const CARD_X = [14, 164] as const;
  const CARD_Y_START = 36;
  const CARD_GAP = 12;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.redirect.useCasesAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.useCasesKicker')}
      </text>

      {CARDS.map((card, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = CARD_X[col];
        const y = CARD_Y_START + row * (CARD_H + CARD_GAP);
        return (
          <g key={card.title}>
            <rect
              x={x}
              y={y}
              width={CARD_W}
              height={CARD_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            <rect x={x} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_BLUE} />
            <circle cx={x + 16} cy={y + 16} r={8} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={x + 16} y={y + 19} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_BLUE}>
              {i + 1}
            </text>
            <text x={x + 30} y={y + 19} fontSize={10} fontWeight={700} fill={TEXT}>
              {card.title}
            </text>
            <text x={x + 12} y={y + 40} fontFamily="monospace" fontSize={8} fill={TEXT}>
              {card.example}
            </text>
          </g>
        );
      })}

      <text x={160} y={188} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.redirect.useCasesFooter')}
      </text>
    </svg>
  );
};

/**
 * Redirect — common gotchas. Already-loaded pages don't retry, and
 * redirect loops are silently capped by Chrome's network stack.
 */
export const RedirectWontApplyDiagram: React.FC = () => {
  const t = useT();
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.redirect.wontApplyAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.wontFireKicker')}
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={116}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.redirect.pageLoaded')}
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.redirect.pageLoadedSub')}
      </text>

      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.redirect.loops')}
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.redirect.loopsSub')}
      </text>

      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.shared.suggestion')}
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.redirect.suggestionText')}
      </text>
    </svg>
  );
};
