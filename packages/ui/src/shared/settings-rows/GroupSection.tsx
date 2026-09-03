/**
 * Collapsible section between logical knob groups — the sidebar
 * section idiom: rotating caret + uppercase title + rail, rows as
 * children. A collapsed header carries the accent dot while any of
 * its hidden knobs is off its default (salmon while any is unsaved),
 * so customizations never disappear behind a fold. The optional (i)
 * opens the group's slice of the tab's shared example popover. The
 * rows sit one caret-width in under the title; the block keeps the
 * host column's own row gap.
 */

import { Typography, theme } from 'antd';
import type React from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { GROUP_ROWS_INDENT } from './constants';
import ModifiedDot from './ModifiedDot';

const { Text } = Typography;

const GroupSection: React.FC<{
  label: string;
  expanded: boolean;
  onToggle: () => void;
  /** Header (i) popover — the group's slice of the shared example. */
  info?: InfoPopoverContent;
  modified?: boolean;
  unsaved?: boolean;
  children: React.ReactNode;
}> = ({ label, expanded, onToggle, info, modified, unsaved, children }) => {
  const { token } = theme.useToken();
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          // Space must not scroll the pane — it activates, like Enter.
          // Keys landing on the inner (i) trigger stay its own: they
          // must open the popover, not also toggle the fold.
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          margin: '6px 0 2px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            color: token.colorTextTertiary,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: token.colorTextTertiary,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Text>
        {info !== undefined && <InfoTrigger content={info} />}
        {(unsaved === true || modified === true) && !expanded && <ModifiedDot unsaved={unsaved} />}
        <div style={{ flex: 1, height: 1, background: token.colorSplit }} />
      </div>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'inherit', paddingLeft: GROUP_ROWS_INDENT }}>
          {children}
        </div>
      )}
    </>
  );
};

export default GroupSection;
