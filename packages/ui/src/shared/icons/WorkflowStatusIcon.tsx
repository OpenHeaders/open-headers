/**
 * WorkflowStatusIcon — the Workflows glyph (antd Sisternode: branch line
 * into a filled node circle) with an "s"-shaped cutout in place of the
 * "+", pairing the status tab with its authoring sibling. The "s" is
 * built from two tangent 60-radius arc hooks (230° sweep each, 60-unit
 * stroke, round caps) expressed as an evenodd hole subpath on the same
 * 1024 grid as the stock icon, so weight and sizing match exactly.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from './types';

const WorkflowStatusSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="64 64 896 896" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M672 432c-120.3 0-219.9 88.5-237.3 204H320c-15.5 0-28-12.5-28-28V244h291c14.2 35.2 48.7 60 89 60 53 0 96-43 96-96s-43-96-96-96c-40.3 0-74.8 24.8-89 60H112v72h108v364c0 55.2 44.8 100 100 100h114.7c17.4 115.5 117 204 237.3 204 132.5 0 240-107.5 240-240S804.5 432 672 432zm68.9 122.1A90 90 0 1 0 672 702a30 30 0 1 1-23 49.3 30 30 0 0 0-45.9 38.6A90 90 0 1 0 672 642a30 30 0 1 1 23-49.3 30 30 0 0 0 45.9-38.6z"
    />
  </svg>
);

export const WorkflowStatusIcon: React.FC<GlyphIconProps> = (props) => <Icon component={WorkflowStatusSvg} {...props} />;
