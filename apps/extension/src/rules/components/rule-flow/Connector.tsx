/**
 * Connector — vertical line with optional label between flow nodes.
 * Terminus — start/end pill for the pipeline.
 */

import { CaretDownOutlined, PlayCircleFilled, StopFilled } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';

export const Connector: React.FC<{ label?: string }> = ({ label }) => {
  const { token } = theme.useToken();
  const lineColor = token.colorBorderSecondary;
  const labelColor = token.colorTextQuaternary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      <div style={{ width: 1.5, height: 12, background: lineColor }} />
      {label && (
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: labelColor,
            padding: '1px 8px',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: 3,
            background: token.colorBgContainer,
          }}
        >
          {label}
        </span>
      )}
      <div style={{ width: 1.5, height: 12, background: lineColor }} />
      <CaretDownOutlined style={{ fontSize: 8, color: lineColor, marginTop: -4 }} />
    </div>
  );
};

export const Terminus: React.FC<{ type: 'start' | 'end' }> = ({ type }) => {
  const { token } = theme.useToken();
  const isStart = type === 'start';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 16px',
        borderRadius: 14,
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: 'uppercase',
        userSelect: 'none',
        background: isStart ? token.colorSuccessBg : token.colorErrorBg,
        border: `1px solid ${isStart ? token.colorSuccessBorder : token.colorErrorBorder}`,
        color: isStart ? token.colorSuccess : token.colorError,
      }}
    >
      {isStart ? <PlayCircleFilled style={{ fontSize: 10 }} /> : <StopFilled style={{ fontSize: 9 }} />}
      {isStart ? 'Request Intercepted' : 'Done'}
    </div>
  );
};
