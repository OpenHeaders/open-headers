/**
 * FilesIcon — a page with its top corner folded. It stands for a list
 * drawn as the files on disk, by path (the changed-files trees' Files
 * view mode). Drawn on a 16x16 grid with 1.5px strokes and wrapped in
 * antd's Icon so it inherits `.anticon` sizing and currentColor like
 * every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const FilesSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.5 2.5h4L12 6v7.5H4.5zM8.5 2.5V6H12" fill="none" />
  </svg>
);

export const FilesIcon: React.FC<GlyphIconProps> = (props) => <Icon component={FilesSvg} {...props} />;
