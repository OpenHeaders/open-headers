/**
 * Inject JS / CSS — diagrams.
 *
 *   • InjectTimingDiagram     — timeline overview (ASAP vs After Load)
 *   • InjectScriptDiagram     — JS injection: code or external URL
 *   • InjectCssDiagram        — CSS injection: <style> tag added
 *   • InjectWontApplyDiagram  — sandboxed iframes / CSP gotchas
 *   • InjectUseCasesDiagram   — common patterns at a glance
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

export const InjectTimingDiagram: React.FC = () => (
  <svg
    viewBox="0 0 280 140"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Inject timing — ASAP runs pre-page-script; After Load runs once DOM is parsed."
  >
    <ArrowDefs id="inj-arrow" />
    <line x1="20" y1="80" x2="260" y2="80" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#inj-arrow)" />
    <text x={260} y={94} textAnchor="end" fontSize="9" fill={TEXT_DIM}>
      time →
    </text>
    <circle cx="60" cy="80" r="3" fill={STROKE} />
    <text x={60} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      navigation
    </text>
    <circle cx="140" cy="80" r="3" fill={STROKE} />
    <text x={140} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      DOM parsed
    </text>
    <circle cx="220" cy="80" r="3" fill={STROKE} />
    <text x={220} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      load event
    </text>
    <rect x={50} y={30} width={50} height={30} rx={4} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
    <text x={75} y={48} textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      ASAP
    </text>
    <text x={75} y={20} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      pre-page-script
    </text>
    <rect x={205} y={30} width={50} height={30} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
    <text x={230} y={48} textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      After Load
    </text>
    <text x={230} y={20} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      DOM-safe
    </text>
    <line x1="75" y1="60" x2="60" y2="78" stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" />
    <line x1="230" y1="60" x2="220" y2="78" stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" />
    <text x={140} y={130} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      ASAP for races · After Load for DOM
    </text>
  </svg>
);

/**
 * Script injection — show the JS landing inside a stylized page,
 * with the two timing slots called out explicitly. Page DOM rows
 * are dim; the injected `<script>` is highlighted purple.
 */
export const InjectScriptDiagram: React.FC = () => {
  const ID = 'inj-js';

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Script injection — JavaScript runs inside the page, either ASAP (pre-page-script) or After Load (DOM-safe)."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={22} width={280} height={22} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Script (ASAP): wrap fetch to log every call
      </text>

      {/* Page mockup */}
      <rect
        x={30}
        y={66}
        width={260}
        height={134}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke="var(--ant-color-border)"
      />
      <rect
        x={30}
        y={66}
        width={260}
        height={16}
        rx={6}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={40} y={78} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        &lt;!doctype html&gt;
      </text>

      {/* Injected script — purple highlighted block at the top */}
      <rect x={40} y={90} width={240} height={28} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={48} y={102} fontFamily="monospace" fontSize={9} fontWeight={700} fill={STROKE_PURPLE}>
        &lt;script&gt; // injected by extension
      </text>
      <text x={48} y={114} fontFamily="monospace" fontSize={9} fill={TEXT}>
        const _f = window.fetch;
      </text>

      {/* Page body — dim */}
      <g opacity={0.55}>
        <text x={40} y={130} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
          &lt;body&gt;
        </text>
        <text x={48} y={144} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
          &lt;h1&gt;App&lt;/h1&gt;
        </text>
        <text x={48} y={158} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
          &lt;script src="app.js"&gt;&lt;/script&gt;
        </text>
        <text x={40} y={172} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
          &lt;/body&gt;
        </text>
      </g>

      {/* Timing chips on the right edge */}
      <rect x={222} y={90} width={62} height={14} rx={3} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={253} y={100} textAnchor="middle" fontSize={8} fontWeight={700} fill={STROKE_ORANGE}>
        ASAP
      </text>

      <rect x={222} y={158} width={62} height={14} rx={3} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={253} y={168} textAnchor="middle" fontSize={8} fontWeight={700} fill={STROKE_GREEN}>
        After Load
      </text>

      <text x={160} y={216} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Runs in the page context — sees the same globals as page JS.
      </text>
      <text x={160} y={230} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        ASAP wins races before app code; After Load reads a parsed DOM.
      </text>
    </svg>
  );
};

