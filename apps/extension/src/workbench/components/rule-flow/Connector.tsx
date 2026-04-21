/**
 * Connector — vertical line with optional label between flow nodes.
 * Terminus — start/end pill for the pipeline.
 */

import { PlayCircleFilled, StopFilled } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';

interface ConnectorProps {
  label?: string;
  compact?: boolean;
}

export const Connector: React.FC<ConnectorProps> = ({ label, compact }) => {
  const { token } = theme.useToken();
  const labelColor = token.colorTextQuaternary;
  const hasLabel = !!label && !compact;
  const h = compact ? 20 : 40;

  const lineStyle = { height: hasLabel ? h / 2 : h, '--flow-line-color': token.colorBorder } as React.CSSProperties;

  return (
    <div className="flow-connector" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {hasLabel ? (
        <>
          <div className="flow-dashed-line" style={lineStyle} />
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
          <div className="flow-dashed-line" style={lineStyle} />
        </>
      ) : (
        <div className="flow-dashed-line" style={lineStyle} />
      )}
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
