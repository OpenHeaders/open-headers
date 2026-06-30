/**
 * Top-level collapsible section for the Scope panel. The panel stacks two
 * of these — "In ‹rule/request/template›" and "All scopes" — each opening
 * and closing under a caret. Mirrors `ScopeSection`'s caret styling so the
 * two nesting levels read as one hierarchy, and takes the same optional
 * hover-revealed `(i)` so each section can explain itself.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Typography, theme } from 'antd';
import { type ReactNode, useState } from 'react';

const { Text } = Typography;

interface PanelSectionProps {
  title: ReactNode;
  /** When set, a hover-revealed `(i)` next to the title opens this popover. */
  info?: InfoPopoverContent;
  defaultExpanded?: boolean;
  /** Suppresses the bottom divider on the final section. */
  isLast?: boolean;
  children: ReactNode;
}

export function PanelSection({ title, info, defaultExpanded = true, isLast, children }: PanelSectionProps) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded((e) => !e);
  return (
    <div style={{ borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`, padding: '8px 0' }}>
      <div
        className="vp-scope-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          // Only toggle on keys aimed at the row itself — let the (i)
          // trigger handle its own Enter/Space.
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: expanded ? 8 : 0,
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
        <Text
          strong
          style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </Text>
        {info && (
          <InfoTrigger content={info} className="vp-scope-reveal" ariaLabel={`About ${info.title}`} />
        )}
      </div>
      {expanded && children}
    </div>
  );
}
