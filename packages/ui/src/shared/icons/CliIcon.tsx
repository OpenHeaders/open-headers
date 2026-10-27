/**
 * CliIcon — the `oh` command line as a terminal window, the docs
 * front-end chooser's CLI mark at glyph size: a black window under a
 * primary-tinted title bar with the three traffic lights, a green
 * prompt chevron and cursor inside. The window stays black on both
 * themes — it is the mark's identity, not a theme surface — while the
 * bar and border follow the primary tokens as the diagram's do. Drawn
 * on a 16x16 grid and wrapped in antd's Icon so it sizes like every
 * stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const CliSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="none">
    <rect x={1} y={2} width={14} height={12} rx={2} fill="#141414" stroke="var(--ant-color-primary-border)" />
    <path d="M1 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1H1z" fill="var(--ant-color-primary-bg)" />
    <circle cx={3.2} cy={3.5} r={0.65} fill="#ff5f57" />
    <circle cx={5} cy={3.5} r={0.65} fill="#febc2e" />
    <circle cx={6.8} cy={3.5} r={0.65} fill="#28c840" />
    <path d="M4 7.5 6.2 9.3 4 11.1" stroke="#52c41a" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.6 11.1h2.6" stroke="#52c41a" strokeWidth={1.3} strokeLinecap="round" />
  </svg>
);

export const CliIcon: React.FC<GlyphIconProps> = (props) => <Icon component={CliSvg} {...props} />;
