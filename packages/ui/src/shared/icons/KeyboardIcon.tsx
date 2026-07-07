/**
 * KeyboardIcon — a keyboard with key dots and a space bar, for keyboard
 * shortcut surfaces (stock KeyOutlined draws a door key, which reads as
 * credentials/vault). Drawn on a 16x16 grid with 1.5px strokes and wrapped
 * in antd's Icon so it inherits `.anticon` sizing and currentColor like
 * every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const KeyboardSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1.5" y="3.75" width="13" height="8.5" rx="1.5" />
    <path d="M4.25 6.5h.01" />
    <path d="M6.75 6.5h.01" />
    <path d="M9.25 6.5h.01" />
    <path d="M11.75 6.5h.01" />
    <path d="M4 9.75h.01" />
    <path d="M5.9 9.75h4.2" />
    <path d="M12 9.75h.01" />
  </svg>
);

export const KeyboardIcon: React.FC<GlyphIconProps> = (props) => <Icon component={KeyboardSvg} {...props} />;
