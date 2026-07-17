/**
 * Shared scene primitives — the TLS-padlock connector and the
 * front-end / back-end pills every scenario container composes.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  FILL_BLUE,
  FILL_GREEN,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  TEXT,
  TEXT_DIM,
} from '../../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../../components/docs/diagrams/open-headers/_shared';

export const ConnectorTls: React.FC<{ id: string; x1: number; y1: number; x2: number; y2: number }> = ({
  id,
  x1,
  y1,
  x2,
  y2,
}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${id})`} />
      <circle cx={mx} cy={my} r={5.5} fill={FILL_GREEN} stroke={STROKE_GREEN} strokeWidth={1} />
      <rect x={mx - 2} y={my - 0.5} width={4} height={3.5} rx={0.6} fill={OH_GREEN} />
      <path
        d={`M ${mx - 1.6} ${my - 0.5} v -1.6 a 1.6 1.6 0 0 1 3.2 0 v 1.6`}
        stroke={OH_GREEN}
        strokeWidth={0.8}
        fill="none"
      />
    </g>
  );
};

/**
 * Compact "X = back-end" pill used inside every scenario container
 * (the in-browser SW pill, the desktop app's in-process pill, the
 * daemon pill on the Local/LAN scene, the VM pill on the Remote one).
 * One layout for the dot + main + sub so every diagram speaks the
 * same visual language.
 *
 * `engine` fills the X — "Service worker" / "Embedded server" /
 * "Local server" / "Remote server". `where` is appended after
 * "oracle · rule-engine · sync-engine · vault — " and conveys the
 * reach (no wire / localhost / LAN / WAN), matching the tier card's
 * footer cloud label.
 */
export const BackEndPill: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  engine: string;
  where: string;
}> = ({ x, y, w, h = 76, engine, where }) => {
  const t = useT();
  const bulletX = x + 30;
  const textX = x + 36;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={FILL_GREEN} stroke={STROKE_GREEN} strokeWidth={1.5} />
      <circle cx={x + 16} cy={y + 18} r={4} fill={OH_GREEN} />
      <text x={x + 28} y={y + 22} fontSize={10.5} fontWeight={700} fill={TEXT}>
        {t('workbench.settings.backendDetails.backEndTitle', { engine })}
      </text>
      <circle cx={bulletX} cy={y + 36} r={1.4} fill={TEXT_DIM} />
      <text x={textX} y={y + 39} fontSize={8.5} fill={TEXT_DIM}>
        <tspan>sync-engine</tspan> · <tspan>rule-engine</tspan>
      </text>
      <circle cx={bulletX} cy={y + 50} r={1.4} fill={TEXT_DIM} />
      <text x={textX} y={y + 53} fontSize={8.5} fill={TEXT_DIM}>
        <tspan>oracle</tspan> · <tspan>vault</tspan>
      </text>
      <circle cx={bulletX} cy={y + 64} r={1.4} fill={TEXT_DIM} />
      <text x={textX} y={y + 67} fontSize={8.5} fill={TEXT_DIM}>
        {where}
      </text>
    </g>
  );
};

/**
 * Front-end pill — blue rounded container mirroring `BackEndPill`'s
 * silhouette. Shows the 4 user-facing surfaces of the extension
 * (popup / workbench / DevTools / side-panel) underneath a "Front-end
 * = N surfaces" title so the in-browser scenario reads as a balanced
 * front-end + back-end pair.
 */
interface FrontEndItem {
  label: string;
  glyph: React.ReactNode;
  /** Optional sub-line listing access methods for this surface (e.g.
   *  "desktop · website"). Rendered as italic muted text under the label. */
  via?: string;
}

interface FrontEndPillProps {
  x: number;
  y: number;
  w: number;
  items: readonly FrontEndItem[];
  /** Optional list of programmatic / headless client types. When set,
   *  the pill splits into two halves: UI surfaces on the left, API
   *  clients on the right, separated by a dashed vertical line. */
  apiClients?: readonly string[];
  /** Marks the surfaces section as opt-in (tier 3/4 are headless by
   *  default; exposing the website is a deliberate choice). */
  surfacesOptional?: boolean;
}

