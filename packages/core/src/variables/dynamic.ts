/**
 * Dynamic generators — the `{{dynamic.*}}` namespace.
 *
 * Each generator produces a fresh value on every template resolution:
 * per send in the API client / workflows, per rule compile on the
 * static-rule path (the value is baked into the compiled rule and
 * regenerates on the next recompile).
 *
 * Pure module — the clock / RNG / UUID source is injected through
 * {@link DynamicRuntime} so tests pin outputs deterministically; the
 * default runtime binds the platform globals.
 */

// ── Runtime injection ──────────────────────────────────────────────

export interface DynamicRuntime {
  /** Milliseconds since the Unix epoch. */
  now(): number;
  /** Uniform float in [0, 1). */
  random(): number;
  /** RFC 4122 v4 UUID. */
  uuid(): string;
}

function fallbackUuid(random: () => number): string {
  // v4 layout from the injected RNG — only reached on runtimes without
  // `crypto.randomUUID` (none of our targets, but the module must not
  // throw at import time on exotic hosts).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

export const defaultDynamicRuntime: DynamicRuntime = {
  now: () => Date.now(),
  random: () => Math.random(),
  uuid: () => {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return fallbackUuid(Math.random);
  },
};

// ── Generator catalog ──────────────────────────────────────────────

export interface DynamicGenerator {
  /** Name after the namespace dot — `uuid` for `{{dynamic.uuid}}`. */
  name: string;
  /** Short description shown in suggestion rows and hovers. */
  description: string;
  /** Category for grouping in catalog UIs. */
  category: 'time' | 'id' | 'random';
  generate(rt: DynamicRuntime): string;
}

function randomInt(rt: DynamicRuntime, maxExclusive: number): number {
  return Math.floor(rt.random() * maxExclusive);
}

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOWER_ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const DYNAMIC_GENERATORS: readonly DynamicGenerator[] = [
  {
    name: 'timestamp',
    description: 'Current Unix timestamp (seconds)',
    category: 'time',
    generate: (rt) => String(Math.floor(rt.now() / 1000)),
  },
  {
    name: 'isoTimestamp',
    description: 'Current ISO 8601 timestamp (UTC)',
    category: 'time',
    generate: (rt) => new Date(rt.now()).toISOString(),
  },
  {
    name: 'uuid',
    description: 'UUID v4',
    category: 'id',
    generate: (rt) => rt.uuid(),
  },
  {
    name: 'randomInt',
    description: 'Random integer between 0 and 1000',
    category: 'random',
    generate: (rt) => String(randomInt(rt, 1001)),
  },
  {
    name: 'randomAlphaNumeric',
    description: 'Random alphanumeric character',
    category: 'random',
    generate: (rt) => ALPHANUMERIC[randomInt(rt, ALPHANUMERIC.length)],
  },
  {
    name: 'randomBoolean',
    description: 'Random "true" or "false"',
    category: 'random',
    generate: (rt) => (rt.random() < 0.5 ? 'true' : 'false'),
  },
  {
    name: 'randomColor',
    description: 'Random hex color (e.g. "#a3e2c1")',
    category: 'random',
    generate: (rt) => `#${randomInt(rt, 0x1000000).toString(16).padStart(6, '0')}`,
  },
  {
    name: 'randomEmail',
    description: 'Random email address (example.com)',
    category: 'random',
    generate: (rt) => {
      let local = '';
      for (let i = 0; i < 10; i++) local += LOWER_ALPHANUMERIC[randomInt(rt, LOWER_ALPHANUMERIC.length)];
      return `${local}@example.com`;
    },
  },
  {
    name: 'randomIP',
    description: 'Random IPv4 address',
    category: 'random',
    generate: (rt) =>
      [1 + randomInt(rt, 254), randomInt(rt, 256), randomInt(rt, 256), 1 + randomInt(rt, 254)].join('.'),
  },
] as const;

const GENERATORS_BY_NAME: ReadonlyMap<string, DynamicGenerator> = new Map(
  DYNAMIC_GENERATORS.map((g) => [g.name, g]),
);

/**
 * Generate the value for `{{dynamic.<name>}}`. Returns `null` when no
 * generator carries that name — the resolver surfaces the miss as
 * `unset-in-scope`.
 */
export function resolveDynamicValue(name: string, rt: DynamicRuntime = defaultDynamicRuntime): string | null {
  const generator = GENERATORS_BY_NAME.get(name);
  if (!generator) return null;
  return generator.generate(rt);
}
