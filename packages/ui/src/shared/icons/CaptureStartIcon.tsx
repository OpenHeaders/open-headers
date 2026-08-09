/**
 * CaptureStartIcon — a filled dot inside viewfinder corner brackets:
 * the source is framed for capture, idle. Start form of the capture
 * pair (CaptureActiveIcon swaps the dot for the stop square), drawn on
 * the record pair's padded 20x20 grid so the two families hold the
 * same optical weight, and wrapped in antd's Icon so it inherits
 * `.anticon` sizing and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const CaptureStartSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none">
    <path
      d="M7 3H6a3 3 0 0 0-3 3v1M13 3h1a3 3 0 0 1 3 3v1M17 13v1a3 3 0 0 1-3 3h-1M3 13v1a3 3 0 0 0 3 3h1"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="10" cy="10" r="3.2" fill="currentColor" />
  </svg>
);

export const CaptureStartIcon: React.FC<GlyphIconProps> = (props) => <Icon component={CaptureStartSvg} {...props} />;
