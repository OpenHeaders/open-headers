/**
 * OrgIcon — an Org's identity glyph (UNIFIED_ORACLE_MODEL.md §6.2).
 *
 * The base glyph is the host kind that minted the Org — browser /
 * desktop / daemon. A team Org adds a small "shared" overlay in the
 * bottom-right corner: team-ness is a membership fact (`scopeKind`),
 * orthogonal to the host kind. `isPrivate` plays no part.
 */

import { TeamOutlined } from '@ant-design/icons';
import type { OrgDescriptor } from '@openheaders/core/identity';
import type React from 'react';
import { hostKindIcon } from './org-scope-vocabulary';

export interface OrgIconProps {
  descriptor: OrgDescriptor;
  /** Base glyph size in px. */
  size?: number;
  style?: React.CSSProperties;
}

export const OrgIcon: React.FC<OrgIconProps> = ({ descriptor, size = 14, style }) => {
  const Base = hostKindIcon(descriptor.hostKind);

  if (descriptor.scopeKind !== 'team') {
    return <Base style={{ fontSize: size, ...style }} />;
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 1, ...style }}>
      <Base style={{ fontSize: size }} />
      <TeamOutlined
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          fontSize: Math.round(size * 0.62),
        }}
      />
    </span>
  );
};
