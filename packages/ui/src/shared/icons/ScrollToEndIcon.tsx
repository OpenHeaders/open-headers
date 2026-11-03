/**
 * ScrollToEndIcon — two short lines over a down arrow that lands on a
 * baseline (the reference's console Scroll to End): jump the view to
 * the tail once. Drawn on a 16x16 grid with 1.5px strokes and wrapped
 * in antd's Icon so it inherits `.anticon` sizing and currentColor
 * like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const ScrollToEndSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 3.5h6" fill="none" />
    <path d="M2.5 7h4" fill="none" />
    <path d="M11 3v7.5" fill="none" />
    <path d="M8.5 8 11 10.5 13.5 8" fill="none" />
    <path d="M2.5 13.5h11" fill="none" />
  </svg>
);

export const ScrollToEndIcon: React.FC<GlyphIconProps> = (props) => <Icon component={ScrollToEndSvg} {...props} />;
