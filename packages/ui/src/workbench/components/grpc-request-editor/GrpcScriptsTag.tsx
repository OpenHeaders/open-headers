/**
 * GrpcScriptsTag — the gRPC result panes' meta-strip scripts
 * attribution: the shared session-scripts tag under the gRPC
 * vocabulary ("Scripts · N", the hooks that ran with their levels).
 */

import type React from 'react';
import SessionScriptsTag from '../session-scripts/SessionScriptsTag';
import { GRPC_SCRIPTS_VOCABULARY, type GrpcScriptsDigest } from './grpc-scripts';

const GrpcScriptsTag: React.FC<{ digest: GrpcScriptsDigest }> = ({ digest }) => (
  <SessionScriptsTag digest={digest} vocabulary={GRPC_SCRIPTS_VOCABULARY} />
);

export default GrpcScriptsTag;
