/**
 * Environment — key/value container for template variables.
 *
 * Environments hold variables (some secret) that are injected
 * into header rules and HTTP source requests via {{VAR_NAME}} syntax.
 * They are organized within collections/folders like sources and rules.
 */

export interface EnvironmentVariable {
  value: string;
  isSensitive: boolean;
  description?: string;
  updatedAt?: string;
}

export interface Environment {
  id: string;
  name: string;
  collectionId?: string;
  folderId?: string;
  variables: Record<string, EnvironmentVariable>;
  createdAt?: string;
  updatedAt?: string;
}
