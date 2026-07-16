/**
 * Shared awareness pill — the pill+popover UI used by every presence
 * badge in the workbench (entity-level on the editor header, per-tab,
 * per-field). Renders a compact pill with one colored dot per distinct
 * surface kind plus a count, and a hover/click popover listing each
 * peer with click-to-switch where the surface is peer-addressable.
 *
 * Single source of truth for the visual treatment so all three badges
 * (entity / tab / field) read identically — the only knobs are the
 * `presence` array and the popover title.
 *
 * Returns `null` when the presence list is empty so callers can drop
 * it inline without conditional rendering on their side.
 *
 * Hierarchical grouping (`presence-grouping.ts`): the popover walks
 * the natural identity tree (`userId` → `deviceId` → `browserContext`
 * → instance) so the same primitive scales from Mode 1 (single
 * browser, multi-surface — today's flat list, all upper levels
 * auto-collapsed) → Mode 2 (multi-browser local oracle, browser
 * headers surface) → Mode 3 (cross-user team cloud, user headers at
 * the top). Per-parent collapsing means every visible header carries
 * information you couldn't infer from its parent.
 */

import type { AwarenessState, PresenceIdentity } from '@openheaders/core/protocol';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { Popover } from 'antd';
import type React from 'react';
import { useSurfaceIdentity } from './IdentityContext';
import { isHandleCoLocated, isPeerNavigable, peerNavigate } from './peer-navigate';
import { groupPresence, localHostTag, type PresenceGroupLabel, type PresenceTreeNode } from './presence-grouping';
import { surfaceDisplayLabel, surfaceKindColor, surfaceKindLabel } from './surface-label';

export interface AwarenessPillProps {
  presence: AwarenessState[];
  /** Popover header title — typically a short summary like "2 other surfaces"
   *  for entity-level or "Editing this field" for field-level. */
  title: string;
  /** Aria label for the pill itself. Falls back to `title` when omitted. */
  ariaLabel?: string;
  style?: React.CSSProperties;
}

const AwarenessPill: React.FC<AwarenessPillProps> = ({ presence, title, ariaLabel, style }) => {
  const t = useT();
  const localIdentity = useSurfaceIdentity().current();
  if (presence.length === 0) return null;

  const tree = groupPresence(presence, localIdentity);

  const popoverContent = (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 220 }}>
      {tree.map((node) => renderNode(node, localIdentity, 0))}
    </ul>
  );

  // Dedup display dots by surfaceKind for the badge summary; the popover
  // tree shows the per-instance breakdown.
  const seenKinds = new Set<string>();
  const dotKinds: AwarenessState[] = [];
  for (const p of presence) {
    if (seenKinds.has(p.identity.surfaceKind)) continue;
    seenKinds.add(p.identity.surfaceKind);
    dotKinds.push(p);
  }

  return (
    <Popover content={popoverContent} placement="bottom" trigger={['hover', 'click']} title={title} zIndex={1100}>
      <span
        role="button"
        tabIndex={0}
        aria-label={ariaLabel ?? title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          height: 16,
          padding: '0 4px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.04)',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          cursor: 'pointer',
          ...style,
        }}
      >
        {dotKinds.map((p) => (
          <span
            key={p.identity.surfaceKind}
            title={t(surfaceKindLabel(p.identity.surfaceKind))}
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: surfaceKindColor(p.identity.surfaceKind),
            }}
          />
        ))}
        <span style={{ marginLeft: 2 }}>{presence.length}</span>
      </span>
    </Popover>
  );
};

export default AwarenessPill;

// ── Tree rendering ───────────────────────────────────────────────────

function renderNode(
  node: PresenceTreeNode,
  localIdentity: ReturnType<ReturnType<typeof useSurfaceIdentity>['current']>,
  depth: number,
): React.ReactNode {
  if (node.kind === 'leaf') {
    return (
      <SurfaceRow
        key={node.state.identity.instanceId}
        state={node.state}
        localIdentity={localIdentity}
        depth={depth}
      />
    );
  }
  const headerKey = `g:${node.level}:${node.groupKey}`;
  return (
    <li key={headerKey} style={{ listStyle: 'none' }}>
      <GroupHeader label={node.label} hintKey={hintForGroup(node, localIdentity)} depth={depth} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {node.children.map((child) => renderNode(child, localIdentity, depth + 1))}
      </ul>
    </li>
  );
}

function hintForGroup(
  node: Extract<PresenceTreeNode, { kind: 'group' }>,
  localIdentity: PresenceIdentity,
): MessageKey | null {
  if (!node.isLocal) return null;
  if (node.level === 'user') return 'shared.awareness.hint.you';
  if (node.level === 'device') return 'shared.awareness.hint.thisDevice';
  return localHostTag(localIdentity.appId);
}

function groupLabelText(t: Translate, label: PresenceGroupLabel): string {
  return label.kind === 'key' ? t(label.key, label.args) : label.text;
}

interface GroupHeaderProps {
  label: PresenceGroupLabel;
  hintKey: MessageKey | null;
  depth: number;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({ label, hintKey, depth }) => {
  const t = useT();
  return (
    <div
      style={{
        paddingLeft: 6 + depth * 12,
        paddingTop: 4,
        paddingBottom: 2,
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--ant-color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {groupLabelText(t, label)}
      </span>
      {hintKey && (
        <span
          style={{
            fontSize: 9,
            padding: '0 4px',
            height: 12,
            lineHeight: '12px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.06)',
            color: 'var(--ant-color-text-secondary)',
            textTransform: 'none',
            letterSpacing: 0,
            fontWeight: 500,
          }}
        >
          {t(hintKey)}
        </span>
      )}
    </div>
  );
};

interface SurfaceRowProps {
  state: AwarenessState;
  localIdentity: ReturnType<ReturnType<typeof useSurfaceIdentity>['current']>;
  depth: number;
}

const SurfaceRow: React.FC<SurfaceRowProps> = ({ state, localIdentity, depth }) => {
  const t = useT();
  const coLocated = isHandleCoLocated(localIdentity.navigation, state.identity.navigation);
  const navigable = !coLocated && isPeerNavigable(state.identity.navigation);
  const onClick = navigable
    ? () => {
        if (state.identity.navigation) void peerNavigate(state.identity.navigation);
      }
    : undefined;
  const tooltip = coLocated
    ? t('shared.awareness.row.alreadyOnTab')
    : navigable
      ? t('shared.awareness.row.switchToSurface')
      : t('shared.awareness.row.notAddressable');
  return (
    <li>
      <button
        type="button"
        disabled={!navigable}
        onClick={onClick}
        title={tooltip}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          paddingLeft: 6 + depth * 12,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: navigable ? 'pointer' : 'default',
          textAlign: 'left',
          font: 'inherit',
          opacity: coLocated ? 0.55 : 1,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: surfaceKindColor(state.identity.surfaceKind),
            flex: '0 0 auto',
          }}
        />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {surfaceDisplayLabel(t, state.identity)}
        </span>
        {coLocated ? (
          <span
            style={{
              fontSize: 10,
              padding: '0 5px',
              height: 14,
              lineHeight: '14px',
              borderRadius: 7,
              background: 'rgba(0,0,0,0.06)',
              color: 'inherit',
              flex: '0 0 auto',
            }}
          >
            {t('shared.awareness.row.thisTab')}
          </span>
        ) : navigable ? (
          <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
        ) : null}
      </button>
    </li>
  );
};
