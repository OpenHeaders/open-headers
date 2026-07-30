/**
 * GrpcRequest mutator catalog — routing constants.
 *
 * One set-modeled path lives on the GrpcRequest entity:
 *
 *   - `metadata` — metadata pair rows (`{ key, value, description?, enabled? }`)
 *
 * Every other field — `name`, `description`, `url`, `tls`, `method`,
 * `message`, `auth`, `specLink`, `unixSocketPath`, `timeoutMs`,
 * `sslVerification` — flows through `setField` scalars. `method`, `auth`, and `specLink`
 * are small objects; they route through the per-leaf flatten-diff at
 * the write site (the same treatment `auth` / `body` get on the HTTP
 * request) so edits share create's leaf representation.
 *
 * No side effects: gRPC requests don't feed DNR and don't touch the
 * variables resolver.
 */

/** Routing key carried on every gRPC-request mutation envelope. */
export const GRPC_REQUEST_ENTITY_TYPE = 'grpcRequest';

/** Set path for metadata pair rows. */
export const GRPC_REQUEST_METADATA_PATH = 'metadata';

/**
 * Wire shape for a metadata pair row. Mirrors `GrpcMetadataPair`
 * field-for-field but typed locally so the catalog stays decoupled
 * from `@openheaders/core/types` (the same way other catalogs keep
 * their row shapes local).
 */
export interface GrpcMetadataPairRow {
  /** Persisted per-row identity; doubles as the sync engine's itemId. */
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
}
