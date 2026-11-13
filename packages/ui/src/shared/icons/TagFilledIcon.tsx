/**
 * TagFilledIcon — `TagIcon`'s label drawn solid, its eyelet left open
 * (the reference's glyph for the checked-out branch while it is a
 * favorite): the same outline on the same 16x16 grid, filled with
 * currentColor through an even-odd rule so the eyelet reads as a hole.
 * Wrapped in antd's Icon so it sizes and colours like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const TagFilledSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="currentColor"
    fillRule="evenodd"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.75 2.75h5.5l5 5-5.5 5.5-5-5zM7.35 5.75a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0" />
  </svg>
);

export const TagFilledIcon: React.FC<GlyphIconProps> = (props) => <Icon component={TagFilledSvg} {...props} />;
