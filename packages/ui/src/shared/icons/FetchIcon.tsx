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
    <path d="M12.5 3.5 11.37 4.63M9.53 6.47 8.4 7.6M6.56 9.44 5.43 10.57M4.5 6.5v5h5" fill="none" />
  </svg>
);

export const FetchIcon: React.FC<GlyphIconProps> = (props) => <Icon component={FetchSvg} {...props} />;
