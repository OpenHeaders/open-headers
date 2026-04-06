/**
 * VariablesPanel — the Variables tab inside the Inspector sidebar.
 *
 * Two modes (togglable):
 * - "In request": shows only variables referenced in the active request/rule
 * - "All": shows all variable scopes in priority order
 *
 * Matches the pattern from Bruno/Postman's variable sidebar.
 */

import { EyeInvisibleOutlined, EyeOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Typography, theme } from 'antd';
import { useState } from 'react';

const { Text } = Typography;

type ViewMode = 'in-request' | 'all';

// ── Types for variable display ─────────────────────────────────────

export interface DisplayVariable {
  name: string;
  value: string;
  scope: 'vault' | 'environment' | 'collection' | 'globals';
  isSensitive: boolean;
  resolved: boolean;
}

interface VariablesPanelProps {
  /** Label for the active editor item (e.g. "POST login") */
  activeItemLabel?: string;
  /** Variables referenced in the active item */
  inRequestVars?: DisplayVariable[];
  /** All variables grouped by scope */
  allVars?: {
    vault: DisplayVariable[];
    environment: DisplayVariable[];
    collection: DisplayVariable[];
    globals: DisplayVariable[];
  };
  /** Active environment name */
  activeEnvironment?: string;
  /** Active collection name */
  activeCollection?: string;
}

// ── Scope config ───────────────────────────────────────────────────

const SCOPE_CONFIG = {
  vault: { label: 'Local Vault', icon: <LockOutlined />, color: '#e74c3c', letter: '🔒', priority: 'highest' },
  environment: { label: 'Environment', icon: null, color: '#3498db', letter: 'E', priority: 'high' },
  collection: { label: 'Collection', icon: null, color: '#2ecc71', letter: 'C', priority: 'medium' },
  globals: { label: 'Globals', icon: null, color: '#f39c12', letter: 'G', priority: 'lowest' },
} as const;

// ── Variable row ───────────────────────────────────────────────────

function VariableRow({ variable }: { variable: DisplayVariable }) {
  const { token } = theme.useToken();
  const [showSecret, setShowSecret] = useState(false);
  const scopeConfig = SCOPE_CONFIG[variable.scope];

  const displayValue = variable.isSensitive && !showSecret ? '••••••••' : variable.value;

  return (
    <div
      className="v5-var-row"
      style={{
        border: `0.5px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        padding: '6px 8px',
        marginBottom: 5,
      }}
    >
      <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11, color: token.colorWarning }}>
        {`{{${variable.name}}}`}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {variable.resolved ? (
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
          ) : (
            <Text style={{ fontSize: 10, color: token.colorError }}>unresolved</Text>
          )}
          {variable.isSensitive && (
            <span
              style={{ cursor: 'pointer', fontSize: 10, color: token.colorTextTertiary }}
              onClick={() => setShowSecret(!showSecret)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setShowSecret(!showSecret);
              }}
            >
              {showSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            </span>
          )}
        </div>
        <Text style={{ fontSize: 10, color: scopeConfig.color }}>{scopeConfig.label}</Text>
      </div>
    </div>
  );
}

// ── Scope section (for "All" mode) ─────────────────────────────────

function ScopeSection({
  scope,
  variables,
  subtitle,
}: {
  scope: keyof typeof SCOPE_CONFIG;
  variables: DisplayVariable[];
  subtitle?: string;
}) {
  const { token } = theme.useToken();
  const config = SCOPE_CONFIG[scope];

  return (
    <div className="v5-var-scope" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: scope === 'vault' ? 12 : 10,
            fontWeight: 700,
            color: 'white',
            background: config.color,
          }}
        >
          {scope === 'vault' ? config.letter : config.letter}
        </span>
        <Text strong style={{ fontSize: 11 }}>
          {config.label}
        </Text>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            : {subtitle}
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 9, marginLeft: 'auto' }}>
          {config.priority} priority
        </Text>
      </div>

      {variables.length > 0 ? (
        variables.map((v) => (
          <div
            key={v.name}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}
          >
            <Text style={{ fontFamily: "'SF Mono', monospace", fontSize: 10 }}>{v.name}</Text>
            <Text
              type="secondary"
              style={{
                fontSize: 10,
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {v.isSensitive ? '••••••••' : v.value || '(empty)'}
            </Text>
          </div>
        ))
      ) : (
        <div style={{ fontSize: 10, color: token.colorTextTertiary }}>
          No {scope === 'vault' ? 'secrets' : 'variables'} defined.{' '}
          <Button type="link" size="small" style={{ fontSize: 10, padding: 0, height: 'auto' }} icon={<PlusOutlined />}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────

export function VariablesPanel({
  activeItemLabel,
  inRequestVars = [],
  allVars,
  activeEnvironment = 'Default',
  activeCollection,
}: VariablesPanelProps) {
  const { token } = theme.useToken();
  const [mode, setMode] = useState<ViewMode>('in-request');

  return (
    <div className="v5-var-panel" style={{ padding: '8px 10px' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {mode === 'in-request' && activeItemLabel ? (
            <>
              Variables in:{' '}
              <Text strong style={{ fontSize: 11 }}>
                {activeItemLabel}
              </Text>
            </>
          ) : (
            'All variables'
          )}
        </Text>
        <div style={{ display: 'flex', fontSize: 10, fontWeight: 400 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={() => setMode('in-request')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setMode('in-request');
            }}
            style={{
              padding: '2px 6px',
              cursor: 'pointer',
              borderRadius: '3px 0 0 3px',
              ...(mode === 'in-request'
                ? { background: token.colorPrimary, color: 'white' }
                : {
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRight: 0,
                    color: token.colorTextSecondary,
                  }),
            }}
          >
            In request
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
                ? { background: token.colorPrimary, color: 'white' }
                : { border: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextSecondary }),
            }}
          >
            All
          </span>
        </div>
      </div>

      {/* In-request mode */}
      {mode === 'in-request' && (
        <>
          {inRequestVars.length > 0 ? (
            <>
              {inRequestVars.map((v) => (
                <VariableRow key={v.name} variable={v} />
              ))}
              <div style={{ marginTop: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                {inRequestVars.every((v) => v.resolved) ? (
                  <Text style={{ color: token.colorSuccess }}>
                    ✓ All {inRequestVars.length} variable{inRequestVars.length !== 1 ? 's' : ''} resolved
                  </Text>
                ) : (
                  <Text style={{ color: token.colorError }}>
                    ⚠ {inRequestVars.filter((v) => !v.resolved).length} unresolved variable
                    {inRequestVars.filter((v) => !v.resolved).length !== 1 ? 's' : ''}
                  </Text>
                )}
              </div>
            </>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {activeItemLabel
                ? 'No variables referenced in this item.'
                : 'Select a request or rule to see its variables.'}
            </Text>
          )}
        </>
      )}

      {/* All mode — scoped sections */}
      {mode === 'all' && (
        <>
          <ScopeSection scope="vault" variables={allVars?.vault ?? []} />
          <ScopeSection scope="environment" variables={allVars?.environment ?? []} subtitle={activeEnvironment} />
          <ScopeSection scope="collection" variables={allVars?.collection ?? []} subtitle={activeCollection} />
          <ScopeSection scope="globals" variables={allVars?.globals ?? []} />
        </>
      )}
    </div>
  );
}
