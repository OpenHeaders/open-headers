/**
 * Per-scope block for the "All scopes" view: a labelled header (badge,
 * scope name, optional subtitle, "Edit" affordance, and an (i) info
 * trigger that explains the scope + its resolution priority) over an
 * aligned Variable | Value table (the shared `VariableTable`). Read-only
 * — sensitive values mask to bullets (the editor is the write surface),
 * TOTP rows mount a live preview. The Edit link and (i) reveal on row
 * hover/focus (CSS, see `.vp-scope-head` in rules.less).
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Dropdown, Tooltip, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { scopeBadge } from '../../shared/scope-colors';
import { buildScopeInfo } from './scope-info';
import { SCOPE_CONFIG, type DisplayScope, type DisplayVariable } from './types';
import { VariableTable } from './VariableTable';

const { Text } = Typography;

/**
 * Hover affordance on the section title row. `run` executes directly
 * (Edit / Create); `menu` swaps the click for an inline picker
 * (Select — choose the active environment without leaving the panel).
 */
export interface ScopeHeaderAction {
  label: string;
  tooltip: string;
  run?: () => void;
  menu?: readonly { key: string; label: string; onClick: () => void }[];
}

interface ScopeSectionProps {
  scope: DisplayScope;
  variables: DisplayVariable[];
  subtitle?: string;
  /** When non-null, the section title row exposes a context action on
   *  hover (Edit / Create / Select). Null hides the affordance. */
  action?: ScopeHeaderAction | null;
  /** Suppresses the bottom divider on the final section — a trailing
   *  separator with nothing below it is just noise. */
  isLast?: boolean;
}

export function ScopeSection({ scope, variables, subtitle, action, isLast }: ScopeSectionProps) {
  const { token } = theme.useToken();
  const config = SCOPE_CONFIG[scope];
  const hasVariables = variables.length > 0;
  // Each scope collapses independently so users can hide the scopes
  // they aren't fiddling with. Default open — the panel reads top-down.
  const [expanded, setExpanded] = useState(true);
  const toggle = () => setExpanded((e) => !e);
  const scopeInfo = useMemo(() => buildScopeInfo(scope), [scope]);
  // A populated, expanded table draws its own bottom border, so the
  // section divider would stack a second line right under it. The last
  // section never needs one — nothing follows it. Keep the divider in
  // every other case to separate sections.
  const showTable = expanded && hasVariables;
  const showDivider = !showTable && !isLast;
  return (
    <div style={{ borderBottom: showDivider ? `1px solid ${token.colorBorderSecondary}` : undefined, padding: '8px 0' }}>
      <div
        className="vp-scope-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          // Only toggle on keys aimed at the row itself — let the Edit
          // link and the (i) trigger handle their own Enter/Space.
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
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
        <InfoTrigger content={scopeInfo} className="vp-scope-reveal" ariaLabel={`About ${config.label} variables`} />
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
        {action ? (
          <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
            {action.menu ? (
              <Dropdown
                menu={{
                  items: action.menu.map((item) => ({ key: item.key, label: item.label, onClick: item.onClick })),
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Tooltip title={action.tooltip}>
                  <Text
                    className="vp-scope-reveal"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ fontSize: 10, color: token.colorPrimary, cursor: 'pointer' }}
                  >
                    {action.label}
                  </Text>
                </Tooltip>
              </Dropdown>
            ) : (
              <Tooltip title={action.tooltip}>
                <Text
                  className="vp-scope-reveal"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.run?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      action.run?.();
                    }
                  }}
                  style={{ fontSize: 10, color: token.colorPrimary, cursor: 'pointer' }}
                >
                  {action.label}
                </Text>
              </Tooltip>
            )}
          </span>
        ) : null}
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
