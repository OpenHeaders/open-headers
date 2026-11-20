/**
 * ActivityMonitorIcon — a pulse line: flat, one tall beat, a smaller
 * one, flat again. Drawn on a 16x16 grid with 1.5px strokes and wrapped
 * in antd's Icon so it inherits `.anticon` sizing and currentColor like
 * every stock icon. The feed beside it in the dock is a clock face;
 * this one is a trace.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from '@openheaders/ui/shared/icons';

const ActivityMonitorSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 8.5h2.6l1.7-5 2.8 9.5 1.9-6 1 1.5h3" fill="none" />
  </svg>
);

export const ActivityMonitorIcon: React.FC<GlyphIconProps> = (props) => (
  <Icon component={ActivityMonitorSvg} {...props} />
);
