/**
 * NeDB journal reader — one JSON doc per line, appended: the last
 * occurrence of an `_id` wins and a doc carrying `$$deleted` retracts
 * it. Unparseable lines are counted, not fatal (an interrupted append
 * truncates the tail). Single pass, no line array retained.
 */

import { isRecord } from './json';

export function parseNedbLines(text: string): { docs: unknown[]; badLines: number } {
  const byId = new Map<string, unknown>();
  const anonymous: unknown[] = [];
  let badLines = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let doc: unknown;
    try {
      doc = JSON.parse(trimmed);
    } catch {
      badLines++;
      continue;
    }
    if (!isRecord(doc)) {
      badLines++;
      continue;
    }
    const id = typeof doc._id === 'string' ? doc._id : null;
    if (id === null) {
      anonymous.push(doc);
      continue;
    }
    if (doc.$$deleted === true) byId.delete(id);
    else byId.set(id, doc);
  }
  return { docs: [...byId.values(), ...anonymous], badLines };
}
