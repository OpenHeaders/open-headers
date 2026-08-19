import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';

// Saturated success-green palette (matches the open-headers group's
// OH_GREEN tokens) — Ant's `success-bg` reads as a washed-out lime on
// light themes, which hurts the eye on a primary highlight. These use
// the vibrant `success` token + a low-alpha tint for fill.
const OH_GREEN = 'var(--ant-color-success)';
const OH_GREEN_TINT = 'rgba(82, 196, 26, 0.12)';

/**
 * Rule anatomy — concrete request-lifecycle pipeline.
 *
 * Top: the actual outgoing HTTP request (method · URL · headers).
 * Middle: the rule itself, split into Conditions (AND-matched, left)
 * and Action (right) with a vertical divider. Bottom: the same
 * request with the action's change highlighted green. The reader sees
 * BEFORE → RULE → AFTER, not abstract boxes connected by arrows.
 */
export const ActionsRuleAnatomyDiagram: React.FC<{ focus?: 'conditions' | 'action' }> = ({
  focus = 'action',
}) => {
  const t = useT();
  const W = 480;
  const CX = W / 2;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  // Outgoing request (BEFORE)
  const REQ_W = 380;
  const REQ_X = (W - REQ_W) / 2;
  const REQ_BEFORE_Y = 58;
  const REQ_BEFORE_H = 74;
  const CHROME_H = 22;

  // Rule card (middle)
  const RULE_W = 420;
  const RULE_X = (W - RULE_W) / 2;
  const RULE_Y = REQ_BEFORE_Y + REQ_BEFORE_H + 28;
  const RULE_H = 144;

  // Outgoing request (AFTER)
  const REQ_AFTER_Y = RULE_Y + RULE_H + 28;
  const REQ_AFTER_H = 92;

  // Verdict
  const VERDICT_Y = REQ_AFTER_Y + REQ_AFTER_H + 14;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;

  const renderRequest = (
    y: number,
    h: number,
    label: string,
    sideTag: string,
    lines: { text: string; highlight?: boolean }[],
    accent: 'neutral' | 'after',
  ) => {
    const stroke = accent === 'after' ? OH_GREEN : STROKE_BLUE;
    return (
      <g>
        {/* Outer card */}
        <rect
          x={REQ_X}
          y={y}
          width={REQ_W}
          height={h}
          rx={8}
          fill="var(--ant-color-bg-container)"
          stroke={stroke}
          strokeWidth={1.4}
        />
        {/* Chrome bar — neutral gray, traffic lights on the left */}
        <rect
          x={REQ_X}
          y={y}
          width={REQ_W}
          height={CHROME_H}
          rx={8}
          fill="var(--ant-color-fill-secondary)"
          stroke={stroke}
        />
        <circle cx={REQ_X + 12} cy={y + CHROME_H / 2} r={4} fill="#ff5f57" />
        <circle cx={REQ_X + 24} cy={y + CHROME_H / 2} r={4} fill="#febc2e" />
        <circle cx={REQ_X + 36} cy={y + CHROME_H / 2} r={4} fill="#28c840" />
        <text x={REQ_X + 50} y={y + CHROME_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
          {label}
        </text>
        <text
          x={REQ_X + REQ_W - 12}
          y={y + CHROME_H / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {sideTag}
        </text>
        {/* Render the request line (i=0) inside an address-bar style
         *  pill — visually distinct from the headers below without
         *  needing a separator line. */}
        {(() => {
          const URL_BAR_Y = y + CHROME_H + 4;
          const URL_BAR_H = 20;
          return (
            <g>
              <rect
                x={REQ_X + 8}
                y={URL_BAR_Y}
                width={REQ_W - 16}
                height={URL_BAR_H}
                rx={URL_BAR_H / 2}
                fill="var(--ant-color-fill-quaternary)"
                stroke="var(--ant-color-border)"
              />
              {/* Method tag at the start of the pill */}
              {(() => {
                const firstLine = lines[0]?.text ?? '';
                const [method, ...rest] = firstLine.split(/\s+/);
                const url = rest.join(' ');
                return (
                  <g>
                    <text
                      x={REQ_X + 18}
                      y={URL_BAR_Y + URL_BAR_H / 2 + 4}
                      fontFamily="monospace"
                      fontSize={10}
                      fontWeight={800}
                      fill={STROKE_BLUE}
                    >
                      {method}
                    </text>
                    <text
                      x={REQ_X + 18 + method.length * 7 + 10}
                      y={URL_BAR_Y + URL_BAR_H / 2 + 4}
                      fontFamily="monospace"
                      fontSize={10}
                      fontWeight={500}
                      fill={TEXT}
                    >
                      {url}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })()}
        {/* Header rows (i >= 1) — plain monospace, no pill */}
        {lines.slice(1).map((line, idx) => {
          const i = idx + 1;
          const rowY = y + CHROME_H + 42 + (i - 1) * 14;
          return (
            <g key={`${y}-${i}`}>
              {line.highlight && (
                <rect
                  x={REQ_X + 8}
                  y={rowY - 10}
                  width={REQ_W - 16}
                  height={14}
                  rx={2}
                  fill={OH_GREEN_TINT}
                />
              )}
              <text
                x={REQ_X + 14}
                y={rowY}
                fontFamily="monospace"
                fontSize={10}
                fontWeight={line.highlight ? 700 : 500}
                fill={line.highlight ? OH_GREEN : TEXT}
              >
                {line.text}
              </text>
              {line.highlight && (
                <text
                  x={REQ_X + REQ_W - 14}
                  y={rowY}
                  textAnchor="end"
                  fontSize={8.5}
                  fontWeight={800}
                  fill={OH_GREEN}
                  letterSpacing={0.5}
                >
                  {t('workbench.docs.diagrams.actions.ruleAnatomy.addedTag')}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // Arrow helper between cards
  const renderArrow = (cy: number, label: string, accent: 'blue' | 'green') => {
    const color = accent === 'green' ? OH_GREEN : STROKE_BLUE;
    return (
      <g>
        <line x1={CX} y1={cy - 10} x2={CX} y2={cy + 10} stroke={color} strokeWidth={1.8} />
        <polygon points={`${CX},${cy + 14} ${CX - 5},${cy + 6} ${CX + 5},${cy + 6}`} fill={color} />
        <text x={CX + 10} y={cy + 4} fontSize={9.5} fontStyle="italic" fontWeight={700} fill={color}>
          {label}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.actions.ruleAnatomy.aria')}
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.actions.ruleAnatomy.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.actions.ruleAnatomy.subtitle')}
      </text>

      {/* BEFORE request */}
      {renderRequest(
        REQ_BEFORE_Y,
        REQ_BEFORE_H,
        t('workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest'),
        t('workbench.docs.diagrams.actions.ruleAnatomy.sideBefore'),
        [
          { text: 'POST  https://api.openheaders.com/v2/users' },
          { text: 'Content-Type: application/json' },
        ],
        'neutral',
      )}

      {renderArrow(
        REQ_BEFORE_Y + REQ_BEFORE_H + 14,
        t('workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck'),
        'blue',
      )}

      {/* RULE — two columns: Conditions + Action */}
      <rect
        x={RULE_X}
        y={RULE_Y}
        width={RULE_W}
        height={RULE_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.6}
      />
      <rect
        x={RULE_X}
        y={RULE_Y}
        width={RULE_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      <circle cx={RULE_X + 12} cy={RULE_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
      <circle cx={RULE_X + 24} cy={RULE_Y + CHROME_H / 2} r={4} fill="#febc2e" />
      <circle cx={RULE_X + 36} cy={RULE_Y + CHROME_H / 2} r={4} fill="#28c840" />
      <text x={RULE_X + 50} y={RULE_Y + CHROME_H / 2 + 4} fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel')}
      </text>
      <text
        x={RULE_X + RULE_W - 12}
        y={RULE_Y + CHROME_H / 2 + 4}
        textAnchor="end"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {t('workbench.docs.diagrams.actions.ruleAnatomy.editorEntity')}
      </text>
      {/* Vertical divider — splits Conditions (left) from Action (right) */}
      {(() => {
        const colDividerX = RULE_X + RULE_W * 0.58;
        const condX = RULE_X + 12;
        const condTopY = RULE_Y + CHROME_H + 12;
        const actionX = colDividerX + 14;
        // The container starts BELOW the section label (which is at
        // condTopY) so the "CONDITIONS" / "ACTION" caption stays
        // outside the card, like a panel title above its body.
        const focusBgY = condTopY + 8;
        const focusBgH = RULE_Y + RULE_H - focusBgY - 8;
        return (
          <g>
            {/* Focused-side container — wraps the focused column in a
             *  proper bordered card (FILL_BLUE for conditions,
             *  FILL_PURPLE for action), matching how the other side is
             *  already styled on each respective page. */}
            {focus === 'conditions' && (
              <rect
                x={RULE_X + 6}
                y={focusBgY}
                width={colDividerX - RULE_X - 10}
                height={focusBgH}
                rx={5}
                fill={FILL_BLUE}
                stroke={STROKE_BLUE}
                strokeWidth={1.2}
              />
            )}
            <line
              x1={colDividerX}
              y1={RULE_Y + CHROME_H + 6}
              x2={colDividerX}
              y2={RULE_Y + RULE_H - 8}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />

            {/* LEFT: CONDITIONS */}
            <text
              x={condX}
              y={condTopY}
              fontSize={9}
              fontWeight={800}
              fill={STROKE_BLUE}
              letterSpacing={0.6}
            >
              {t('workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker')}
            </text>
            {[
              {
                label: t('workbench.docs.diagrams.actions.ruleAnatomy.condMethods'),
                value: 'POST',
                match: true,
              },
              {
                label: t('workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains'),
                value: 'api.openheaders.com',
                match: true,
              },
              {
                label: t('workbench.docs.diagrams.actions.ruleAnatomy.condHeaders'),
                value: 'Content-Type: application/json',
                match: true,
              },
            ].map((c, i) => (
              <g key={c.label}>
                <circle cx={condX + 6} cy={condTopY + 24 + i * 22} r={4} fill={OH_GREEN} />
                <path
                  d={`M ${condX + 3} ${condTopY + 24 + i * 22} l 2 2 l 4 -4`}
                  stroke="var(--ant-color-bg-container)"
                  strokeWidth={1.4}
                  fill="none"
                  strokeLinecap="round"
                />
                <text x={condX + 16} y={condTopY + 22 + i * 22} fontSize={10} fontWeight={700} fill={TEXT}>
                  {c.label}
                </text>
                <text
                  x={condX + 16}
                  y={condTopY + 34 + i * 22}
                  fontFamily="monospace"
                  fontSize={9}
                  fill={focus === 'conditions' ? TEXT : STROKE_BLUE}
                >
                  = {c.value}
                </text>
              </g>
            ))}
            {/* "ALL MUST MATCH (AND)" footer — sits under the conditions
             *  list, so the AND-join framing is read AFTER the reader
             *  sees the list itself. */}
            <text
              x={condX}
              y={condTopY + 34 + 2 * 22 + 16}
              fontSize={8.5}
              fontStyle="italic"
              fontWeight={700}
              fill={TEXT_DIM}
            >
              {t('workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch')}
            </text>

            {/* RIGHT: ACTION */}
            <text
              x={actionX}
              y={condTopY}
              fontSize={9}
              fontWeight={800}
              fill={STROKE_PURPLE}
              letterSpacing={0.6}
            >
              {t('workbench.docs.diagrams.actions.ruleAnatomy.actionKicker')}
            </text>
            <text
              x={RULE_X + RULE_W - 12}
              y={condTopY}
              textAnchor="end"
              fontSize={8.5}
              fontStyle="italic"
              fontWeight={700}
              fill={TEXT_DIM}
            >
              {t('workbench.docs.diagrams.actions.ruleAnatomy.onePerRule')}
            </text>
            {/* Action card — example: Header Action · Add. When the
             *  Conditions side is focused, the action card is rendered
             *  neutrally so the visual weight stays on the left. */}
            <rect
              x={actionX}
              y={condTopY + 8}
              width={RULE_X + RULE_W - 12 - actionX}
              height={RULE_H - CHROME_H - 28}
              rx={5}
              fill={focus === 'action' ? FILL_PURPLE : 'var(--ant-color-bg-container)'}
              stroke={focus === 'action' ? STROKE_PURPLE : 'var(--ant-color-border)'}
              strokeWidth={1.2}
            />
            <text x={actionX + 10} y={condTopY + 22} fontSize={10} fontWeight={700} fill={TEXT}>
              {t('workbench.docs.diagrams.actions.ruleAnatomy.actionCard')}
            </text>
            <text
              x={actionX + 10}
              y={condTopY + 36}
              fontFamily="monospace"
              fontSize={9}
              fontWeight={700}
              fill={STROKE_PURPLE}
            >
              Authorization:
            </text>
            <text
              x={actionX + 10}
              y={condTopY + 48}
              fontFamily="monospace"
              fontSize={9}
              fill={STROKE_PURPLE}
            >
              {t('workbench.docs.diagrams.actions.ruleAnatomy.actionValue')}
            </text>
            <text
              x={actionX + 10}
              y={condTopY + 64}
              fontSize={8.5}
              fontStyle="italic"
              fill={TEXT_DIM}
            >
              {t('workbench.docs.diagrams.actions.ruleAnatomy.categoryLine')}
            </text>
          </g>
        );
      })()}

      {renderArrow(RULE_Y + RULE_H + 14, t('workbench.docs.diagrams.actions.ruleAnatomy.arrowApply'), 'green')}

      {/* AFTER request */}
      {renderRequest(
        REQ_AFTER_Y,
        REQ_AFTER_H,
        t('workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest'),
        t('workbench.docs.diagrams.actions.ruleAnatomy.sideAfter'),
        [
          { text: 'POST  https://api.openheaders.com/v2/users' },
          { text: 'Content-Type: application/json' },
          { text: 'Authorization: Bearer abc123…', highlight: true },
        ],
        'after',
      )}

      {/* Verdict — three colored pills (one per phase), black text on
       *  each so it stays readable. Pill backgrounds track the section
       *  colors: blue conditions · purple action · green result. */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border-secondary)"
        strokeWidth={1.2}
      />
      {(() => {
        const phrases: { text: string; fill: string; stroke: string }[] = [
          {
            text: t('workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions'),
            fill: FILL_BLUE,
            stroke: STROKE_BLUE,
          },
          {
            text: t('workbench.docs.diagrams.actions.ruleAnatomy.verdictAction'),
            fill: FILL_PURPLE,
            stroke: STROKE_PURPLE,
          },
          {
            text: t('workbench.docs.diagrams.actions.ruleAnatomy.verdictResult'),
            fill: OH_GREEN_TINT,
            stroke: OH_GREEN,
          },
        ];
        const charW = 6;
        const padX = 10;
        const gap = 8;
        // CJK glyphs render close to the full em box, not the ~0.6em a
        // Latin glyph averages — weigh them accordingly so pill widths
        // hold across locales.
        const unitLen = (s: string) =>
          Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.7 : 1), 0);
        const widths = phrases.map((p) => Math.round(unitLen(p.text) * charW + padX * 2));
        const totalW = widths.reduce((s, w) => s + w, 0) + (phrases.length - 1) * gap;
        const pillH = 22;
        const pillY = VERDICT_Y + (VERDICT_H - pillH) / 2;
        let cursor = CX - totalW / 2;
        return phrases.map((p, i) => {
          const w = widths[i];
          const px = cursor;
          cursor += w + gap;
          return (
            <g key={p.text}>
              <rect
                x={px}
                y={pillY}
                width={w}
                height={pillH}
                rx={pillH / 2}
                fill={p.fill}
                stroke={p.stroke}
                strokeWidth={1.2}
              />
              <text
                x={px + w / 2}
                y={pillY + pillH / 2 + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={TEXT}
              >
                {p.text}
              </text>
            </g>
          );
        });
      })()}
    </svg>
  );
};
