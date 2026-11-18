/**
 * WorkspaceIcon — a nested list: one bulleted row with two more
 * stepped in under it, the way a panel lists a collection over its
 * items. It stands for a list drawn by what things are called in the
 * workbench (the changed-files trees' Workspace view mode).
 * Drawn on a 16x16 grid with 1.5px strokes and wrapped in antd's Icon
 * so it inherits `.anticon` sizing and currentColor like every stock
 * icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const WorkspaceSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 4h.01M5.5 4h8M5 8h.01M8 8h5.5M5 12h.01M8 12h5.5" fill="none" />
  </svg>
);

export const WorkspaceIcon: React.FC<GlyphIconProps> = (props) => <Icon component={WorkspaceSvg} {...props} />;
