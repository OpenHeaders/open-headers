import { theme } from 'antd';
import type React from 'react';

export type LayoutMenuIconKind = 'bottom-full' | 'bottom-nested' | 'show-labels' | 'hide-labels' | 'restore-hidden';

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
