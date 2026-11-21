/**
 * RequestRulesIcon — the Browser Interceptor's mark: a solid rounded
 * square with "Bi" knocked out of it. The letters are 1.5px strokes in a
 * mask, so the icon works on any background in both themes. The viewBox
 * crops to the tile, so the tile fills the whole icon box like the
 * outline icons beside it (`ApiRequestsIcon` is the same tile). Shared by
 * every surface that names the interceptor or its rules (tool window,
 * Matched Rules tab, create menus, empty states). Wrapped in antd's Icon
 * so it inherits `.anticon` sizing and currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import { useId } from 'react';
import type { GlyphIconProps } from './types';

const RequestRulesSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  const maskId = useId();
  return (
    <svg {...props} viewBox="1.25 1.25 13.5 13.5" fill="none">
      <mask id={maskId}>
        <rect width="16" height="16" fill="#fff" />
        <path
          d="M4.4 4.25v7.5M4.4 4.25h2.35a1.75 1.75 0 0 1 0 3.5H4.4M4.4 7.75h2.7a2 2 0 0 1 0 4H4.4M11.7 7.75v4M11.7 5v.01"
          stroke="#000"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="3" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
};

export const RequestRulesIcon: React.FC<GlyphIconProps> = (props) => <Icon component={RequestRulesSvg} {...props} />;
