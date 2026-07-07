/**
 * VariablesIcon — braces around an x, echoing the `{{variable}}` template
 * syntax. Shared glyph for the Variables concept (tool-window tab,
 * empty-state action). Drawn on a 16x16 grid with 1.5px strokes and wrapped
 * in antd's Icon so it inherits `.anticon` sizing and currentColor like
 * every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const VariablesSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.4 2c-1.6 0-2.2.7-2.2 2.1v1.6c0 1-.5 1.7-1.6 2.3 1.1.6 1.6 1.3 1.6 2.3v1.6c0 1.4.6 2.1 2.2 2.1" />
    <path d="M10.6 2c1.6 0 2.2.7 2.2 2.1v1.6c0 1 .5 1.7 1.6 2.3-1.1.6-1.6 1.3-1.6 2.3v1.6c0 1.4-.6 2.1-2.2 2.1" />
    <path d="m6.8 6.6 2.4 2.8" />
    <path d="M9.2 6.6 6.8 9.4" />
  </svg>
);

export const VariablesIcon: React.FC<GlyphIconProps> = (props) => <Icon component={VariablesSvg} {...props} />;
