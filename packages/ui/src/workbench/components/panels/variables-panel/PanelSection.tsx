/**
 * Top-level collapsible section for the Scope panel. The panel stacks two
 * of these — "In ‹rule/request/template›" and "All scopes" — each opening
 * and closing under a caret. Mirrors `ScopeSection`'s caret styling so the
 * two nesting levels read as one hierarchy.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import { type ReactNode, useState } from 'react';

const { Text } = Typography;

interface PanelSectionProps {
  title: ReactNode;
  defaultExpanded?: boolean;
  /** Suppresses the bottom divider on the final section. */
  isLast?: boolean;
  children: ReactNode;
}

export function PanelSection({ title, defaultExpanded = true, isLast, children }: PanelSectionProps) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded((e) => !e);
  return (
    <div style={{ borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`, padding: '8px 0' }}>
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
          style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </Text>
      </div>
      {expanded && children}
    </div>
  );
}