/**
 * CSS injection — a <style> tag is appended to the page's head.
 * Show the page mockup with the CSS chunk highlighted and a small
 * "before / after" render preview.
 */
export const InjectCssDiagram: React.FC = () => {
  const ID = 'inj-css';
  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="CSS injection — a <style> tag is appended to the page's head, hiding the banner element."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={22} width={280} height={22} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        CSS: header.banner {'{ display: none }'}
      </text>

      {/* Before page card */}
      <rect
        x={10}
        y={64}
        width={140}
        height={140}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke="var(--ant-color-border)"
      />
      <text x={80} y={78} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        BEFORE
      </text>
      {/* Banner shown */}
      <rect x={20} y={84} width={120} height={20} rx={2} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={80} y={97} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        header.banner
      </text>
      {/* page rows */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={20}
          y={112 + i * 18}
          width={120 - i * 14}
          height={6}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}

      {/* Arrow */}
      <line x1={156} y1={134} x2={170} y2={134} stroke={STROKE_PURPLE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={163} y={126} textAnchor="middle" fontSize={8} fontStyle="italic" fill={STROKE_PURPLE}>
        rule
      </text>
      <text x={163} y={148} textAnchor="middle" fontSize={8} fontStyle="italic" fill={STROKE_PURPLE}>
        applied
      </text>

      {/* After page card */}
      <rect
        x={172}
        y={64}
        width={140}
        height={140}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_PURPLE}
      />
      <text x={242} y={78} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_PURPLE}>
        AFTER
      </text>
      {/* Banner hidden — shown as struck-through dim */}
      <rect
        x={182}
        y={84}
        width={120}
        height={20}
        rx={2}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="2 2"
      />
      <text x={242} y={97} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        (hidden)
      </text>
      {/* Page rows shift up — show only 4 lower rows */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={182}
          y={112 + i * 18}
          width={120 - i * 14}
          height={6}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}

      <text x={160} y={224} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Injected as a {'<style>'} tag — same CSS specificity as page CSS.
      </text>
    </svg>
  );
};

export const InjectWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Inject doesn't apply to sandboxed iframes or pages with strict CSP that blocks inline scripts."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHEN IT DOESN'T FIRE
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
        Sandboxed iframes
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Pages with sandbox="" that disables scripts.
      </text>

      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        Strict CSP (script-src 'self')
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Inline injected scripts get blocked by the page's policy.
      </text>

      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        Inject in the parent page; postMessage into the iframe.
      </text>
    </svg>
  );
};

export const InjectUseCasesDiagram: React.FC = () => {
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    { title: 'Monkey-patch', example: 'Wrap fetch / XHR (ASAP)' },
    { title: 'Dark mode', example: 'Force a CSS theme' },
    { title: 'Hide noise', example: 'display: none banners' },
    { title: 'Feature flags', example: 'Set window flags ASAP' },
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
      aria-label="Inject JS / CSS — common use cases: monkey-patching, dark mode, hiding elements, feature flags."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        COMMON USE CASES
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
            <rect x={x} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_PURPLE} />
            <circle cx={x + 16} cy={y + 16} r={8} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
            <text x={x + 16} y={y + 19} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_PURPLE}>
              {i + 1}
            </text>
            <text x={x + 30} y={y + 19} fontSize={10} fontWeight={700} fill={TEXT}>
              {card.title}
            </text>
            <text x={x + 12} y={y + 40} fontSize={9} fill={TEXT}>
              {card.example}
            </text>
          </g>
        );
      })}

      <text x={160} y={188} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Use ASAP for code that must run first; After Load for DOM reads.
      </text>
    </svg>
  );
};
