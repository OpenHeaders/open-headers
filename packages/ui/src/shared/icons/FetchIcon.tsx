/**
 * FetchIcon — the incoming arrow of `PullIcon` with its shaft drawn in
 * dashes under a solid head (the reference's Fetch): what the remote
 * has comes down, but nothing lands on the branch yet. Drawn on a
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
    <path d="M12.5 3.5 4.5 11.5" strokeDasharray="1.6 2.6" fill="none" />
    <path d="M4.5 6.5v5h5" fill="none" />
  </svg>
);

export const FetchIcon: React.FC<GlyphIconProps> = (props) => <Icon component={FetchSvg} {...props} />;
