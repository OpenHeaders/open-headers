/**
 * Shared read-only Variable | Value table used by both Scope-panel
 * views. The "All scopes" view renders one table per scope (the scope is
 * already named in the section header, so no glyph column); the
 * "In context" view renders a single mixed-scope table and turns on the
 * leading scope-glyph column so each row shows which scope it resolved
 * from. Sensitive values mask to bullets with a hover/focus reveal;
 * TOTP rows mount a live preview. Rows are static — the value is
 * selectable, and a hover copy button lifts it to the clipboard (the
 * real value, even while masked).
 */

import { CheckOutlined, CopyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Tooltip, Typography, theme } from 'antd';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { scopeBadge, unknownScopeBadge } from '../../shared/scope-colors';
import TotpPreview from '../../totp/TotpPreview';
import { type DisplayVariable } from './types';

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
}

export function VariableTable({ variables, showScopeGlyph = false, emptyMode = 'empty' }: VariableTableProps) {
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
}

function VariableTableRow({ variable, showScopeGlyph, emptyMode, isLast }: VariableTableRowProps) {
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
  const unresolved = !variable.resolved && emptyMode === 'unresolved';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showScopeGlyph ? 'auto 1fr 1fr' : '1fr 1fr',
        borderBottom: isLast ? undefined : border,
        alignItems: 'stretch',
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
            {variable.value !== '' && (
              // Copies the real value even while masked — a secret can be
              // lifted without exposing it on screen.
              <CopyButton value={variable.value} visible={hovered} onHoverChange={setHovered} />
            )}
            {variable.isSensitive && (
              // Eye reveals on hover — peripheral read surface, so the
              // affordance stays out of the way until the row is hovered
              // (or the control is focused for keyboard users).
              <Tooltip title={revealed ? 'Hide value' : 'Show value'}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setRevealed((r) => !r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setRevealed((r) => !r);
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

/** Hover-revealed clipboard button for a row's value. Copies `value`
 *  verbatim (the resolved secret, not the masked bullets) and flips to a
 *  check for a beat on success. */
function CopyButton({
  value,
  visible,
  onHoverChange,
}: {
  value: string;
  visible: boolean;
  onHoverChange: (v: boolean) => void;
}) {
  const { token } = theme.useToken();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = () => {
    const clip = navigator.clipboard;
    if (!clip) return;
    clip
      .writeText(value)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };
  return (
    <Tooltip title={copied ? 'Copied' : 'Copy value'}>
      <span
        role="button"
        tabIndex={0}
        onClick={copy}
        onKeyDown={(e) => {
          if (e.key === 'Enter') copy();
        }}
        onFocus={() => onHoverChange(true)}
        onBlur={() => onHoverChange(false)}
        style={{
          cursor: 'pointer',
          fontSize: 11,
          color: copied ? token.colorSuccess : token.colorTextTertiary,
          flexShrink: 0,
          opacity: visible || copied ? 1 : 0,
          transition: 'opacity 0.12s',
        }}
      >
        {copied ? <CheckOutlined /> : <CopyOutlined />}
      </span>
    </Tooltip>
  );
}
