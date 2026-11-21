/**
 * ApiRequestsIcon — the API Requests mark: the same solid rounded tile as
 * `RequestRulesIcon` with "api" knocked out of it. The letters are filled
 * outlines (Nunito ExtraBold) with a little of the tile left at the sides,
 * so they render identically on every OS. Shared glyph for the API Requests concept
 * (tool-window tab, settings category, empty-state action, command
 * palette). Wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import { useId } from 'react';
import type { GlyphIconProps } from './types';

const API_LETTERS =
  'M3.76 10.46Q3.29 10.46 2.92 10.27Q2.54 10.09 2.33 9.78Q2.12 9.47 2.12 9.07Q2.12 8.6 2.37 8.33Q2.61 8.06 3.16 7.94Q3.71 7.82 4.61 7.82H5.07V8.5H4.62Q4.18 8.5 3.9 8.55Q3.63 8.6 3.51 8.71Q3.39 8.82 3.39 9.02Q3.39 9.27 3.56 9.42Q3.73 9.58 4.06 9.58Q4.31 9.58 4.5 9.46Q4.7 9.34 4.81 9.14Q4.93 8.93 4.93 8.67V7.67Q4.93 7.29 4.75 7.13Q4.58 6.97 4.16 6.97Q3.93 6.97 3.65 7.03Q3.38 7.08 3.05 7.21Q2.86 7.3 2.71 7.25Q2.56 7.2 2.48 7.08Q2.4 6.95 2.4 6.8Q2.4 6.65 2.49 6.5Q2.58 6.36 2.78 6.29Q3.19 6.13 3.55 6.06Q3.91 6 4.21 6Q4.88 6 5.31 6.2Q5.74 6.4 5.96 6.8Q6.18 7.2 6.18 7.84V9.77Q6.18 10.09 6.02 10.27Q5.86 10.44 5.57 10.44Q5.27 10.44 5.11 10.27Q4.95 10.09 4.95 9.77V9.45L5.01 9.5Q4.96 9.8 4.79 10.01Q4.62 10.22 4.36 10.34Q4.1 10.46 3.76 10.46Z' +
  'M7.82 12.01Q7.5 12.01 7.33 11.84Q7.16 11.67 7.16 11.34V6.68Q7.16 6.36 7.33 6.19Q7.5 6.02 7.8 6.02Q8.13 6.02 8.29 6.19Q8.46 6.36 8.46 6.68V7.27L8.36 6.93Q8.49 6.52 8.89 6.26Q9.28 6 9.8 6Q10.35 6 10.77 6.27Q11.2 6.54 11.43 7.04Q11.67 7.53 11.67 8.22Q11.67 8.91 11.43 9.41Q11.2 9.92 10.78 10.19Q10.36 10.46 9.8 10.46Q9.29 10.46 8.9 10.21Q8.51 9.96 8.37 9.56H8.47V11.34Q8.47 11.67 8.3 11.84Q8.13 12.01 7.82 12.01ZM9.4 9.47Q9.68 9.47 9.9 9.34Q10.11 9.2 10.23 8.92Q10.34 8.65 10.34 8.22Q10.34 7.59 10.08 7.29Q9.82 6.99 9.4 6.99Q9.13 6.99 8.91 7.12Q8.7 7.25 8.58 7.52Q8.46 7.8 8.46 8.22Q8.46 8.86 8.72 9.17Q8.98 9.47 9.4 9.47Z' +
  'M13.13 10.43Q12.81 10.43 12.64 10.24Q12.47 10.06 12.47 9.72V6.74Q12.47 6.4 12.64 6.21Q12.81 6.02 13.13 6.02Q13.44 6.02 13.61 6.21Q13.78 6.4 13.78 6.74V9.72Q13.78 10.06 13.61 10.24Q13.45 10.43 13.13 10.43ZM13.13 5.31Q12.76 5.31 12.57 5.14Q12.37 4.97 12.37 4.66Q12.37 4.33 12.57 4.16Q12.76 3.99 13.13 3.99Q13.49 3.99 13.68 4.16Q13.88 4.33 13.88 4.66Q13.88 4.97 13.68 5.14Q13.49 5.31 13.13 5.31Z';

const ApiRequestsSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  const maskId = useId();
  return (
    <svg {...props} viewBox="1.25 1.25 13.5 13.5" fill="none">
      <mask id={maskId}>
        <rect width="16" height="16" fill="#fff" />
        <path d={API_LETTERS} fill="#000" />
      </mask>
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="3" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
};

export const ApiRequestsIcon: React.FC<GlyphIconProps> = (props) => <Icon component={ApiRequestsSvg} {...props} />;
