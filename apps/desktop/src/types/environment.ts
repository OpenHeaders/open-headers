/**
 * Environment types for the desktop app.
 *
 * Re-exports V5 environment types and adds desktop-specific helpers.
 */

import type { V5 } from '@openheaders/core/types';

// Re-export core types for convenience
export type Environment = V5.Environment;
export type Variable = V5.Variable;

/**
 * Persisted environments state (tracks which environment is active).
 */
export interface EnvironmentsState {
  environments: V5.Environment[];
  activeEnvironmentName: string | null;
}

/**
 * Create an independent deep copy of an Environment array.
 */
export function cloneEnvironments(environments: V5.Environment[]): V5.Environment[] {
  return environments.map((env) => ({
    ...env,
    variables: env.variables.map((v) => ({ ...v })),
  }));
}
