/**
 * Pure template-reference scanner.
 *
 * Given a template string, returns the Live Variable + step-capture
 * references it contains. Consumed by:
 *   - `cycle-detect` — walks the LV → workflow → step request →
 *     `{{live.X}}` graph.
 *   - `step-validation` — enforces step forward-reference discipline
 *     within a workflow.
 *   - Extension DNR compile — reference-counts LVs referenced by
 *     rules so a refresh only rebuilds affected rules.
 *
 * Results are deduped; the caller gets unique names. Other
 * namespaces (env, vault, workspace, collection, file, dynamic) are
 * returned verbatim in `other` so callers can extend analysis without
 * re-scanning the string.
 */

import { parseReference, parseStepRefName, type VariableReference } from '../variables/namespaces';

// ── Result ─────────────────────────────────────────────────────────

export interface StepRef {
  stepId: string;
  captureName: string;
}

export interface TemplateScanResult {
  /** Unique `{{live.X}}` names referenced (order: first-seen). */
  live: string[];
  /** Unique `{{step.<id>.<capture>}}` references (order: first-seen). */
  step: StepRef[];
  /** All other valid `{{ns.X}}` references — useful for broader analysis. */
  other: VariableReference[];
}

const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

export function scanTemplateReferences(template: string): TemplateScanResult {
  const live = new Set<string>();
  const liveOrder: string[] = [];
  const stepSeen = new Set<string>();
  const step: StepRef[] = [];
  const other: VariableReference[] = [];

  // Reset regex state per call — the global flag carries lastIndex
  // otherwise, and the caller might reuse the module-level constant.
  const re = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
  let match: RegExpExecArray | null = re.exec(template);
  while (match !== null) {
    const parsed = parseReference(match[1]);
    if (parsed.ok) {
      const { ref } = parsed;
      if (ref.namespace === 'live') {
        if (!live.has(ref.name)) {
          live.add(ref.name);
          liveOrder.push(ref.name);
        }
      } else if (ref.namespace === 'step') {
        const parts = parseStepRefName(ref.name);
        if (parts) {
          const key = `${parts.stepId}.${parts.captureName}`;
          if (!stepSeen.has(key)) {
            stepSeen.add(key);
            step.push(parts);
          }
        }
      } else {
        other.push(ref);
      }
    }
    match = re.exec(template);
  }

  return { live: liveOrder, step, other };
}

/**
 * Aggregate {@link scanTemplateReferences} across multiple templates
 * (e.g. every URL + header + body inside a single request). The
 * dedupe semantics apply across the full batch.
 */
export function scanTemplateReferencesMany(templates: readonly string[]): TemplateScanResult {
  const live = new Set<string>();
  const liveOrder: string[] = [];
  const stepSeen = new Set<string>();
  const step: StepRef[] = [];
  const other: VariableReference[] = [];

  for (const t of templates) {
    const r = scanTemplateReferences(t);
    for (const n of r.live) {
      if (!live.has(n)) {
        live.add(n);
        liveOrder.push(n);
      }
    }
    for (const s of r.step) {
      const key = `${s.stepId}.${s.captureName}`;
      if (!stepSeen.has(key)) {
        stepSeen.add(key);
        step.push(s);
      }
    }
    for (const o of r.other) other.push(o);
  }

  return { live: liveOrder, step, other };
}
