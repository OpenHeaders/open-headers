/**
 * Editor-tab presence badge.
 *
 * Renders nothing when only the local surface (or no surface) has the
 * entity in focus. When other surfaces are present, shows a small
 * pill-shaped chip with the count and a popover listing each peer
 * surface, with click-to-switch where the surface is peer-addressable.
 *
 * The badge is pure projection of the awareness mirror — it doesn't
 * itself publish anything. Surfaces publish via `useAwareness` and read
 * via this badge in their tab title / editor header slot.
 */

import { Popover } from 'antd';
import type React from 'react';
import { useSurfaceIdentity } from './IdentityContext';
import { isHandleCoLocated, isPeerNavigable, peerNavigate } from './peer-navigate';
import { surfaceKindColor, surfaceKindLabel } from './surface-label';
import { useEntityPresence } from './use-entity-presence';

export interface PresenceBadgeProps {
  entityType: string;
  entityId: string | null | undefined;
  /** Local instance id — filtered out so this surface doesn't see itself. */
  excludeInstanceId: string;
  style?: React.CSSProperties;
}

const PresenceBadge: React.FC<PresenceBadgeProps> = ({ entityType, entityId, excludeInstanceId, style }) => {
  const ref = entityId ? { type: entityType, id: entityId } : null;
  const presence = useEntityPresence(ref, { excludeInstanceId, enabled: !!entityId });
  const localIdentity = useSurfaceIdentity().current();
  if (presence.length === 0) return null;

  const popoverContent = (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 200 }}>
      {presence.map((p) => {
        const coLocated = isHandleCoLocated(localIdentity.navigation, p.identity.navigation);
        const navigable = !coLocated && isPeerNavigable(p.identity.navigation);
        const onClick = navigable
          ? () => {
              if (p.identity.navigation) void peerNavigate(p.identity.navigation);
            }
          : undefined;
        const tooltip = coLocated
          ? 'Already on this tab'
          : navigable
            ? 'Switch to this surface'
            : 'Not peer-addressable';
        return (
          <li key={p.identity.instanceId}>
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
                padding: '4px 6px',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: navigable ? 'pointer' : 'default',
                textAlign: 'left',
                font: 'inherit',
                // Dim co-located peers so the user can see at a glance
                // which row corresponds to the tab they're already on.
                opacity: coLocated ? 0.55 : 1,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: surfaceKindColor(p.identity.surfaceKind),
                  flex: '0 0 auto',
                }}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.identity.label}
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
                  this tab
                </span>
              ) : navigable ? (
                <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  // Dedup display dots by surfaceKind for the badge summary; the
  // popover row list is per-instance.
  const seenKinds = new Set<string>();
  const dotKinds: typeof presence = [];
  for (const p of presence) {
    if (seenKinds.has(p.identity.surfaceKind)) continue;
    seenKinds.add(p.identity.surfaceKind);
    dotKinds.push(p);
  }

  return (
    <Popover
      content={popoverContent}
      placement="bottom"
      trigger={['hover', 'click']}
      title={`${presence.length} other surface${presence.length === 1 ? '' : 's'}`}
      // Lift above any host popover the badge is rendered inside —
      // the devpanel's `RuleHoverPopover` sits at zIndex 1080 with its
      // inline dropdowns at 1090. Anything ≥ 1100 wins.
      zIndex={1100}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${presence.length} other surface${presence.length === 1 ? '' : 's'} editing this entity`}
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
            title={surfaceKindLabel(p.identity.surfaceKind)}
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

export default PresenceBadge;
