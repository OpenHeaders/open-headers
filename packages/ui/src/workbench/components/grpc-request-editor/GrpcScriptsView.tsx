/**
 * GrpcScriptsView — the gRPC result panes' Scripts view: the shared
 * session-scripts view (Console per mark under a hook · frame heading,
 * Tests across marks) under the gRPC vocabulary.
 */

import type React from 'react';
import SessionScriptsView from '../session-scripts/SessionScriptsView';
import { GRPC_SCRIPTS_VOCABULARY, type GrpcScriptMarkItem } from './grpc-scripts';

interface GrpcScriptsViewProps {
  marks: readonly GrpcScriptMarkItem[];
  /** The per-event marks stopped at the cap — the tallies kept going. */
  marksCapped?: boolean;
}

const GrpcScriptsView: React.FC<GrpcScriptsViewProps> = ({ marks, marksCapped = false }) => (
  <SessionScriptsView marks={marks} marksCapped={marksCapped} vocabulary={GRPC_SCRIPTS_VOCABULARY} />
);

export default GrpcScriptsView;
