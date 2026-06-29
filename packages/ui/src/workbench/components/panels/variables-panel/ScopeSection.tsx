/**
 * Per-scope block for the "All" view: a labelled header (badge, scope
 * name, optional subtitle, "Edit" affordance, priority) over an aligned
 * Variable | Value table — the same two-column shape as the editor
 * tables, so keys and values sit in fixed columns and stay easy to scan
 * whatever the name length. Read-only: sensitive values mask to bullets
 * (the editor is the write surface), TOTP rows mount a live preview.
 */

import { Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { scopeBadge } from '../../shared/scope-colors';
import TotpPreview from '../../totp/TotpPreview';
import { SCOPE_CONFIG, type DisplayScope, type DisplayVariable } from './types';

const { Text } = Typography;

interface ScopeSectionProps {
  scope: DisplayScope;
  variables: DisplayVariable[];
  subtitle?: string;
  /** When non-null, the section title row exposes an "Edit" link that
   *  opens this scope's editor. Null hides the affordance — used for
   *  scopes with no editor available in the current context (e.g.,
   *  Environment when no env is selected and there's no default). */
  onOpenEditor?: (() => void) | null;
}

export function ScopeSection({ scope, variables, subtitle, onOpenEditor }: ScopeSectionProps) {
  const { token } = theme.useToken();
  const config = SCOPE_CONFIG[scope];
  return (
    <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {scopeBadge(scope, 16)}
        <Text strong style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {config.label}
        </Text>
        {subtitle && (
          <Text
            type="secondary"
            style={{
              fontSize: 10,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={subtitle}
          >
            : {subtitle}
          </Text>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onOpenEditor ? (
            <Tooltip title={`Open the ${config.label.toLowerCase()} variables editor`}>
              <Text
                role="button"
                tabIndex={0}
                onClick={onOpenEditor}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpenEditor();
                }}
                style={{ fontSize: 10, color: token.colorPrimary, cursor: 'pointer' }}
              >
                Edit
              </Text>
            </Tooltip>
          ) : null}
          <Text type="secondary" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>
            {config.priority} priority
          </Text>
        </span>
      </div>
      {variables.length > 0 ? (
        <ScopeVariableTable variables={variables} />
      ) : (
        <Text type="secondary" style={{ fontSize: 10 }}>
          No {scope === 'vault' ? 'secrets' : 'variables'} defined.
        </Text>
      )}
    </div>
  );
}

function ScopeVariableTable({ variables }: { variables: DisplayVariable[] }) {
  const { token } = theme.useToken();
  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, overflow: 'hidden' }}>
      {variables.map((v, i) => (
        <ScopeVariableRow key={`${v.scope}-${v.name}`} variable={v} isLast={i === variables.length - 1} />
      ))}
    </div>
  );
}

function ScopeVariableRow({ variable, isLast }: { variable: DisplayVariable; isLast: boolean }) {
  const { token } = theme.useToken();
  const cellStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '4px 8px', minWidth: 0 };
  const textStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`,
        alignItems: 'stretch',
      }}
    >
      <div style={cellStyle}>
        <span style={{ ...textStyle, color: token.colorText }} title={variable.name}>
          {variable.name}
        </span>
      </div>
      <div style={{ ...cellStyle, borderLeft: `1px solid ${token.colorBorderSecondary}` }}>
        {variable.totp ? (
          <TotpPreview
            seed={variable.totp.seed}
            algorithm={variable.totp.algorithm}
            digits={variable.totp.digits}
            period={variable.totp.period}
            density="compact"
          />
        ) : (
          <Text type="secondary" style={textStyle} title={variable.isSensitive ? undefined : variable.value || undefined}>
            {variable.isSensitive ? '••••••••' : variable.value || '(empty)'}
          </Text>
        )}
      </div>
    </div>
  );
}
