/**
 * System variables — built-in dynamic variables available in every workspace.
 *
 * These are resolved at request time and cannot be edited by the user.
 */

export interface SystemVariable {
  /** Variable name including $ prefix (e.g. "$timestamp") */
  name: string;
  /** Short description shown in the readonly table */
  description: string;
  /** Category for grouping in the UI */
  category: 'time' | 'id' | 'random' | 'network';
}

export const SYSTEM_VARIABLES: readonly SystemVariable[] = [
  // Time
  { name: '$timestamp', description: 'Current Unix timestamp (seconds)', category: 'time' },
  { name: '$isoTimestamp', description: 'Current ISO 8601 timestamp', category: 'time' },

  // IDs
  { name: '$guid', description: 'UUID v4 (e.g. "d9eef54b-1c2a-4e3f-…")', category: 'id' },
  { name: '$randomUUID', description: 'UUID v4 (alias for $guid)', category: 'id' },

  // Random values
  { name: '$randomInt', description: 'Random integer between 0 and 1000', category: 'random' },
  { name: '$randomAlphaNumeric', description: 'Random alphanumeric character', category: 'random' },
  { name: '$randomColor', description: 'Random hex color (e.g. "#a3e2c1")', category: 'random' },
  { name: '$randomBoolean', description: 'Random "true" or "false"', category: 'random' },
  { name: '$randomEmail', description: 'Random email address', category: 'random' },
  { name: '$randomIP', description: 'Random IPv4 address', category: 'random' },
  { name: '$randomUserAgent', description: 'Random browser user agent string', category: 'random' },
  { name: '$randomFirstName', description: 'Random first name', category: 'random' },
  { name: '$randomLastName', description: 'Random last name', category: 'random' },
  { name: '$randomWord', description: 'Random dictionary word', category: 'random' },
  { name: '$randomLoremSentence', description: 'Random Lorem Ipsum sentence', category: 'random' },
] as const;
