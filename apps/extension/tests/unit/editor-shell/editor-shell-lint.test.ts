/**
 * Editor-shell lint — runs as part of the test suite so CI catches
 * violations without requiring custom Biome plugin support (which is
 * still experimental upstream).
 *
 * Two rules, one per branded surface:
 *
 *   1. **Header rule (BC6).** Every `*Editor.tsx` under
 *      `src/workbench/components/` that calls `useEditorShell(...)`
 *      must mount `<EditorHeader>` and pass the shell-produced wiring
 *      via `shell={shell.headerProps}` (or destructured equivalent).
 *      Closes "called the hook but didn't mount the header."
 *
 *   2. **Scope rule (BC8).** Same files calling `useEditorShell(...)`
 *      must mount `<EntityScopeProvider>` with `shell={shell.scopeProps}`.
 *      Closes "wrong entityType in scope."
 *
 * Implementation is regex-based (sufficient for the spike measurement).
 * If Phase B observes the rule is brittle, upgrade to a TypeScript
 * compiler-API walker; the test contract stays.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const EDITORS_DIR = path.resolve(__dirname, '../../../../../packages/ui/src/workbench/components');

function listEditorFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const s = statSync(full);
      if (s.isDirectory()) {
        walk(full);
        continue;
      }
      if (name.endsWith('Editor.tsx')) out.push(full);
    }
  }
  walk(EDITORS_DIR);
  return out;
}

interface ShellUsage {
  file: string;
  bindingName: string;
  source: string;
}

const SHELL_CALL_REGEX = /(const|let)\s+(\w+)\s*=\s*useEditorShell\b/g;

function findShellUsages(): ShellUsage[] {
  const out: ShellUsage[] = [];
  for (const file of listEditorFiles()) {
    const source = readFileSync(file, 'utf8');
    SHELL_CALL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = SHELL_CALL_REGEX.exec(source);
    while (match !== null) {
      out.push({ file, bindingName: match[2], source });
      match = SHELL_CALL_REGEX.exec(source);
    }
  }
  return out;
}

describe('editor-shell lint — BC6 (header mount)', () => {
  const usages = findShellUsages();

  for (const { file, bindingName, source } of usages) {
    it(`${path.relative(EDITORS_DIR, file)} mounts <EditorHeader> with shell={${bindingName}.headerProps}`, () => {
      // EditorHeader JSX must appear and reference the shell binding's
      // headerProps. We allow either explicit attribute spread
      // (`shell={x.headerProps}`) or property-shorthand variants the
      // editor might prefer.
      const headerRegex = new RegExp(
        `<EditorHeader[^>]*\\bshell\\s*=\\s*\\{\\s*${bindingName}\\.headerProps\\s*\\}`,
        's',
      );
      expect(headerRegex.test(source)).toBe(true);
    });

    it(`${path.relative(EDITORS_DIR, file)} mounts <EntityScopeProvider> with shell={${bindingName}.scopeProps}`, () => {
      const scopeRegex = new RegExp(
        `<EntityScopeProvider[^>]*\\bshell\\s*=\\s*\\{\\s*${bindingName}\\.scopeProps\\s*\\}`,
        's',
      );
      expect(scopeRegex.test(source)).toBe(true);
    });
  }

  it('finds at least one editor that uses the shell (sanity)', () => {
    expect(usages.length).toBeGreaterThan(0);
  });
});
