/**
 * ViewPickerIcons — 16×16 glyph set for the response body view picker.
 * Languages render as bare marks; the byte-level encoding views (Raw /
 * Hex / Base64) render as boxed badges so the picker's two halves are
 * distinguishable at a glance. Everything draws in `currentColor`, so
 * the icons follow the menu's text color in both themes.
 */

import type React from 'react';

const MONO = "ui-monospace, 'SF Mono', 'Fira Code', monospace";

const STROKE: React.SVGAttributes<SVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.45,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Letter glyphs get a thin outline stroke over their fill so their
 *  stem weight matches the 1.7px strokes of the drawn marks — bare
 *  700-weight text at these sizes renders visibly lighter. */
function Letters({ text, size, x = 8, y = 8.6 }: { text: string; size: number; x?: number; y?: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily={MONO}
      fontSize={size}
      fontWeight={700}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.3}
      strokeLinejoin="round"
    >
      {text}
    </text>
  );
}

function Badge() {
  return <rect x={1} y={1} width={14} height={14} rx={3.2} {...STROKE} strokeWidth={1.2} />;
}

const ICON_MARKS: Record<string, React.ReactNode> = {
  json: <Letters text="{}" size={13} />,
  xml: (
    <>
      <polyline points="6,3.8 1.8,8 6,12.2" {...STROKE} />
      <polyline points="10,3.8 14.2,8 10,12.2" {...STROKE} />
    </>
  ),
  html: (
    <>
      <polyline points="4.4,4.4 0.8,8 4.4,11.6" {...STROKE} strokeWidth={1.35} />
      <polyline points="11.6,4.4 15.2,8 11.6,11.6" {...STROKE} strokeWidth={1.35} />
      <line x1={9.6} y1={3.2} x2={6.4} y2={12.8} {...STROKE} strokeWidth={1.35} />
    </>
  ),
  javascript: <Letters text="JS" size={10.5} />,
  css: <Letters text="#" size={13} />,
  markdown: (
    <>
      <Letters text="M" size={11} x={4.8} />
      <line x1={12} y1={4.2} x2={12} y2={11} {...STROKE} strokeWidth={1.35} />
      <polyline points="9.9,9.4 12,11.6 14.1,9.4" {...STROKE} strokeWidth={1.35} />
    </>
  ),
  text: <Letters text="Aa" size={10.5} />,
  raw: (
    <>
      <Badge />
      <line x1={4.2} y1={5.4} x2={11.8} y2={5.4} {...STROKE} strokeWidth={1.2} />
      <line x1={4.2} y1={8} x2={11.8} y2={8} {...STROKE} strokeWidth={1.2} />
      <line x1={4.2} y1={10.6} x2={9.4} y2={10.6} {...STROKE} strokeWidth={1.2} />
    </>
  ),
  hex: (
    <>
      <Badge />
      <Letters text="0x" size={7.5} />
    </>
  ),
  base64: (
    <>
      <Badge />
      <Letters text="64" size={7.5} />
    </>
  ),
};

export function ViewPickerIcon({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      {ICON_MARKS[id]}
    </svg>
  );
}

/** Wrap-lines toggle mark: a full line, a line folding back under
 *  itself with a return arrow, and the short continuation stub. */
export function WrapLinesIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <line x1={2.6} y1={4} x2={13.4} y2={4} {...STROKE} strokeWidth={1.3} />
      <path d="M2.6 8.2 H10.4 A2.1 2.1 0 0 1 10.4 12.4 H7.6" {...STROKE} strokeWidth={1.3} />
      <polyline points="9.3,10.7 7.4,12.4 9.3,14.1" {...STROKE} strokeWidth={1.3} />
      <line x1={2.6} y1={12.4} x2={4.8} y2={12.4} {...STROKE} strokeWidth={1.3} />
    </svg>
  );
}
