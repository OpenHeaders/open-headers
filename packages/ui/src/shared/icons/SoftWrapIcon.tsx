/**
 * SoftWrapIcon — three text lines where the last one turns back under
 * the second with a return arrow (the reference's console Soft-Wrap
 * toggle): long lines fold at the pane's edge. Drawn on a 16x16 grid
 * with 1.5px strokes and wrapped in antd's Icon so it inherits
 * `.anticon` sizing and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const SoftWrapSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 4h11" fill="none" />
    <path d="M2.5 8h8.5a2 2 0 0 1 0 4H8" fill="none" />
    <path d="M9.5 10.5 8 12l1.5 1.5" fill="none" />
    <path d="M2.5 12h3" fill="none" />
  </svg>
);

export const SoftWrapIcon: React.FC<GlyphIconProps> = (props) => <Icon component={SoftWrapSvg} {...props} />;
