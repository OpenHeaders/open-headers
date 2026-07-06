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
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

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
    >
      {text}
    </text>
  );
}

function Badge() {
  return <rect x={1.6} y={1.6} width={12.8} height={12.8} rx={3} {...STROKE} strokeWidth={1.2} />;
}

const ICON_MARKS: Record<string, React.ReactNode> = {
  json: <Letters text="{}" size={11} />,
  xml: (
    <>
      <polyline points="6,4.7 2.6,8 6,11.3" {...STROKE} />
      <polyline points="10,4.7 13.4,8 10,11.3" {...STROKE} />
    </>
  ),
  html: (
    <>
      <polyline points="4.6,5.2 1.8,8 4.6,10.8" {...STROKE} strokeWidth={1.3} />
      <polyline points="11.4,5.2 14.2,8 11.4,10.8" {...STROKE} strokeWidth={1.3} />
      <line x1={9.2} y1={4.2} x2={6.8} y2={11.8} {...STROKE} strokeWidth={1.3} />
    </>
  ),
  javascript: <Letters text="JS" size={8.5} />,
  css: <Letters text="#" size={11} />,
  markdown: (
    <>
      <Letters text="M" size={9} x={5.4} />
      <line x1={11.6} y1={5.2} x2={11.6} y2={10.6} {...STROKE} strokeWidth={1.3} />
      <polyline points="9.9,9 11.6,10.8 13.3,9" {...STROKE} strokeWidth={1.3} />
    </>
  ),
  text: <Letters text="Aa" size={8.5} />,
  raw: (
    <>
      <Badge />
      <line x1={4.4} y1={5.6} x2={11.6} y2={5.6} {...STROKE} strokeWidth={1.2} />
      <line x1={4.4} y1={8} x2={11.6} y2={8} {...STROKE} strokeWidth={1.2} />
      <line x1={4.4} y1={10.4} x2={9.4} y2={10.4} {...STROKE} strokeWidth={1.2} />
    </>
  ),
  hex: (
    <>
      <Badge />
      <Letters text="0x" size={6.5} />
    </>
  ),
  base64: (
    <>
      <Badge />
      <Letters text="64" size={6.5} />
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
