/**
 * ShortenPathsIcon — two path separators with an ellipsis between
 * them (`/…/`): the middle of a long path folded away while its head
 * and tail stay (the console's Shorten Paths toggle). Drawn on a
 * 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const ShortenPathsSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12 4.5 4" fill="none" />
    <path d="M6.25 8h.01M8 8h.01M9.75 8h.01" fill="none" strokeWidth={1.25} />
    <path d="M11.5 12 14 4" fill="none" />
  </svg>
);

export const ShortenPathsIcon: React.FC<GlyphIconProps> = (props) => <Icon component={ShortenPathsSvg} {...props} />;
