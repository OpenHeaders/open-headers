/**
 * Post-process YAML for the conflict diff editor so Monaco's line-by-line
 * diff doesn't greedily cross-match identical scalar lines from
 * different array rows.
 *
 * Concrete failure mode: two rule rows with the same value
 * (e.g. `value: "3"`) make Monaco's diff align them across rows,
 * inserting hatched gaps that visually orphan a row's value from its
 * own `headerName` line.
 *
 * Mitigation: walk the YAML, track the current array-row uid, and
 * append `  # <uid>` ONLY to lines that have a duplicate elsewhere in
 * the document. Unique lines stay clean — most rows look identical to
 * what's on disk; only the lines that would actually confuse the diff
 * algorithm get tagged.
 *
 * Applied identically to both panes — the trailer is for visual
 * alignment only, never reaches disk.
 */

const ROW_START = /^(\s*)-\s+uid:\s+([a-z0-9]{8})/;

export function decorateYamlForDiff(yaml: string): string {
  const lines = yaml.split('\n');

  // First pass: count occurrences of each non-blank line (trimmed) so
  // we know which lines actually need disambiguation. A line that
  // appears once in the document can never be cross-matched by the
  // diff algorithm — leave it untouched.
  const counts = new Map<string, number>();
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  // Second pass: walk rows, decorating only duplicated lines with
  // their owning uid. The `- uid: <uid>` row marker is itself unique
  // (uids don't repeat across rows) so it never needs decoration; it
  // only serves as the anchor for tagging the lines below it.
  let currentUid: string | null = null;
  let rowIndent = -1;
  const out: string[] = [];
  for (const raw of lines) {
    const m = ROW_START.exec(raw);
    if (m) {
      rowIndent = m[1].length;
      currentUid = m[2];
      out.push(raw);
      continue;
    }
    if (currentUid !== null) {
      // Detect the boundary: a line that's not indented deeper than
      // the row's `- uid:` line means we've left the row.
      const trimmed = raw.replace(/[\t ]+$/, '');
      const indentMatch = /^(\s*)\S/.exec(raw);
      const indent = indentMatch ? indentMatch[1].length : -1;
      if (trimmed === '' || indent <= rowIndent) {
        currentUid = null;
        rowIndent = -1;
        out.push(raw);
        continue;
      }
      // Decorate only when this line has a sibling elsewhere — without
      // a duplicate, Monaco's diff has no way to cross-match it.
      const lineKey = raw.trim();
      if (raw.includes('#') || (counts.get(lineKey) ?? 0) <= 1) {
        out.push(raw);
      } else {
        out.push(`${raw}  # ${currentUid}`);
      }
      continue;
    }
    out.push(raw);
  }
  return out.join('\n');
}
