/**
 * OrgIcon — an Org's identity glyph (UNIFIED_ORACLE_MODEL.md §6.2).
 *
 * Precedence, most-specific fact first:
 *
 *   1. custom logo — a validated `data:` URI the Org's owner set
 *      (`setHomeOrgLogo`); rendered via `<img>`, which keeps SVG inert;
 *   2. the Org's stamped `hostOs` — a daemon/desktop host records its
 *      own OS at boot and the fact travels with the row, so joiners
 *      render the OS mark for a server they never touch;
 *   3. live detection — the HOME browser Org shows this browser's
 *      brand logo, the HOME desktop Org this machine's OS mark;
 *   4. a daemon Org's reach tier when the wire reported one:
 *      loopback = a server on this machine (hdd), lan = a server on
 *      the network (cluster), wan = a server on the internet (cloud);
 *   5. the generic host-kind glyph.
 *
 * A team Org adds a small "shared" overlay in the bottom-right corner:
 * team-ness is a membership fact (`scopeKind`), orthogonal to the host
 * kind. The overlay sits on a halo disc so the two glyphs' strokes
 * never collide at small sizes. `isPrivate` plays no part.
 */

import { CloudServerOutlined, ClusterOutlined, HddOutlined, TeamOutlined } from '@ant-design/icons';
import { getOrgBackendBindings, type OrgDescriptor } from '@openheaders/core/identity';
import type { BackendReach } from '@openheaders/core/protocol';
import { theme } from 'antd';
import type React from 'react';
import { useBackendReach } from '../hooks/useBackendReach';
import { useIdentitySnapshot } from '../hooks/useIdentitySnapshot';
import { browserGlyph, detectedBrowser, detectedPlatform, platformGlyph } from '../host-glyph';
import { hostKindIcon } from './org-scope-vocabulary';

export interface OrgIconProps {
  descriptor: OrgDescriptor;
  /** Base glyph size in px. */
  size?: number;
  style?: React.CSSProperties;
}

type IconComponent = React.ComponentType<{ style?: React.CSSProperties }>;

const DAEMON_REACH_GLYPH: Record<BackendReach, IconComponent> = {
  loopback: HddOutlined,
  lan: ClusterOutlined,
  wan: CloudServerOutlined,
};

/**
 * The reach tier of the backend hosting `descriptor`'s Org: the home
 * daemon Org reads the host's own bind tier (the daemon admin view),
 * a joined one reads its bound backend's handshake tier. `null` when
 * no wire has reported yet.
 */
function useDaemonOrgReach(descriptor: OrgDescriptor): BackendReach | null {
  // Subscribes to identity re-installs so the fresh bindings read
  // below is never stale for longer than one render.
  useIdentitySnapshot();
  const { map, self } = useBackendReach();
  if (descriptor.hostKind !== 'daemon') return null;
  if (descriptor.isHome) return self;
  const backendId = getOrgBackendBindings().get(descriptor.id);
  return backendId ? (map[backendId] ?? null) : null;
}

function baseGlyph(descriptor: OrgDescriptor, daemonReach: BackendReach | null): IconComponent {
  const stampedOsGlyph = descriptor.hostOs ? platformGlyph(descriptor.hostOs) : null;
  if (descriptor.hostKind === 'daemon') {
    if (stampedOsGlyph) return stampedOsGlyph;
    return daemonReach ? DAEMON_REACH_GLYPH[daemonReach] : hostKindIcon('daemon');
  }
  if (descriptor.isHome) {
    if (descriptor.hostKind === 'browser') {
      return browserGlyph(detectedBrowser()) ?? hostKindIcon('browser');
    }
    return stampedOsGlyph ?? platformGlyph(detectedPlatform()) ?? hostKindIcon('desktop');
  }
  return stampedOsGlyph ?? hostKindIcon(descriptor.hostKind);
}

export const OrgIcon: React.FC<OrgIconProps> = ({ descriptor, size = 14, style }) => {
  const { token } = theme.useToken();
  const daemonReach = useDaemonOrgReach(descriptor);

  let base: React.ReactNode;
  if (descriptor.logo) {
    base = (
      <img
        src={descriptor.logo}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block', borderRadius: 2 }}
      />
    );
  } else {
    const Base = baseGlyph(descriptor, daemonReach);
    base = <Base style={{ fontSize: size }} />;
  }

  if (descriptor.scopeKind !== 'team') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, ...style }}>{base}</span>;
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 1, ...style }}>
      {base}
      <span
        style={{
          position: 'absolute',
          right: -4,
          bottom: -3,
          display: 'inline-flex',
          padding: 1,
          borderRadius: '50%',
          background: token.colorBgElevated,
          lineHeight: 0,
        }}
      >
        <TeamOutlined style={{ fontSize: Math.round(size * 0.58) }} />
      </span>
    </span>
  );
};
