/**
 * `DaemonConfig` TypeScript type — derived from
 * `../schemas/daemon-config.ts`. The host-install id stored on this
 * record seeds the deterministic synthetic identity UUIDs at bootstrap
 * (the unified-oracle model §5.1).
 */

import type * as v from 'valibot';
import type { DaemonConfigSchema } from '../schemas/daemon-config';

export type DaemonConfig = v.InferOutput<typeof DaemonConfigSchema>;
