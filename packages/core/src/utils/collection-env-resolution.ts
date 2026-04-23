export type CollectionEnvOverride = string | null;
// string = envId, null = explicit "No environment"
// key absent in map = no override (auto-switch applies)

export function resolveCollectionEnv(params: {
  collectionId: string | null;
  collections: ReadonlyArray<{ uid: string; defaultEnvironmentId?: string | null }>;
  overrides: Readonly<Record<string, CollectionEnvOverride>>;
  globalActiveEnvId: string | null;
  knownEnvIds: ReadonlySet<string>;
}): string | null {
  const { collectionId, collections, overrides, globalActiveEnvId, knownEnvIds } = params;
  if (!collectionId) return globalActiveEnvId;

  if (collectionId in overrides) {
    const ov = overrides[collectionId];
    if (ov === null) return null;
    if (knownEnvIds.has(ov)) return ov;
    // override points to deleted env — fall through to default
  }

  const col = collections.find((c) => c.uid === collectionId);
  const defaultId = col?.defaultEnvironmentId ?? null;
  if (defaultId && knownEnvIds.has(defaultId)) return defaultId;

  return globalActiveEnvId;
}
