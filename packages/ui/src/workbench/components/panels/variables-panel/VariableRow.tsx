/**
 * In-context variable card — the row used by the "In Rule / Request /
 * Template" view. Renders `{{name}}` over its resolved value (or a live
 * TOTP preview / "unresolved" / "needs re-run" state) plus the owning
 * scope tag. Clicking the card opens that scope's editor when an opener
 * is wired; the reveal-eye stops propagation so it doesn't trigger it.
 */

import { EyeInvisibleOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons';
import { Tag, Tooltip, Typography, theme } from 'antd';
import { useState } from 'react';
import TotpPreview from '../../totp/TotpPreview';
import { SCOPE_CONFIG, type DisplayVariable } from './types';

const { Text } = Typography;

interface VariableRowProps {
  variable: DisplayVariable;
  /** When non-null, the row is clickable — clicking opens the variable's
   *  owning-scope editor (Inspector → editor handoff). Null hides it. */
  onOpenEditor?: (() => void) | null;
}

export function VariableRow({ variable, onOpenEditor }: VariableRowProps) {
  const { token } = theme.useToken();
  const [revealed, setRevealed] = useState(false);
  const scopeConfig = SCOPE_CONFIG[variable.scope];
  const displayValue = variable.isSensitive && !revealed ? '••••••••' : variable.value;

  const clickable = onOpenEditor != null;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpenEditor : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter') onOpenEditor?.();
            }
          : undefined
      }
      title={clickable ? `Open the ${scopeConfig.label.toLowerCase()} editor` : undefined}
      style={{
        border: `0.5px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        padding: '6px 8px',
        marginBottom: 5,
        cursor: clickable ? 'pointer' : undefined,
      }}
    >
      <div
        style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 11,
          color: variable.resolved ? token.colorPrimary : token.colorWarning,
        }}
      >
        {`{{${variable.name}}}`}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {variable.totp ? (
            <TotpPreview
              seed={variable.totp.seed}
              algorithm={variable.totp.algorithm}
              digits={variable.totp.digits}
              period={variable.totp.period}
              density="compact"
            />
          ) : variable.resolved ? (
            <>
              <Text
                style={{
                  fontSize: 10,
                  color: variable.isSensitive ? token.colorTextTertiary : token.colorTextSecondary,
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayValue}
              </Text>
              {variable.isSensitive && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealed((r) => !r);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      setRevealed((r) => !r);
                    }
                  }}
                  style={{ cursor: 'pointer', fontSize: 10, color: token.colorTextTertiary }}
                >
                  {revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </span>
              )}
            </>
          ) : (
            <Text style={{ fontSize: 10, color: token.colorError }}>unresolved</Text>
          )}
          {variable.definitionallyStale && (
            <Tooltip title="The backing workflow's definition changed since this value was captured — re-run it to refresh.">
              <Tag color="error" style={{ fontSize: 9, margin: 0 }}>
                needs re-run
              </Tag>
            </Tooltip>
          )}
        </div>
        <Tag color={scopeConfig.color} style={{ fontSize: 9, marginRight: 0 }}>
          {scopeConfig.label}
          {variable.scope === 'vault' && <LockOutlined style={{ fontSize: 9, marginLeft: 4 }} />}
        </Tag>
      </div>
    </div>
  );
}
