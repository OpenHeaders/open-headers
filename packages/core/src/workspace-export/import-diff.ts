/**
 * Pure diff between an incoming `WorkspaceExport` envelope and a prior
 * import's `perEntityStrategies` snapshot — drives the
 * "show changes since last import" affordance on the soft-dedup banner
 * (design §5.2, PR 5 polish).
 *
 * The prior import's report carries only the strategies map (keys
 * `<entityType>:<uid>`), not the full envelope. So the diff is one-
 * sided: for each entity type we tally
 *   • `prior`  — uids the prior import touched
 *   • `incoming` — uids in the incoming envelope
 *   • `newUids` — uids in incoming that the prior import didn't
 *      touch (kept stable so the UI can render names)
 *   • `removedUids` — uids the prior import touched but the incoming
 *      envelope no longer carries
 *   • `keptUids` — uids in both
 *
 * Pure transform; no I/O. Lives in core so the desktop app can reuse
 * the same diff if it ever surfaces the same UX.
 */

import type { WorkspaceExport } from './schema';

export type ImportDiffEntityType =
  | 'rules'
  | 'requests'
  | 'templates'
  | 'environments'
  | 'liveWorkflows'
  | 'liveVariables'
  | 'collections'
  | 'folders';

export interface ImportDiffSection {
  type: ImportDiffEntityType;
  prior: number;
  incoming: number;
  newUids: { uid: string; name: string }[];
  removedUids: string[];
  keptUids: string[];
}

export interface ImportSinceLastDiff {
  sections: ImportDiffSection[];
  totals: {
    prior: number;
    incoming: number;
    new: number;
    removed: number;
    kept: number;
  };
}

const TYPES: ImportDiffEntityType[] = [
  'rules',
  'requests',
  'templates',
  'environments',
  'liveWorkflows',
  'liveVariables',
  'collections',
  'folders',
];

function priorUidsByType(strategies: Record<string, unknown>): Map<ImportDiffEntityType, Set<string>> {
  const out = new Map<ImportDiffEntityType, Set<string>>();
  for (const t of TYPES) out.set(t, new Set<string>());
  for (const key of Object.keys(strategies)) {
    const idx = key.indexOf(':');
    if (idx <= 0) continue;
    const type = key.slice(0, idx) as ImportDiffEntityType;
    const uid = key.slice(idx + 1);
    const bucket = out.get(type);
    if (bucket) bucket.add(uid);
  }
  return out;
}

function incomingByType(envelope: WorkspaceExport): Map<ImportDiffEntityType, { uid: string; name: string }[]> {
  const e = envelope.entities;
  return new Map<ImportDiffEntityType, { uid: string; name: string }[]>([
    ['rules', e.rules.map((r) => ({ uid: r.uid, name: r.name }))],
    ['requests', e.requests.map((r) => ({ uid: r.uid, name: r.name }))],
    ['templates', e.templates.map((t) => ({ uid: t.uid, name: t.name }))],
    ['environments', e.environments.map((env) => ({ uid: env.uid, name: env.name }))],
    ['liveWorkflows', e.liveWorkflows.map((wf) => ({ uid: wf.uid, name: wf.name }))],
    ['liveVariables', e.liveVariables.map((lv) => ({ uid: lv.uid, name: lv.name }))],
    ['collections', e.collections.map((c) => ({ uid: c.uid, name: c.name }))],
    ['folders', e.folders.map((f) => ({ uid: f.uid, name: f.name }))],
  ]);
}

export function diffIncomingAgainstPriorImport(
  incoming: WorkspaceExport,
  priorStrategies: Record<string, unknown>,
): ImportSinceLastDiff {
  const priorByType = priorUidsByType(priorStrategies);
  const incomingByT = incomingByType(incoming);

  const sections: ImportDiffSection[] = [];
  const totals = { prior: 0, incoming: 0, new: 0, removed: 0, kept: 0 };

  for (const t of TYPES) {
    const prior = priorByType.get(t) ?? new Set<string>();
    const inc = incomingByT.get(t) ?? [];
    const incUids = new Set(inc.map((x) => x.uid));

    const newUids = inc.filter((x) => !prior.has(x.uid));
    const removedUids = [...prior].filter((u) => !incUids.has(u));
    const keptUids = [...prior].filter((u) => incUids.has(u));

    sections.push({
      type: t,
      prior: prior.size,
      incoming: inc.length,
      newUids,
      removedUids,
      keptUids,
    });

    totals.prior += prior.size;
    totals.incoming += inc.length;
    totals.new += newUids.length;
    totals.removed += removedUids.length;
    totals.kept += keptUids.length;
  }

  return { sections, totals };
}
