/**
 * Per-scope block for the "All scopes" view: a labelled header (badge,
 * scope name, optional subtitle, "Edit" affordance, priority) over an
 * aligned Variable | Value table (the shared `VariableTable`). Read-only
 * — sensitive values mask to bullets (the editor is the write surface),
 * TOTP rows mount a live preview.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { Tooltip, Typography, theme } from 'antd';
import { useState } from 'react';
import { scopeBadge } from '../../shared/scope-colors';
import { ScopeRankTooltip } from './ScopeRankTooltip';
import { SCOPE_CONFIG, type DisplayScope, type DisplayVariable } from './types';
import { VariableTable } from './VariableTable';

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
  /** Suppresses the bottom divider on the final section — a trailing
   *  separator with nothing below it is just noise. */
  isLast?: boolean;
}

export function ScopeSection({ scope, variables, subtitle, onOpenEditor, isLast }: ScopeSectionProps) {
  const { token } = theme.useToken();
  const config = SCOPE_CONFIG[scope];
  const hasVariables = variables.length > 0;
  // Each scope collapses independently so users can hide the scopes
  // they aren't fiddling with. Default open — the panel reads top-down.
  const [expanded, setExpanded] = useState(true);
  const toggle = () => setExpanded((e) => !e);
  // "Edit" is peripheral chrome on a peripheral panel — reveal it on
  // row hover (or when the link itself is keyboard-focused) so the
  // header stays quiet until the user reaches for it.
  const [hovered, setHovered] = useState(false);
  const [editFocused, setEditFocused] = useState(false);
  // A populated, expanded table draws its own bottom border, so the
  // section divider would stack a second line right under it. The last
  // section never needs one — nothing follows it. Keep the divider in
  // every other case to separate sections.
  const showTable = expanded && hasVariables;
  const showDivider = !showTable && !isLast;
  return (
    <div style={{ borderBottom: showDivider ? `1px solid ${token.colorBorderSecondary}` : undefined, padding: '8px 0' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: expanded ? 6 : 0,
          cursor: 'pointer',
        }}
      >
        <CaretRightOutlined
          style={{
            color: token.colorTextTertiary,
            fontSize: 10,
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
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
        <span
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            opacity: hovered || editFocused ? 1 : 0,
            transition: 'opacity 0.12s',
          }}
        >
          {onOpenEditor ? (
            <>
              <Tooltip title={`Open the ${config.label.toLowerCase()} variables editor`}>
                <Text
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditor();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onOpenEditor();
                    }
                  }}
                  onFocus={() => setEditFocused(true)}
                  onBlur={() => setEditFocused(false)}
                  style={{ fontSize: 10, color: token.colorPrimary, cursor: 'pointer' }}
                >
                  Edit
                </Text>
              </Tooltip>
              <span style={{ width: 1, height: 10, background: token.colorBorderSecondary, flexShrink: 0 }} />
            </>
          ) : null}
          <Tooltip title={<ScopeRankTooltip scope={scope} />} overlayStyle={{ maxWidth: 300 }}>
            <Text type="secondary" style={{ fontSize: 9, whiteSpace: 'nowrap', cursor: 'help' }}>
              {config.rank}
            </Text>
          </Tooltip>
        </span>
      </div>
      {expanded &&
        (hasVariables ? (
          <VariableTable variables={variables} />
        ) : (
          <Text type="secondary" style={{ fontSize: 10 }}>
            No {scope === 'vault' ? 'secrets' : 'variables'} defined.
          </Text>
        ))}
    </div>
  );
}
