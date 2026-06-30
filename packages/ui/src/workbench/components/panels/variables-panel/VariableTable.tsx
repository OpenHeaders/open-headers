/**
 * Shared read-only Variable | Value table used by both Scope-panel
 * views. The "All scopes" view renders one table per scope (the scope is
 * already named in the section header, so no glyph column); the
 * "In context" view renders a single mixed-scope table and turns on the
 * leading scope-glyph column so each row shows which scope it resolved
 * from. Sensitive values mask to bullets with a hover/focus reveal;
 * TOTP rows mount a live preview.
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Tooltip, Typography, theme } from 'antd';
import { type CSSProperties, useState } from 'react';
import { scopeBadge, unknownScopeBadge } from '../../shared/scope-colors';
import TotpPreview from '../../totp/TotpPreview';
import { SCOPE_CONFIG, type DisplayVariable } from './types';

const { Text } = Typography;

/** How the value cell renders a row whose value is absent:
 *  - `empty`      → muted "(empty)" — an existing-but-blank scope entry.
 *  - `unresolved` → error-colored "unresolved" — an in-context reference
 *    that no scope provided a value for. */
type EmptyMode = 'empty' | 'unresolved';

interface VariableTableProps {
  variables: DisplayVariable[];
  /** Prepend a leading column with the variable's resolved-scope glyph
   *  (V/E/C/W/↻); unresolved rows show a muted "?" instead. */
  showScopeGlyph?: boolean;
  emptyMode?: EmptyMode;
  /** Per-row opener. Returning a callback makes the row clickable
   *  (Inspector → editor handoff); null leaves it static. */
  onRowClick?: (variable: DisplayVariable) => (() => void) | null;
}

export function VariableTable({ variables, showScopeGlyph = false, emptyMode = 'empty', onRowClick }: VariableTableProps) {
  const { token } = theme.useToken();
  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, overflow: 'hidden' }}>
      {variables.map((v, i) => (
        <VariableTableRow
          key={`${v.scope}-${v.name}`}
          variable={v}
          showScopeGlyph={showScopeGlyph}
          emptyMode={emptyMode}
          isLast={i === variables.length - 1}
          onClick={onRowClick?.(v) ?? null}
        />
      ))}
    </div>
  );
}

interface VariableTableRowProps {
  variable: DisplayVariable;
  showScopeGlyph: boolean;
  emptyMode: EmptyMode;
  isLast: boolean;
  onClick: (() => void) | null;
}

function VariableTableRow({ variable, showScopeGlyph, emptyMode, isLast, onClick }: VariableTableRowProps) {
  const { token } = theme.useToken();
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const border = `1px solid ${token.colorBorderSecondary}`;
  const cellStyle: CSSProperties = { display: 'flex', alignItems: 'center', padding: '4px 8px', minWidth: 0 };
  const textStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
  const showValue = !variable.isSensitive || revealed;
  const clickable = onClick != null;
  const unresolved = !variable.resolved && emptyMode === 'unresolved';

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter') onClick();
            }
          : undefined
      }
      title={
        clickable
          ? variable.resolved
            ? `Open the ${SCOPE_CONFIG[variable.scope].label.toLowerCase()} editor`
            : 'Open editor'
          : undefined
      }
      style={{
        display: 'grid',
        gridTemplateColumns: showScopeGlyph ? 'auto 1fr 1fr' : '1fr 1fr',
        borderBottom: isLast ? undefined : border,
        alignItems: 'stretch',
        cursor: clickable ? 'pointer' : undefined,
      }}
    >
      {showScopeGlyph && (
        <div style={{ ...cellStyle, justifyContent: 'center', borderRight: border }}>
          {variable.resolved ? scopeBadge(variable.scope, 16) : unknownScopeBadge(16)}
        </div>
      )}
      <div style={cellStyle}>
        <span style={{ ...textStyle, color: token.colorText }} title={variable.name}>
          {variable.name}
        </span>
      </div>
      <div
        style={{ ...cellStyle, gap: 4, borderLeft: border }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {variable.totp ? (
          <TotpPreview
            seed={variable.totp.seed}
            algorithm={variable.totp.algorithm}
            digits={variable.totp.digits}
            period={variable.totp.period}
            density="compact"
          />
        ) : unresolved ? (
          <Text style={{ ...textStyle, color: token.colorError }}>unresolved</Text>
        ) : (
          <>
            <Text type="secondary" style={textStyle} title={showValue ? variable.value || undefined : undefined}>
              {showValue ? variable.value || '(empty)' : '••••••••'}
            </Text>
            {variable.isSensitive && (
              // Eye reveals on hover — peripheral read surface, so the
              // affordance stays out of the way until the row is hovered
              // (or the control is focused for keyboard users).
              <Tooltip title={revealed ? 'Hide value' : 'Show value'}>
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
                  onFocus={() => setHovered(true)}
                  onBlur={() => setHovered(false)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 11,
                    color: token.colorTextTertiary,
                    flexShrink: 0,
                    opacity: hovered || revealed ? 1 : 0,
                    transition: 'opacity 0.12s',
                  }}
                >
                  {revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </span>
              </Tooltip>
            )}
          </>
        )}
      </div>
    </div>
  );
}
