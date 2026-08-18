/**
 * Snapshot-vocabulary tripwire — every per-workspace entity kind the
 * registry knows must have a slot in the wire snapshot.
 *
 * A kind missing from {@link WorkspaceSnapshot} silently vanishes on
 * every snapshot-bootstrap join AND on workspace duplicate, and the
 * SYNCED watermark then covers its mutations so no delta ever
 * backfills it (the gRPC/spec loss the 2026-08 live pass surfaced —
 * seven kinds had been added to the registry without ever entering
 * the snapshot). Adding a new per-workspace kind must extend the
 * mapping below, the protocol interface + schema, the builder, and
 * the applier — this test fails until the mapping half is done, and
 * the required interface keys force the builder/applier half through
 * the type-checker.
 */

import { WorkspaceSnapshotSchema } from '@openheaders/core/protocol';
import { describe, expect, it } from 'vitest';

import { WORKSPACE_REGISTRY } from '../../src/sync/entity-registry';

/** Registry entityType → WorkspaceSnapshot key. */
const SNAPSHOT_KEY_BY_ENTITY_TYPE: Record<string, string> = {
  rule: 'rules',
  environment: 'environments',
  collection: 'collections',
  folder: 'folders',
  'workspace-variables': 'workspaceVariables',
  vault: 'vault',
  request: 'requests',
  grpcRequest: 'grpcRequests',
  websocketRequest: 'websocketRequests',
  'request-collection': 'requestCollections',
  'request-folder': 'requestFolders',
  'response-example': 'responseExamples',
  grpcResponseExample: 'grpcResponseExamples',
  wsResponseExample: 'wsResponseExamples',
  template: 'templates',
  'template-collection': 'templateCollections',
  'template-folder': 'templateFolders',
  'live-variable': 'liveVariables',
  'live-workflow': 'liveWorkflows',
  'script-package': 'scriptPackages',
  spec: 'specs',
  'live-value': 'liveValues',
  'live-fallback-priority': 'liveFallbackPriority',
  'oauth-bundle': 'oauthBundles',
  'pause-markers': 'pauseMarkers',
  'layout-state': 'layoutState',
  files: 'files',
};

describe('workspace snapshot vocabulary', () => {
  const schemaKeys = new Set(Object.keys(WorkspaceSnapshotSchema.entries));

  it('carries a slot for every registered per-workspace entity kind', () => {
    for (const registration of WORKSPACE_REGISTRY) {
      const key = SNAPSHOT_KEY_BY_ENTITY_TYPE[registration.entityType];
      expect(key, `entityType "${registration.entityType}" has no snapshot mapping`).toBeDefined();
      expect(schemaKeys.has(key), `snapshot schema is missing "${key}" (entityType "${registration.entityType}")`).toBe(
        true,
      );
    }
  });

  it('maps no stale kinds the registry no longer knows', () => {
    const registered = new Set(WORKSPACE_REGISTRY.map((r) => r.entityType));
    for (const entityType of Object.keys(SNAPSHOT_KEY_BY_ENTITY_TYPE)) {
      expect(registered.has(entityType), `mapping names unregistered entityType "${entityType}"`).toBe(true);
    }
  });
});
