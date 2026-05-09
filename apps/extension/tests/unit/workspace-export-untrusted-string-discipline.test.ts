/**
 * Untrusted-string rendering discipline (design §4.1 gate 10).
 *
 * Every string that the workspace-export preview modal renders comes from
 * the import payload — `notes`, `source.workspaceLabel`, entity names,
 * rule explanations, request URLs, script source. A `dangerouslySetInnerHTML`
 * (or markdown-to-HTML conversion) on any of these would turn the import
 * boundary into an XSS surface for any imported export.
 *
 * This test is a static guard rather than a render assertion: it scans
 * every source file under `workspace-export/` for the forbidden patterns.
 * Cheaper than per-component RTL coverage and impossible to forget.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', 'src', 'workbench', 'components', 'workspace-export');

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...listSources(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('workspace-export untrusted-string rendering discipline', () => {
  const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
    { pattern: /dangerouslySetInnerHTML/, reason: 'no React HTML injection on untrusted import strings' },
    { pattern: /innerHTML\s*=/, reason: 'no DOM innerHTML assignments on untrusted import strings' },
    { pattern: /document\.write\(/, reason: 'no document.write — same XSS class as innerHTML' },
    { pattern: /\bmarked\(/, reason: 'no markdown-to-HTML on untrusted import strings (§4.1 gate 10)' },
    { pattern: /react-markdown/, reason: 'no react-markdown on untrusted import strings (§4.1 gate 10)' },
  ];

  const sources = listSources(ROOT);

  it('lists at least the expected component files (sanity)', () => {
    const names = sources.map((p) => p.split('/').pop()).sort();
    expect(names).toEqual(expect.arrayContaining(['ExportModal.tsx', 'ImportPreviewModal.tsx']));
  });

  /**
   * Strip block comments (` slash-star ... star-slash `) and line
   * comments (`// ...`). The discipline note inside each component
   * itself mentions the forbidden tokens; we only want to flag *code*
   * uses, not the prose.
   */
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\*.*$/gm, '')
      .replace(/\/\/.*$/gm, '');
  }

  for (const { pattern, reason } of FORBIDDEN) {
    it(`no source file contains \`${pattern.source}\` (${reason})`, () => {
      const offenders: string[] = [];
      for (const path of sources) {
        const text = stripComments(readFileSync(path, 'utf8'));
        if (pattern.test(text)) offenders.push(path);
      }
      expect(offenders).toEqual([]);
    });
  }
});
