/**
 * GrpcSettingsTab — the request's Settings tab: the shared gRPC rows
 * (`GrpcSettingsRows`, the same rows a container's Settings section
 * renders) over the editor draft, plus the Messages group's app-wide
 * send-invalid-message posture (the SAME setting as Settings →
 * Requests and the header ⋯ toggle, not a per-request field). The
 * rows sit on the ANCESTOR PLANE: the inheritable knobs ride the draft
 * tri-state (`undefined` = inherit / the runtime default, an explicit
 * value = the request's own — explicit wins) and pass straight
 * through, reading their placeholders, the verification switch's
 * effective state and the "Inherited from …" line off the view the
 * editor derives from the request's ancestry. There is no
 * saved-baseline (unsaved) plane here; the editor's own dirty
 * fingerprint covers "not saved yet".
 */

import { GRPC_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { type InheritedSettingsView, sliceOf } from '../shared/inherited-settings/inherited-settings';
import type { GrpcDraft } from './draft';
import GrpcSettingsRows, { type GrpcSettingsValue } from './GrpcSettingsRows';

interface GrpcSettingsTabProps {
  draft: GrpcDraft;
  setDraft: Dispatch<SetStateAction<GrpcDraft>>;
  sendInvalidMessage: boolean;
  onSendInvalidMessageChange: (next: boolean) => void;
  /** The ancestor plane — see the rows. */
  inherited?: InheritedSettingsView;
}

/** The draft as the rows' value: the inheritable keys as they are plus
 *  the request-only authority. */
function valueOf(draft: GrpcDraft): GrpcSettingsValue {
  return { ...sliceOf(draft, GRPC_INHERITABLE_SETTING_KEYS), authority: draft.authority };
}

const GrpcSettingsTab: React.FC<GrpcSettingsTabProps> = ({
  draft,
  setDraft,
  sendInvalidMessage,
  onSendInvalidMessageChange,
  inherited,
}) => (
  <GrpcSettingsRows
    value={valueOf(draft)}
    onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
    messages={{ sendInvalidMessage, onSendInvalidMessageChange }}
    inherited={inherited}
  />
);

export default GrpcSettingsTab;
