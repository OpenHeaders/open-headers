/**
 * RecordStartIcon — a filled dot inside a ring, the browser devtools'
 * own "start recording" glyph. Drawn on the browser's 20x20 grid so the
 * proportions match the native Network-panel record button exactly, and
 * wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const RecordStartSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 16C13.3137 16 16 13.3137 16 10C16 6.68629 13.3137 4 10 4C6.68629 4 4 6.68629 4 10C4 13.3137 6.68629 16 10 16ZM10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z"
      fill="currentColor"
    />
    <circle cx="10" cy="10" r="4" fill="currentColor" />
  </svg>
);

export const RecordStartIcon: React.FC<GlyphIconProps> = (props) => <Icon component={RecordStartSvg} {...props} />;
