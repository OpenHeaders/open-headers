/**
 * CaptureActiveIcon — a filled square inside viewfinder corner
 * brackets: capture is running and a click stops it. Active/stop form
 * of the capture pair (see CaptureStartIcon), drawn on the record
 * pair's padded 20x20 grid so the two families hold the same optical
 * weight, and wrapped in antd's Icon so it inherits `.anticon` sizing
 * and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const CaptureActiveSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none">
    <path
      d="M7 3H6a3 3 0 0 0-3 3v1M13 3h1a3 3 0 0 1 3 3v1M17 13v1a3 3 0 0 1-3 3h-1M3 13v1a3 3 0 0 0 3 3h1"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <rect x="6.8" y="6.8" width="6.4" height="6.4" rx="1.2" fill="currentColor" />
  </svg>
);

export const CaptureActiveIcon: React.FC<GlyphIconProps> = (props) => <Icon component={CaptureActiveSvg} {...props} />;
