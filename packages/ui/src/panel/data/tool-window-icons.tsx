/**
 * Custom SVG glyphs for DevTools panel tool-window tabs whose concepts have
 * no faithful stock icon. Each glyph is drawn on a 16x16 grid with 1.5px
 * strokes and wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock tab icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';

type SvgProps = React.SVGProps<SVGSVGElement>;

/** Terminal prompt `>_` — the console. */
const ConsoleSvg: React.FC<SvgProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3 4.5 4.5 3.5L3 11.5" />
    <path d="M9.5 12h4" />
  </svg>
);

export const ConsoleIcon: React.FC = () => <Icon component={ConsoleSvg} />;
