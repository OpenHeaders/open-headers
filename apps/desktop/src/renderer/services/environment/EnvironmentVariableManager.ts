/**
 * EnvironmentVariableManager - Manages environment variables and operations
 */

import type { Environment, EnvironmentVariable } from '@openheaders/core';
import { createLogger } from '@/renderer/utils/error-handling/logger';

const _log = createLogger('EnvironmentVariableManager');

class EnvironmentVariableManager {
  getAllVariables(environments: Environment[], activeEnvironmentId: string | null): Record<string, string> {
    if (!activeEnvironmentId) return {};
    const env = environments.find((e) => e.id === activeEnvironmentId);
    if (!env) return {};

    const result: Record<string, string> = {};
    for (const [key, variable] of Object.entries(env.variables)) {
      result[key] = variable.value ?? '';
    }
    return result;
  }

  getVariableCount(environments: Environment[], environmentId: string): number {
    const env = environments.find((e) => e.id === environmentId);
    return env ? Object.keys(env.variables).length : 0;
  }

  exportEnvironment(environments: Environment[], environmentId: string, format = 'json'): string {
    const env = environments.find((e) => e.id === environmentId);
    if (!env) {
      throw new Error(`Environment '${environmentId}' does not exist`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(env.variables, null, 2);

      case 'env':
        return Object.entries(env.variables)
          .map(([key, variable]) => `${key}=${variable.value ?? ''}`)
          .join('\n');

      case 'shell':
        return Object.entries(env.variables)
          .map(([key, variable]) => `export ${key}="${variable.value ?? ''}"`)
          .join('\n');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  importEnvironment(data: string, format = 'json'): Record<string, EnvironmentVariable> {
    const variables: Record<string, EnvironmentVariable> = {};

    switch (format) {
      case 'json': {
        const parsed = JSON.parse(data) as Record<string, EnvironmentVariable | string>;
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'object' && value !== null && 'value' in value) {
            variables[key] = value;
          } else {
            variables[key] = {
              value: String(value),
              isSensitive: false,
              updatedAt: new Date().toISOString(),
            };
          }
        }
        break;
      }

      case 'env':
        for (const line of data.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key) {
              variables[key.trim()] = {
                value: valueParts.join('=').trim(),
                isSensitive: false,
                updatedAt: new Date().toISOString(),
              };
            }
          }
        }
        break;

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }

    return variables;
  }
}

export default EnvironmentVariableManager;