export const FrontEndPill: React.FC<FrontEndPillProps> = ({ x, y, w, items, apiClients, surfacesOptional }) => {
  const t = useT();
  // Vertical rhythm with explicit paddings so title + glyphs + labels
  // have visible breathing room from the rect edges:
  //   top pad → title (~14) → gap → glyph (32) → label (14) → [via?]
  //   → bottom pad
  const padTop = 10;
  const titleH = 14;
  const titleToGlyphGap = 10;
  const glyphH = 32;
  const labelH = 14;
  const hasVia = items.some((it) => Boolean(it.via));
  const viaH = hasVia ? 12 : 0;
  const padBottom = 12;
  const glyphTop = y + padTop + titleH + titleToGlyphGap;
  const h = padTop + titleH + titleToGlyphGap + glyphH + labelH + viaH + padBottom;

  // Two-half layout when apiClients is present: surfaces on the left,
  // API clients on the right. A dashed vertical line marks the split.
  const split = Boolean(apiClients && apiClients.length > 0);
  const sepX = split ? x + w / 2 : null;
  const leftEndX = split ? sepX! - 4 : x + w - 10;
  const leftStartX = x + 10;
  const rightStartX = split ? sepX! + 8 : x + w;
  const rightEndX = x + w - 8;

  const slotW = (leftEndX - leftStartX) / items.length;

  // Chip row geometry (API clients section). Bottom-aligned within the
  // pill so the right half hugs the floor and leaves the upper-right
  // area free — keeps long "served on …" text on the left from
  // visually colliding with the chips when it overflows its slot.
  const chipH = 20;
  const chipGap = 4;
  const chipRowY = y + h - padBottom - chipH;
  const apiTitleY = chipRowY - 6;
  const apiBulletCy = apiTitleY - 4;
  const apiInnerW = rightEndX - rightStartX;
  const chipW = apiClients && apiClients.length > 0
    ? (apiInnerW - chipGap * (apiClients.length - 1)) / apiClients.length
    : 0;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeWidth={1.5} />

      {/* Left section title + surfaces */}
      <circle cx={x + 16} cy={y + padTop + 6} r={4} fill={STROKE_BLUE} />
      <text x={x + 28} y={y + padTop + 10} fontSize={10.5} fontWeight={700} fill={TEXT}>
        {t('workbench.settings.backendDetails.frontEndTitle', { count: items.length })}
        {surfacesOptional && (
          <tspan fontWeight={400} fontStyle="italic" fill={TEXT_DIM}>
            {`  ${t('workbench.settings.backendDetails.optIn')}`}
          </tspan>
        )}
      </text>
      {items.map((it, i) => {
        const cx = leftStartX + slotW * i + slotW / 2;
        return (
          <g key={it.label} transform={`translate(${cx - 21} ${glyphTop})`}>
            {it.glyph}
            <text x={21} y={glyphH + 14} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={TEXT}>
              {it.label}
            </text>
            {it.via && (
              <text
                x={21}
                y={glyphH + 26}
                textAnchor="middle"
                fontSize={8.5}
                fontStyle="italic"
                fill={TEXT_DIM}
              >
                {t('workbench.settings.backendDetails.servedOn', { via: it.via })}
              </text>
            )}
          </g>
        );
      })}

      {/* Right section: API clients (bottom-aligned) */}
      {split && apiClients && (
        <g>
          <circle cx={rightStartX - 4} cy={apiBulletCy} r={4} fill={STROKE_BLUE} />
          <text x={rightStartX + 8} y={apiTitleY} fontSize={10.5} fontWeight={700} fill={TEXT}>
            {t('workbench.settings.backendDetails.apiClientsTitle', { count: apiClients.length })}
          </text>
          {apiClients.map((c, i) => {
            const cx = rightStartX + i * (chipW + chipGap);
            return (
              <g key={c}>
                <rect
                  x={cx}
                  y={chipRowY}
                  width={chipW}
                  height={chipH}
                  rx={4}
                  fill="var(--ant-color-bg-container)"
                  stroke={STROKE_BLUE}
                  strokeWidth={0.8}
                />
                <text
                  x={cx + chipW / 2}
                  y={chipRowY + chipH - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill={TEXT}
                >
                  {c}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
};
