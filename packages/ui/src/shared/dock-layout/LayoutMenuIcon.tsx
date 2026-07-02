import { theme } from 'antd';
import type React from 'react';

export type LayoutMenuIconKind =
  | 'bottom-full'
  | 'bottom-nested'
  | 'bottom-left'
  | 'bottom-right'
  | 'show-labels'
  | 'hide-labels'
  | 'restore-hidden'
  | 'split-right'
  | 'split-left'
  | 'split-down'
  | 'split-up'
  | 'split-horizontal'
  | 'split-vertical'
  | 'unsplit-horizontal'
  | 'unsplit-vertical'
  | 'unsplit-all'
  | 'close-tabs-left'
  | 'close-tabs-right'
  | 'close-tabs-other'
  | 'header-top'
  | 'header-bottom';

interface LayoutMenuIconProps {
  kind: LayoutMenuIconKind;
  size?: number;
}

const LayoutMenuIcon: React.FC<LayoutMenuIconProps> = ({ kind, size = 16 }) => {
  const { token } = theme.useToken();
  const stroke = token.colorTextTertiary;
  const fill = token.colorTextSecondary;
  const height = Math.round((size * 13) / 16);

  const frame = <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />;

  let content: React.ReactNode;

  if (kind === 'bottom-full') {
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={8.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
        <rect
          x={0.5}
          y={8.5}
          width={15}
          height={4}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={0.5} y1={8.5} x2={15.5} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'bottom-nested') {
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={12.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={12.5} stroke={stroke} strokeWidth={1} />
        <rect x={5} y={8.5} width={6} height={4} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.15} />
        <line x1={5} y1={8.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'bottom-left') {
    // Bottom spans [left sidebar + editor]; right sidebar full height.
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={8.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={12.5} stroke={stroke} strokeWidth={1} />
        <rect
          x={0.5}
          y={8.5}
          width={10.5}
          height={4}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={0.5} y1={8.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'bottom-right') {
    // Bottom spans [editor + right sidebar]; left sidebar full height.
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={12.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
        <rect
          x={5}
          y={8.5}
          width={10.5}
          height={4}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={5} y1={8.5} x2={15.5} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'show-labels') {
    content = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={5.5}
          height={12}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={6} y1={0.5} x2={6} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'hide-labels') {
    content = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={3}
          height={12}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={3.5} y1={0.5} x2={3.5} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'split-right') {
    content = (
      <>
        <rect
          x={8}
          y={0.5}
          width={7.5}
          height={12}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.35}
        />
        <line x1={8} y1={0.5} x2={8} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'split-left') {
    content = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={7.5}
          height={12}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.35}
        />
        <line x1={8} y1={0.5} x2={8} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'split-down') {
    content = (
      <>
        <rect
          x={0.5}
          y={6.5}
          width={15}
          height={6}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.35}
        />
        <line x1={0.5} y1={6.5} x2={15.5} y2={6.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'split-up') {
    content = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={15}
          height={6}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.35}
        />
        <line x1={0.5} y1={6.5} x2={15.5} y2={6.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'split-horizontal') {
    content = (
      <rect x={7} y={0.5} width={2} height={12} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.35} />
    );
  } else if (kind === 'split-vertical') {
    content = (
      <rect x={0.5} y={5.5} width={15} height={2} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.35} />
    );
  } else if (kind === 'unsplit-horizontal') {
    content = (
      <>
        <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill={fill} stroke="none" fillOpacity={0.15} />
        <line x1={8} y1={1.5} x2={8} y2={11.5} stroke={stroke} strokeWidth={1} strokeDasharray="1.2 1.2" />
      </>
    );
  } else if (kind === 'unsplit-vertical') {
    content = (
      <>
        <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill={fill} stroke="none" fillOpacity={0.15} />
        <line x1={1.5} y1={6.5} x2={14.5} y2={6.5} stroke={stroke} strokeWidth={1} strokeDasharray="1.2 1.2" />
      </>
    );
  } else if (kind === 'unsplit-all') {
    content = (
      <>
        <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill={fill} stroke="none" fillOpacity={0.15} />
        <line
          x1={8}
          y1={1.5}
          x2={8}
          y2={11.5}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="1.2 1.2"
          strokeDashoffset={1.2}
        />
        <line x1={1.5} y1={6.5} x2={14.5} y2={6.5} stroke={stroke} strokeWidth={1} strokeDasharray="1.2 1.2" />
      </>
    );
  } else if (kind === 'close-tabs-left' || kind === 'close-tabs-right' || kind === 'close-tabs-other') {
    const keptIndex = kind === 'close-tabs-right' ? 0 : kind === 'close-tabs-left' ? 2 : 1;
    const cellX = [0.5, 5.5, 10.5];
    content = (
      <>
        {[0, 1, 2].map((i) =>
          i === keptIndex ? null : (
            <rect
              key={`cell-${i}`}
              x={cellX[i]}
              y={0.5}
              width={5}
              height={4}
              fill={fill}
              stroke="none"
              fillOpacity={0.35}
            />
          ),
        )}
        <line x1={0.5} y1={4.5} x2={15.5} y2={4.5} stroke={stroke} strokeWidth={1} />
        <line x1={5.5} y1={0.5} x2={5.5} y2={4.5} stroke={stroke} strokeWidth={1} />
        <line x1={10.5} y1={0.5} x2={10.5} y2={4.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'header-top' || kind === 'header-bottom') {
    // Editor-header dock position: one clean shaded band — the header
    // row — at the frame's top or bottom edge. Same geometry as the
    // close-tabs tab-strip glyphs minus the cell dividers, since this
    // row is a single header, not a strip of tabs.
    const bandY = kind === 'header-top' ? 0.5 : 8.5;
    const lineY = kind === 'header-top' ? 4.5 : 8.5;
    content = (
      <>
        <rect x={0.5} y={bandY} width={15} height={4} fill={fill} stroke="none" fillOpacity={0.35} />
        <line x1={0.5} y1={lineY} x2={15.5} y2={lineY} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else {
    content = (
      <rect
        x={5}
        y={3}
        width={6}
        height={7}
        rx={1}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="1.2 1.2"
      />
    );
  }

  return (
    <svg viewBox="0 0 16 13" width={size} height={height} role="img" aria-hidden="true" style={{ display: 'block' }}>
      {frame}
      {content}
    </svg>
  );
};

export default LayoutMenuIcon;
