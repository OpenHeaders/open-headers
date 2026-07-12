/**
 * NeDB-store interpretation: all `insomnia.*.db` files fold into one
 * finding over the combined docs, counted by the existing importer.
 */

import { parseInsomniaDocs } from '../insomnia';
import { parseNedbLines } from './nedb';
import type { DataScanSkip, InsomniaNedbFinding, ScannedFile } from './types';

export function interpretInsomniaStores(
  dir: string,
  files: readonly ScannedFile[],
): { findings: InsomniaNedbFinding[]; skipped: DataScanSkip[] } {
  if (files.length === 0) return { findings: [], skipped: [] };
  const skipped: DataScanSkip[] = [];
  const docs: unknown[] = [];
  for (const file of files) {
    const { docs: fileDocs, badLines } = parseNedbLines(file.text);
    docs.push(...fileDocs);
    if (badLines > 0) {
      skipped.push({
        path: file.path,
        reason: `${badLines} unparseable line${badLines === 1 ? '' : 's'} skipped (interrupted journal append).`,
      });
    }
  }
  const parsed = parseInsomniaDocs(docs);
  return {
    findings: [
      {
        tool: 'insomnia',
        store: 'insomnia-nedb',
        dir,
        files: files.map((file) => file.path),
        counts: {
          collections: parsed.collections.length,
          environments: parsed.environments.length,
          requests: parsed.collections.reduce((n, collection) => n + collection.requests.length, 0),
        },
      },
    ],
    skipped,
  };
}
