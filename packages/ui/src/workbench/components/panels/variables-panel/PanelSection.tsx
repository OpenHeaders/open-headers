/**
 * Top-level collapsible section for the Scope panel. The panel stacks two
 * of these — "In scope: ‹entity›" and "All scopes" — each opening
 * and closing under a caret. Mirrors the sidebar section headers
 * (`.rules-sidebar-section`) — same solid caret glyph, typography, and
 * left offset — so top-level sections read identically across panels, and
 * takes the same optional hover-revealed `(i)` so each section can explain
 * itself.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Typography, theme } from 'antd';
import { type ReactNode, useState } from 'react';
import SectionInfo from '../../shared/SectionInfo';

const { Text } = Typography;

interface PanelSectionProps {
  title: ReactNode;
  /** When set, a hover-revealed `(i)` next to the title opens this popover. */
  info?: InfoPopoverContent;
  /** Docs anchor for the popover's "More information" header link. */
  docId?: string;
  defaultExpanded?: boolean;
  /** Suppresses the bottom divider on the final section. */
  isLast?: boolean;
  children: ReactNode;
}

export function PanelSection({ title, info, docId, defaultExpanded = true, isLast, children }: PanelSectionProps) {
  const { token } = theme.useToken();
  const t = useT();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded((e) => !e);
  return (
    <div style={{ borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`, padding: '4px 0' }}>
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
          gap: 4,
          // Same box as the sidebar section headers (`.rules-sidebar-section`:
          // 4px margin + 12px padding) so the caret and title line up
          // identically across panels.
          margin: '0 4px',
          padding: '4px 12px',
          marginBottom: expanded ? 4 : 0,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            color: token.colorTextSecondary,
            fontSize: 10,
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        <Text
          style={{
            // Same typography as the sidebar section headers
            // (`.rules-sidebar-section-title`) so top-level section titles
            // read identically across the app.
            fontWeight: 600,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: token.colorTextSecondary,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </Text>
        {info && (
          <SectionInfo
            content={info}
            docId={docId}
            className="vp-scope-reveal"
            ariaLabel={t('workbench.variables.panel.sectionAboutAria', { title: info.title })}
          />
        )}
      </div>
      {/* 18px matches the sidebar tree rows (4px margin + 14px padding) so
          nested scope rows indent just past the section caret, mirroring the
          sidebar's section → row hierarchy. */}
      {expanded && <div style={{ padding: '0 18px' }}>{children}</div>}
    </div>
  );
}
