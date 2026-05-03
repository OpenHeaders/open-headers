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
 * append `  # <uid>` to each indented line that belongs to the row.
 * Each line becomes uniquely keyed, so the diff algorithm matches by
 * row identity instead of by coincidental scalar value.
 *
 * Applied identically to both panes — the trailer is for visual
 * alignment only, never reaches disk.
 */

const ROW_START = /^(\s*)-\s+uid:\s+([a-z0-9]{8})/;

export function decorateYamlForDiff(yaml: string): string {
  const lines = yaml.split('\n');
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
      // Don't double-tag a line that already carries a comment.
      if (raw.includes('#')) {
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
