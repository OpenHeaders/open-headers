/**
 * three-way-patch — one change (`from` → `to`) laid over a value that
 * has moved on its own since (`current`). Never a textual merge and
 * never a conflict: what the change did not touch stays as it stands,
 * what it touched takes the change's value. A value BOTH sides changed
 * is counted, and goes to the side the caller keeps there — the
 * change's unless it asks for the current one.
 *
 * The grain is a record's own keys. A key holding a list of identified
 * members — rows carrying a `uid`, or an `order:` list of names — is
 * patched member by member, so the rows the current side added or
 * edited on its own survive: a member the change added lands beside
 * the neighbour it followed, a member it removed leaves, a member it
 * edited takes the edit, and a reorder is replayed over the members
 * both sides know. Any other value the change touched is taken whole.
 */

import { canonicalJson } from '../sync';

/** Counts the values BOTH sides changed — each went to the side kept there. */
export interface PatchTally {
  overridden: number;
}

/** Whose value stands where both sides changed one: the change's, or the current side's. */
export type PatchKeep = 'change' | 'current';

/** A keyed value — an entity, a singleton document, or one row of a list. */
export type Row = Record<string, unknown>;

const differs = (a: unknown, b: unknown): boolean => canonicalJson(a) !== canonicalJson(b);

const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A list member's identity: the name itself, or a row's `uid`. */
function memberId(member: unknown): string | null {
  if (typeof member === 'string') return member;
  return isRow(member) && typeof member.uid === 'string' ? member.uid : null;
}

/** The members by identity, or null when one has none or two share one. */
function indexMembers(list: readonly unknown[]): Map<string, unknown> | null {
  const byId = new Map<string, unknown>();
  for (const member of list) {
    const id = memberId(member);
    if (id === null || byId.has(id)) return null;
    byId.set(id, member);
  }
  return byId;
}

/**
 * `current` with the keys the change touched taken from `to` (a key the
 * change removed leaves). `from` undefined = the change created the
 * record, so every key of `to` is its own. `skip` names keys the caller
 * decides itself; `keep` rules the values both sides changed.
 */
export function patchRecord<T extends Row>(
  current: T,
  from: T | undefined,
  to: T,
  skip: ReadonlySet<string>,
  tally: PatchTally,
  keep: PatchKeep = 'change',
): T {
  const before: Row = { ...from };
  const after: Row = { ...to };
  const out: Row = { ...current };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (skip.has(key) || !differs(before[key], after[key])) continue;
    const next = patchValue(out[key], before[key], after[key], tally, keep);
    if (next === undefined) delete out[key];
    else out[key] = next;
  }
  return out as T;
}

function patchValue(current: unknown, from: unknown, to: unknown, tally: PatchTally, keep: PatchKeep): unknown {
  if (Array.isArray(current) && Array.isArray(to)) {
    const before = Array.isArray(from) ? from : [];
    const currentById = indexMembers(current);
    const fromById = indexMembers(before);
    const toById = indexMembers(to);
    if (currentById !== null && fromById !== null && toById !== null) {
      return patchList(current, before, to, { currentById, fromById, toById }, tally, keep);
    }
  }
  if (differs(current, from) && differs(current, to)) {
    tally.overridden += 1;
    if (keep === 'current') return current;
  }
  return to;
}

interface ListIndex {
  currentById: Map<string, unknown>;
  fromById: Map<string, unknown>;
  toById: Map<string, unknown>;
}

function patchList(
  current: readonly unknown[],
  from: readonly unknown[],
  to: readonly unknown[],
  index: ListIndex,
  tally: PatchTally,
  keep: PatchKeep,
): unknown[] {
  const { currentById, fromById, toById } = index;
  const ids = (list: readonly unknown[]): string[] => list.flatMap((member) => memberId(member) ?? []);

  // Removals and edits, over the members the current side holds.
  const out: unknown[] = [];
  for (const member of current) {
    const id = memberId(member);
    if (id === null) continue;
    const before = fromById.get(id);
    if (!toById.has(id)) {
      if (!fromById.has(id)) out.push(member);
      else if (differs(member, before)) {
        // Removed by the change, edited by the current side.
        tally.overridden += 1;
        if (keep === 'current') out.push(member);
      }
      continue;
    }
    const after = toById.get(id);
    out.push(differs(before, after) ? patchMember(member, before, after, tally, keep) : member);
  }

  // A reorder of the members both ends of the change hold, replayed
  // over the positions those members take on the current side.
  const kept = ids(from).filter((id) => toById.has(id));
  const reordered = ids(to).filter((id) => fromById.has(id));
  if (kept.join('\n') !== reordered.join('\n')) {
    const moving = new Set(reordered);
    const sequence = reordered.filter((id) => currentById.has(id)).map((id) => out.find((m) => memberId(m) === id));
    let cursor = 0;
    for (let i = 0; i < out.length; i += 1) {
      const id = memberId(out[i]);
      if (id !== null && moving.has(id)) {
        out[i] = sequence[cursor];
        cursor += 1;
      }
    }
  }

  // Additions, each beside the neighbour it follows in the change —
  // else before the one it precedes, else at the end.
  const order = ids(to);
  for (let i = 0; i < order.length; i += 1) {
    const id = order[i];
    if (fromById.has(id) || currentById.has(id)) continue;
    const position = (anchor: string): number => out.findIndex((member) => memberId(member) === anchor);
    const preceding = order
      .slice(0, i)
      .reverse()
      .map(position)
      .find((at) => at !== -1);
    const following = order
      .slice(i + 1)
      .map(position)
      .find((at) => at !== -1);
    const at = preceding !== undefined ? preceding + 1 : (following ?? out.length);
    out.splice(at, 0, toById.get(id));
  }
  return out;
}

/**
 * One member the change edited. A row whose keys still match the
 * change's starting row is patched key by key — the result carries
 * exactly the edited row's shape; a row that has drifted to another
 * shape (a different variant) takes the edited row whole.
 */
function patchMember(current: unknown, from: unknown, to: unknown, tally: PatchTally, keep: PatchKeep): unknown {
  if (!differs(current, from)) return to;
  if (isRow(current) && isRow(from) && isRow(to) && sameKeys(current, from)) {
    return patchRecord(current, from, to, NO_SKIP, tally, keep);
  }
  if (differs(current, to)) {
    tally.overridden += 1;
    if (keep === 'current') return current;
  }
  return to;
}

const NO_SKIP: ReadonlySet<string> = new Set();

function sameKeys(a: Row, b: Row): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b);
}
