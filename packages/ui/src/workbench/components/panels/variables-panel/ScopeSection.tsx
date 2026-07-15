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
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tooltip, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { scopeBadge } from '../../shared/scope-colors';
import SectionInfo from '../../shared/SectionInfo';
import { buildScopeInfo } from './scope-info';
import { SCOPE_CONFIG, type DisplayScope, type DisplayVariable } from './types';
import { VariableTable } from './VariableTable';

const { Text } = Typography;

/** Hover affordance on the section title row (Edit / Create / Select). */
export interface ScopeHeaderAction {
  label: string;
  tooltip: string;
  run: () => void;
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
  const t = useT();
  const config = SCOPE_CONFIG[scope];
  const hasVariables = variables.length > 0;
  // Each scope collapses independently so users can hide the scopes
  // they aren't fiddling with. Default open — the panel reads top-down.
  const [expanded, setExpanded] = useState(true);
  const toggle = () => setExpanded((e) => !e);
  const scopeInfo = useMemo(() => buildScopeInfo(t, scope), [t, scope]);
  // A populated, expanded table draws its own bottom border, so the
  // section divider would stack a second line right under it. The last
  // section never needs one — nothing follows it. Keep the divider in
  // every other case to separate sections.
  const showTable = expanded && hasVariables;
  const showDivider = !showTable && !isLast;
  return (
    <div style={{ borderBottom: showDivider ? `1px solid ${token.colorBorderSecondary}` : undefined, padding: '4px 0' }}>
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
          // Horizontal padding pulled back out by the negative margin so the
          // hover wash gets breathing room without shifting the text.
          padding: '4px 6px',
          margin: '0 -6px',
          marginBottom: expanded ? 2 : 0,
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
          {t(config.labelKey)}
        </Text>
        <SectionInfo
          content={scopeInfo}
          docId={`variables-${scope}`}
          className="vp-scope-reveal"
          ariaLabel={t('workbench.variables.panel.scopeAboutAria', { scope: t(config.labelKey) })}
        />
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
            <Tooltip title={action.tooltip}>
              <Text
                className="vp-scope-reveal"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  action.run();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    action.run();
                  }
                }}
                style={{ fontSize: 10, color: token.colorPrimary, cursor: 'pointer' }}
              >
                {action.label}
              </Text>
            </Tooltip>
          </span>
        ) : null}
      </div>
      {expanded &&
        (hasVariables ? (
          <VariableTable variables={variables} />
        ) : (
          <Text type="secondary" style={{ fontSize: 10 }}>
            {t(
              scope === 'vault'
                ? 'workbench.variables.panel.emptyScopeSecrets'
                : 'workbench.variables.panel.emptyScopeVariables',
            )}
          </Text>
        ))}
    </div>
  );
}
