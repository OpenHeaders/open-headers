/**
 * GrpcAuthTab — the gRPC call's auth block: the shared session tab
 * under the gRPC mask (bearer · basic · api-key in header · OAuth 2.0
 * · JWT Bearer — header modes only, the call has no query leg). Every
 * own type lands as an `authorization` (or own-key) metadata pair
 * minted once per invoke; the rail note names it, bearer keeping its
 * own sentence.
 */

import type { GrpcAuth } from '@openheaders/core/types';
import type React from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import type { InheritedAuthAttribution } from '../request-editor/inherited-auth';
import { SessionAuthTab } from '../request-editor/SessionAuthTab';

interface GrpcAuthTabProps {
  auth: GrpcAuth;
  inheritedFrom?: InheritedAuthAttribution;
  ancestry?: RequestAncestry | null;
  /** The call target — host-scoped entries resolve against it. */
  url?: string;
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onChange: (auth: GrpcAuth) => void;
}

const GrpcAuthTab: React.FC<GrpcAuthTabProps> = (props) => (
  <SessionAuthTab
    kind="grpc"
    testIdStem="grpc"
    unsupportedKey="workbench.editors.grpc.auth.inheritUnsupported"
    ownUnsupportedKey="workbench.editors.grpc.auth.ownUnsupported"
    ownNoteKey={(type) =>
      type === 'bearer' ? 'workbench.editors.grpc.auth.help' : 'workbench.editors.grpc.auth.helpOwn'
    }
    {...props}
  />
);

export default GrpcAuthTab;
