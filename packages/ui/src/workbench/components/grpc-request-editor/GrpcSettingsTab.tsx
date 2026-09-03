/**
 * GrpcSettingsTab — the request's Settings tab: the shared gRPC rows
 * (`GrpcSettingsRows`, the same rows a container's Settings section
 * renders) over the editor draft, plus the Messages group's app-wide
 * send-invalid-message posture (the SAME setting as Settings →
 * Requests and the header ⋯ toggle, not a per-request field). The
 * draft keeps its verification switch concrete — this seam maps it
 * onto the rows' optional value (a default-equivalent switch reads as
 * absent, so the dots track distance from the protocol defaults) and
 * re-concretizes what the rows hand back. There is no saved-baseline
 * (unsaved) plane here; the editor's own dirty fingerprint covers
 * "not saved yet".
 */

import { GRPC_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { sliceOf } from '../shared/inherited-settings/inherited-settings';
import type { GrpcDraft } from './draft';
import GrpcSettingsRows, { type GrpcSettingsValue } from './GrpcSettingsRows';

interface GrpcSettingsTabProps {
  draft: GrpcDraft;
  setDraft: Dispatch<SetStateAction<GrpcDraft>>;
  sendInvalidMessage: boolean;
  onSendInvalidMessageChange: (next: boolean) => void;
}

/** The draft as the rows' value: the inheritable keys as they are, the
 *  concrete verification switch read as absent at its default. */
function valueOf(draft: GrpcDraft): GrpcSettingsValue {
  return {
    ...sliceOf(draft, GRPC_INHERITABLE_SETTING_KEYS),
    authority: draft.authority,
    sslVerification: draft.sslVerification ? undefined : false,
  };
}

const GrpcSettingsTab: React.FC<GrpcSettingsTabProps> = ({
  draft,
  setDraft,
  sendInvalidMessage,
  onSendInvalidMessageChange,
}) => (
  <GrpcSettingsRows
    value={valueOf(draft)}
    onChange={(next) => setDraft((d) => ({ ...d, ...next, sslVerification: next.sslVerification !== false }))}
    messages={{ sendInvalidMessage, onSendInvalidMessageChange }}
  />
);

export default GrpcSettingsTab;
