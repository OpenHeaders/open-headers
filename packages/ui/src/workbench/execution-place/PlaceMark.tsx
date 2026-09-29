/**
 * PlaceMark — the glyph that names an execution place without words,
 * the place-everywhere rule applied to the chip: a place looks the
 * same here as it does in the workspace switcher.
 *
 *   - `here` on the extension = this browser's own logo;
 *   - `here` on the desktop app, and the desktop app as a place from a
 *     browser (the same machine) = this machine's OS mark;
 *   - the workspace's server = its Org's icon — the OS the daemon
 *     stamped at boot, else its reach glyph, else the server mark;
 *     a workspace with NO server (a personal one — its Org is the one
 *     this host minted, whose icon is this host's own) wears the bare
 *     server mark, never the home Org's.
 *
 * Every mark is statically bundled (`shared/host-glyph`); a kind with
 * no distinct brand mark falls back to the generic host-kind glyph.
 */

import { describeOrg } from '@openheaders/core/identity';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { browserGlyph, detectedBrowser, detectedPlatform, platformGlyph } from '@openheaders/ui/shared/host-glyph';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { hostKindIcon } from '@openheaders/ui/shared/workspace-org/org-scope-vocabulary';
import { OrgIcon } from '@openheaders/ui/shared/workspace-org/OrgIcon';
import type React from 'react';
import type { ExecutionPlaceRole } from './resolve-execution-place';
import { useEditingScopeOrgId, useWorkspaceServer } from './useWorkspaceServer';

type IconComponent = React.ComponentType<{ style?: React.CSSProperties }>;

/** The mark's provenance, for the tests and the DOM: which fact drew it. */
export type PlaceMarkKind = 'browser' | 'platform' | 'org' | 'host-kind';

interface DeviceMark {
  kind: PlaceMarkKind;
  Icon: IconComponent;
}

/** This device's mark: the browser's logo where the surface IS a
 *  browser page, else the machine's OS mark. */
function deviceMark(role: 'here' | 'desktop-app'): DeviceMark {
  if (role === 'here' && getCurrentHost() === 'extension') {
    const Icon = browserGlyph(detectedBrowser());
    return Icon ? { kind: 'browser', Icon } : { kind: 'host-kind', Icon: hostKindIcon('browser') };
  }
  const Icon = platformGlyph(detectedPlatform());
  return Icon ? { kind: 'platform', Icon } : { kind: 'host-kind', Icon: hostKindIcon('desktop') };
}

export interface PlaceMarkProps {
  /** The place drawn — named `place`, not `role`: the ARIA word on a
   *  JSX element reads as an ARIA role to every a11y tool. */
  place: ExecutionPlaceRole;
  /** Glyph size in px. */
  size?: number;
}

export const PlaceMark: React.FC<PlaceMarkProps> = ({ place, size = 14 }) => {
  const snapshot = useIdentitySnapshot();
  const orgId = useEditingScopeOrgId();
  const server = useWorkspaceServer();
  let kind: PlaceMarkKind;
  let glyph: React.ReactNode;
  if (place === 'workspace-server') {
    const descriptor = server !== null && orgId !== null ? describeOrg(snapshot, orgId) : null;
    if (descriptor !== null) {
      kind = 'org';
      glyph = <OrgIcon descriptor={descriptor} size={size} />;
    } else {
      const Icon = hostKindIcon('daemon');
      kind = 'host-kind';
      glyph = <Icon style={{ fontSize: size }} />;
    }
  } else {
    const mark = deviceMark(place);
    kind = mark.kind;
    glyph = <mark.Icon style={{ fontSize: size }} />;
  }
  return (
    <span
      data-testid="execution-place-mark"
      data-mark={kind}
      data-place={place}
      style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
    >
      {glyph}
    </span>
  );
};
