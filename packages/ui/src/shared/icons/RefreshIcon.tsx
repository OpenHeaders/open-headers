/**
 * RefreshIcon — two arcs chasing each other clockwise, each ending in
 * a head squared to the axes like the transfer arrows (the reference's
 * Refresh): read the state again. Drawn on a 16x16 grid with 1.5px
 * strokes and wrapped in antd's Icon so it inherits `.anticon` sizing,
 * currentColor and `spin` like every stock icon. It stands in for
 * every refresh affordance on the git surfaces.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

export interface RefreshIconProps extends GlyphIconProps {
  spin?: boolean;
}

const RefreshSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M3.3 6.3A5 5 0 0 1 12.7 6.3M12.7 3.6v2.7H10M12.7 9.7A5 5 0 0 1 3.3 9.7M3.3 12.4V9.7H6"
      fill="none"
    />
  </svg>
);

export const RefreshIcon: React.FC<RefreshIconProps> = (props) => <Icon component={RefreshSvg} {...props} />;
