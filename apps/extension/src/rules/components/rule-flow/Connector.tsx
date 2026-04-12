/**
 * Connector — vertical line with optional label between flow nodes.
 * Terminus — start/end pill for the pipeline.
 */

import { CaretDownOutlined, PlayCircleFilled, StopFilled } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';

interface ConnectorProps {
  label?: string;
  compact?: boolean;
}

export const Connector: React.FC<ConnectorProps> = ({ label, compact }) => {
  const { token } = theme.useToken();
  const lineColor = token.colorBorderSecondary;
  const labelColor = token.colorTextQuaternary;
  const h = compact ? 4 : 12;

  return (
    <div className="flow-connector" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 1.5, height: h, background: lineColor }} />
      {label && !compact && (
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
      <div style={{ width: 1.5, height: h, background: lineColor }} />
      {!compact && <CaretDownOutlined style={{ fontSize: 8, color: lineColor, marginTop: -4 }} />}
    </div>
  );
};

interface TerminusProps {
  type: 'start' | 'end';
  compact?: boolean;
}

export const Terminus: React.FC<TerminusProps> = ({ type, compact }) => {
  const { token } = theme.useToken();
  const isStart = type === 'start';

  return (
    <div
      className={`flow-terminus flow-terminus-${type}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        padding: compact ? '2px 10px' : '5px 16px',
        borderRadius: 14,
        fontFamily: 'monospace',
        fontSize: compact ? 8 : 10,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: 'uppercase',
        userSelect: 'none',
        background: isStart ? token.colorSuccessBg : token.colorErrorBg,
        border: `1px solid ${isStart ? token.colorSuccessBorder : token.colorErrorBorder}`,
        color: isStart ? token.colorSuccess : token.colorError,
      }}
    >
      {isStart ? (
        <PlayCircleFilled style={{ fontSize: compact ? 8 : 10 }} />
      ) : (
        <StopFilled style={{ fontSize: compact ? 7 : 9 }} />
      )}
      {isStart ? 'Request Intercepted' : 'Done'}
    </div>
  );
};
