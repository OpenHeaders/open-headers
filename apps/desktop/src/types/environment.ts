/**
 * Environment domain types.
 *
 * The core Environment interface lives in @openheaders/core.
 * This file re-exports it and adds desktop-specific persistence types.
 */

// Re-export core types
export type { Environment, EnvironmentVariable } from '@openheaders/core';

/** Variables keyed by name within a single environment (internal use). */
export type EnvironmentVariables = Record<string, import('@openheaders/core').EnvironmentVariable>;

/**
 * Legacy name-keyed environment map. Still used as the wire format for
 * Git sync (remote data) and config import/export. Internal state uses
 * Environment[] instead.
 */
export type EnvironmentMap = Record<string, EnvironmentVariables>;

/**
 * Convert Environment[] to legacy name-keyed EnvironmentMap.
 * Used by v4 renderer components that still expect the old format.
 */
export function toEnvironmentMap(environments: import('@openheaders/core').Environment[]): EnvironmentMap {
  const map: EnvironmentMap = {};
  for (const env of environments) {
    map[env.name] = env.variables;
  }
  return map;
}

/**
 * Create an independent deep copy of an Environment array.
 */
export function cloneEnvironments(
  environments: import('@openheaders/core').Environment[],
): import('@openheaders/core').Environment[] {
  return environments.map((env) => ({
    ...env,
    variables: Object.fromEntries(Object.entries(env.variables).map(([k, v]) => [k, { ...v }])),
  }));
}

// ── Persisted file shape (environments.json) ────────────────────────

export interface EnvironmentsFile {
  environments: import('@openheaders/core').Environment[];
  activeEnvironment: string | null;
}

// ── Environment config sharing ──────────────────────────────────────

export interface EnvironmentSchemaVariable {
  name: string;
  isSensitive: boolean;
}

export interface EnvironmentSchemaEntry {
  variables: EnvironmentSchemaVariable[];
}

export interface EnvironmentSchema {
  environments: Record<string, EnvironmentSchemaEntry>;
}

export interface EnvironmentConfigData {
  version: string;
  environments?: EnvironmentMap;
  environmentSchema?: EnvironmentSchema;
}
