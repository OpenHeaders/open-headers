/**
 * ApiRequestsIcon — paper plane, send a request. Shared glyph for the API
 * Requests concept (tool-window tab, settings category, empty-state action,
 * command palette). Drawn on a 16x16 grid with 1.5px strokes and wrapped in
 * antd's Icon so it inherits `.anticon` sizing and currentColor like every
 * stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const ApiRequestsSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 1.5 1.5 6.8l5.2 2.1 2 5.1z" />
    <path d="M6.7 8.9 14.5 1.5" />
  </svg>
);

export const ApiRequestsIcon: React.FC<GlyphIconProps> = (props) => <Icon component={ApiRequestsSvg} {...props} />;
