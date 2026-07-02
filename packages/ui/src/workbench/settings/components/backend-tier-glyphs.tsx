/**
 * Presentational pieces for the backend tier card — the per-tier SVG
 * icon art, the connectivity-cloud glyph, and the footer's expandable
 * address-range tooltip body.
 */

import type React from 'react';
import {
  FILL_BLUE,
  FILL_PURPLE,
  STROKE_BLUE,
  STROKE_PURPLE,
  TEXT,
} from '../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../components/docs/diagrams/open-headers/_shared';
import type { FooterCategory, Icon } from './backend-tier-data';

export const FooterDetails: React.FC<{ categories: FooterCategory[] }> = ({ categories }) => (
  <div style={{ fontSize: 12, lineHeight: 1.55 }}>
    {categories.map((cat, ci) => (
      <div
        key={cat.label}
        style={{
          marginBottom: ci === categories.length - 1 ? 0 : 10,
          paddingBottom: ci === categories.length - 1 ? 0 : 8,
          borderBottom: ci === categories.length - 1 ? 'none' : '1px solid var(--ant-color-border-secondary)',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 10.5,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'var(--ant-color-primary)',
            marginBottom: 4,
          }}
        >
          {cat.label}
        </div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {cat.items.map((it) => (
            <li key={it.range} style={{ marginBottom: 2, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: 'var(--ant-color-primary)', flex: 'none' }}>•</span>
              <code
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11.5,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: 'var(--ant-color-fill-tertiary)',
                  color: 'var(--ant-color-text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.range}
              </code>
              {it.note && (
                <span style={{ color: 'var(--ant-color-text-secondary)', marginLeft: 6 }}>— {it.note}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

export const CloudGlyph: React.FC<{ cx: number; cy: number; scale?: number; label?: string }> = ({
  cx,
  cy,
  scale = 0.6,
  label,
}) => {
  const s = scale;
  const d = `
    M ${cx - 28 * s} ${cy + 6 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${4 * s} ${-18 * s}
    a ${12 * s} ${12 * s} 0 0 1 ${22 * s} ${-4 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${20 * s} ${4 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${4 * s} ${20 * s}
    h ${-50 * s}
    a ${8 * s} ${8 * s} 0 0 1 0 ${-2 * s}
    z
  `;
  return (
    <g>
      <path d={d} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeWidth={1} strokeDasharray="3 2" />
      {label && (
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
          {label}
        </text>
      )}
    </g>
  );
};

export const IconArt: React.FC<{ kind: Icon; cx: number; cy: number }> = ({ kind, cx, cy }) => {
  switch (kind) {
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
            stroke={STROKE_BLUE}
          />
          <rect x={cx - 22} y={cy - 14} width={44} height={7} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
          <circle cx={cx - 18} cy={cy - 10.5} r={1.2} fill={STROKE_BLUE} />
          <circle cx={cx - 14} cy={cy - 10.5} r={1.2} fill={STROKE_BLUE} />
          <circle cx={cx - 10} cy={cy - 10.5} r={1.2} fill={STROKE_BLUE} />
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
            stroke={STROKE_BLUE}
          />
          <rect x={cx - 19} y={cy - 13} width={38} height={20} fill={FILL_BLUE} stroke={STROKE_BLUE} />
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
          <rect x={cx - 4} y={cy + 10} width={8} height={4} fill={STROKE_BLUE} />
          <rect x={cx - 10} y={cy + 14} width={20} height={2} rx={1} fill={STROKE_BLUE} />
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
            stroke={STROKE_BLUE}
            strokeWidth={1.5}
          />
          <rect x={cx - 4} y={cy - 2} width={8} height={6} rx={1} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        </g>
      );
  }
};
