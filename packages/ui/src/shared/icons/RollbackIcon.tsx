/**
 * RollbackIcon — a left-pointing arrowhead whose shaft runs right and
 * hooks back under itself in a half-turn (the reference's Rollback):
 * the change goes back the way it came. Drawn on a 16x16 grid with
 * 1.5px strokes and wrapped in antd's Icon so it inherits `.anticon`
 * sizing and currentColor like every stock icon. It stands in for
 * every rollback, revert and reset affordance.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const RollbackSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.5 3 2.5 6l3 3M2.5 6H10a3.5 3.5 0 0 1 0 7H5.5" fill="none" />
  </svg>
);

export const RollbackIcon: React.FC<GlyphIconProps> = (props) => <Icon component={RollbackSvg} {...props} />;
