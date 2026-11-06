/**
 * FetchIcon — the incoming arrow of `PullIcon` drawn entirely in dashes,
 * head included, with the corner dash anchoring the tip (the
 * reference's Fetch): what the remote has comes down, but nothing
 * lands on the branch yet. One path of dash subpaths, so a translucent
 * disabled tone paints it once. Drawn on a
 * 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const FetchSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.5 3.5 11.44 4.56M9.81 6.19 8.75 7.25M7.13 8.87 6.07 9.93M4.5 10v1.5h1.5M4.5 8V6.5M8 11.5h1.5" fill="none" />
  </svg>
);

export const FetchIcon: React.FC<GlyphIconProps> = (props) => <Icon component={FetchSvg} {...props} />;
