/**
 * Mode summary + In/All toggle. The toggle only renders when the focused
 * tab has a context to filter to (`contextLabel` non-null); otherwise the
 * bar is just the "All scopes" label.
 */

import { Typography, theme } from 'antd';
import type { PanelMode } from './use-variables-panel';
import type { ScopeKind } from './types';

const { Text } = Typography;

interface ModeBarProps {
  mode: PanelMode;
  setMode: (mode: PanelMode) => void;
  scopeKind: ScopeKind;
  contextLabel: string | null;
  contextEntityName: string | null;
}

export function ModeBar({ mode, setMode, scopeKind, contextLabel, contextEntityName }: ModeBarProps) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {mode === 'in-context' && contextEntityName && scopeKind !== 'none' ? (
          <>
            {scopeKind === 'rule' ? 'In rule: ' : scopeKind === 'request' ? 'In request: ' : 'In template: '}
            <Text strong style={{ fontSize: 11 }}>
              {contextEntityName}
            </Text>
          </>
        ) : (
          'All scopes'
        )}
      </Text>
      {contextLabel && (
        <div style={{ display: 'flex', fontSize: 10 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={() => setMode('in-context')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setMode('in-context');
            }}
            style={{
              padding: '2px 6px',
              cursor: 'pointer',
              borderRadius: '3px 0 0 3px',
              ...(mode === 'in-context'
                ? { background: token.colorPrimary, color: token.colorBgContainer }
                : {
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRight: 0,
                    color: token.colorTextSecondary,
                  }),
            }}
          >
            {contextLabel}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={() => setMode('all')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setMode('all');
            }}
            style={{
              padding: '2px 6px',
              cursor: 'pointer',
              borderRadius: '0 3px 3px 0',
              ...(mode === 'all'
                ? { background: token.colorPrimary, color: token.colorBgContainer }
                : { border: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextSecondary }),
            }}
          >
            All
          </span>
        </div>
      )}
    </div>
  );
}
