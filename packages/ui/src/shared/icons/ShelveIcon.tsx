/**
 * ShelveIcon — an arrow pointing down into an open tray (the
 * reference's Shelve): the changes are put away for later. Drawn on a
 * 16x16 grid with 1.5px strokes and wrapped in antd's Icon so it
 * inherits `.anticon` sizing and currentColor like every stock icon.
 * It stands in for every shelve affordance.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const ShelveSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 2.5v7.5M5 7l3 3 3-3M2.5 10.5v3h11v-3" fill="none" />
  </svg>
);

export const ShelveIcon: React.FC<GlyphIconProps> = (props) => <Icon component={ShelveSvg} {...props} />;
