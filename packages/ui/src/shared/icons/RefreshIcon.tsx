/**
 * RefreshIcon — two arcs chasing each other clockwise, each ending in
 * a head squared to the axes like the transfer arrows (the reference's
 * Refresh): read the state again. Drawn on a 16x16 grid with 1.5px
 * strokes and wrapped in antd's Icon so it inherits `.anticon` sizing,
 * currentColor and `spin` like every stock icon. It stands in for
 * every refresh affordance on the git surfaces.
 *
 * `spin` turns it while a read is out — in WHOLE turns
 * (`useWholeCycles`): a turn once begun is finished, so a read that
 * answers in a tenth of a second shows one full turn instead of a
 * twitch that snaps back to rest. ONE turn a second: the wrapper turns
 * its own box and hands the same class to the drawing — taken by
 * both, the glyph went round twice in the time of one turn — so the
 * drawing takes no class and the box alone turns.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import { useWholeCycles } from '../hooks/useWholeCycles';
import type { GlyphIconProps } from './types';

export interface RefreshIconProps extends GlyphIconProps {
  spin?: boolean;
}

const RefreshSvg: React.FC<React.SVGProps<SVGSVGElement>> = ({ className: _turnsWithTheBox, ...props }) => (
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

export const RefreshIcon: React.FC<RefreshIconProps> = ({ spin = false, ...rest }) => {
  const turn = useWholeCycles(spin);
  return <Icon component={RefreshSvg} {...rest} spin={turn.running} onAnimationIteration={turn.onAnimationIteration} />;
};
