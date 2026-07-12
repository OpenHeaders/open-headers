import { type ImportReport, recordTransform } from '../report';
import { isRecord } from './normalize';
import { rewriteTemplateRefs } from './request';
import type { InsomniaDoc, InsomniaParsedEnvironment, InsomniaParsedEnvironmentVariable } from './types';

// ── Environment flattening ─────────────────────────────────────────

/**
 * Insomnia environments hold arbitrary JSON under `data`, referenced
 * as `_.a.b` from templates. Flattening nested objects to dotted
 * names (`a.b`) keeps every rewritten `{{a.b}}` reference resolving
 * against the imported environment. Scalars coerce via `String(…)`
 * (matching the Postman environment importer); arrays keep their JSON
 * text so no value is lost.
 */
export function flattenEnvironmentData(data: Record<string, unknown>): InsomniaParsedEnvironmentVariable[] {
  const out: InsomniaParsedEnvironmentVariable[] = [];
  const walk = (prefix: string, value: Record<string, unknown>): void => {
    for (const [key, v] of Object.entries(value)) {
      const name = prefix.length > 0 ? `${prefix}.${key}` : key;
      if (isRecord(v)) {
        walk(name, v);
        continue;
      }
      const raw = typeof v === 'string' ? v : Array.isArray(v) ? JSON.stringify(v) : String(v ?? '');
      out.push({ name, value: rewriteTemplateRefs(raw).value, type: 'default' });
    }
  };
  walk('', data);
  return out;
}

/**
 * Emit destination environments from the doc set. Insomnia resolves a
 * sub-environment on top of its base environment; that resolution is
 * baked in here — each sub-environment lands flattened with the base
 * values underneath (sub wins), recorded as a transform. A base with
 * no sub-environments lands as-is.
 */
export function collectEnvironments(docs: InsomniaDoc[], report: ImportReport): InsomniaParsedEnvironment[] {
  const envDocs = docs.filter((d) => d.kind === 'environment');
  const envIds = new Set(envDocs.map((e) => e.id));
  const out: InsomniaParsedEnvironment[] = [];

  for (const base of envDocs) {
    if (base.parentId !== null && envIds.has(base.parentId)) continue; // sub — handled under its base
    const subs = envDocs.filter((e) => e.parentId === base.id);
    const baseVars = flattenEnvironmentData(base.data ?? {});
    if (subs.length === 0) {
      if (baseVars.length > 0) out.push({ name: base.name, variables: baseVars });
      continue;
    }
    for (const sub of subs) {
      const merged = new Map(baseVars.map((v) => [v.name, v]));
      for (const v of flattenEnvironmentData(sub.data ?? {})) merged.set(v.name, v);
      out.push({ name: sub.name, variables: [...merged.values()] });
      if (baseVars.length > 0) {
        recordTransform(report, {
          path: `environments["${sub.name}"]`,
          from: `sub-environment of "${base.name}"`,
          to: 'flattened environment',
          reason:
            'Insomnia sub-environments inherit their base environment; the base values were merged in (sub wins) so resolution stays identical.',
          tracking: 'PERMANENT: environment flattening',
        });
      }
    }
  }
  return out;
}
