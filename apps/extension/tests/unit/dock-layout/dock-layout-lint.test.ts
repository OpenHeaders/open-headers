/**
 * Dock-layout lint — runs as part of the test suite so CI catches
 * convention violations without requiring custom Biome plugin support.
 *
 * Four rules, one per bug class in `docs/DOCK_LAYOUT_SPIKE.md` § 2:
 *
 *   1. **PanelHeader mount (BC-D1).** Every file under
 *      `src/{workbench,panel}/**` that imports `PanelHeader` from
 *      `@openheaders/ui/shared/dock-layout` must mount `<PanelHeader …>` somewhere
 *      in its JSX. Closes "imported but didn't render."
 *
 *   2. **Factory call (BC-D2 reinforcement).** Same files must call
 *      `createPanelHeaderWiring(…)` to construct the wiring. The brand
 *      makes literal-bypass a TS error; this lint reinforces by
 *      asserting the factory is the construction path. (BC-D2 is
 *      closed by the brand alone; this assertion catches the broader
 *      pattern of "imported PanelHeader but didn't go through the
 *      factory at all.")
 *
 *   3. **Wrapper class (BC-D3).** Each surface has an allowed
 *      wrapper-class set:
 *        - `packages/ui/src/workbench/...` → must contain at least
 *          one of: `rules-right-panel`, `rules-bottom-panel`, `rules-sidebar`.
 *        - `packages/ui/src/panel/...` → must contain `dt-panel`.
 *      Closes "wrong wrapper class for surface."
 *
 *   4. **No cast escape (BC-D5).** No `as PanelHeaderWiring` (or
 *      `as unknown as PanelHeaderWiring`) outside the factory file
 *      itself. Closes the brand's primary escape hatch.
 *
 * Implementation is regex-based (sufficient for the spike measurement).
 * If a future divergence requires deeper analysis (e.g. wrapper class
 * via runtime variable — BC-D4 narrowed), upgrade to a TypeScript
 * compiler-API walker; the test contract stays.
 *
 * Documented residual gap (BC-D6): a re-export of
 * `createPanelHeaderWiring` under a different name would defeat
 * assertion #2. The lint walks for the canonical name only.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// Both the workbench and panel surfaces were lifted to `@openheaders/ui`;
// their source-shape checks read from the package location.
const UI_SRC_ROOT = path.resolve(__dirname, '../../../../../packages/ui/src');
const SRC_ROOTS = [path.resolve(UI_SRC_ROOT, 'workbench'), path.resolve(UI_SRC_ROOT, 'panel')];

const PANEL_HEADER_IMPORT_REGEX =
  /import\s*\{[^}]*\bPanelHeader\b[^}]*\}\s*from\s*['"]@openheaders\/ui\/shared\/dock-layout['"]/;

const WORKBENCH_WRAPPER_CLASSES = ['rules-right-panel', 'rules-bottom-panel', 'rules-sidebar'];
const PANEL_WRAPPER_CLASSES = ['dt-panel'];

interface PanelFile {
  absolute: string;
  relative: string;
  surface: 'workbench' | 'panel';
  source: string;
}

function walkSources(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      walkSources(full, out);
      continue;
    }
    if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
  }
}

function findPanelFiles(): PanelFile[] {
  const out: PanelFile[] = [];
  for (const root of SRC_ROOTS) {
    const surface = root.endsWith('workbench') ? 'workbench' : 'panel';
    const files: string[] = [];
    walkSources(root, files);
    for (const absolute of files) {
      const source = readFileSync(absolute, 'utf8');
      if (!PANEL_HEADER_IMPORT_REGEX.test(source)) continue;
      const relative = path.relative(UI_SRC_ROOT, absolute);
      out.push({ absolute, relative, surface, source });
    }
  }
  return out;
}

const PANEL_FILES = findPanelFiles();

describe('dock-layout lint — BC-D1 (PanelHeader mount)', () => {
  for (const file of PANEL_FILES) {
    it(`${file.relative} mounts <PanelHeader>`, () => {
      // Assert <PanelHeader …> JSX appears somewhere in the file. The
      // import alone isn't sufficient — a file that imports the type
      // but never renders the element fails this check.
      const mountRegex = /<PanelHeader[\s>/]/;
      expect(mountRegex.test(file.source)).toBe(true);
    });
  }
});

describe('dock-layout lint — BC-D2 reinforcement (createPanelHeaderWiring call)', () => {
  for (const file of PANEL_FILES) {
    it(`${file.relative} calls createPanelHeaderWiring(...)`, () => {
      // The brand alone closes BC-D2 (literal-bypass). This assertion
      // reinforces by catching the broader "imported PanelHeader, mounted
      // it, but didn't construct the wiring through the factory" case —
      // which would only be possible via a cast escape (closed by BC-D5
      // assertion below) or a re-export (the documented BC-D6 gap).
      const callRegex = /createPanelHeaderWiring\s*\(/;
      expect(callRegex.test(file.source)).toBe(true);
    });
  }
});

describe('dock-layout lint — BC-D3 (surface-appropriate wrapper class)', () => {
  for (const file of PANEL_FILES) {
    const allowed = file.surface === 'workbench' ? WORKBENCH_WRAPPER_CLASSES : PANEL_WRAPPER_CLASSES;
    it(`${file.relative} uses a ${file.surface} wrapper class (${allowed.join(' / ')})`, () => {
      // Walk for any of the allowed class-name literals inside a
      // className attribute. The check is literal-string only —
      // wrapper classes set via runtime variables (`className={WRAP}`)
      // slip through. That gap is BC-D4 and is intentional per the
      // spike's predicted catcher table (HN — narrowed).
      const matches = allowed.some((klass) => {
        // Either bare class string or part of a multi-class string.
        const literal = new RegExp(`className\\s*=\\s*["'\`][^"'\`]*\\b${klass}\\b[^"'\`]*["'\`]`);
        return literal.test(file.source);
      });
      expect(matches).toBe(true);
    });
  }
});

describe('dock-layout lint — BC-D5 (no cast escape)', () => {
  for (const file of PANEL_FILES) {
    it(`${file.relative} does not bypass the brand via "as PanelHeaderWiring"`, () => {
      // The factory itself is allowed exactly one cast (its internal
      // `as unknown as PanelHeaderWiring`). Every other file that
      // mentions PanelHeaderWiring must do so as a type reference,
      // not as a cast target.
      const castRegex = /\bas\s+(?:unknown\s+as\s+)?PanelHeaderWiring\b/;
      expect(castRegex.test(file.source)).toBe(false);
    });
  }
});

describe('dock-layout lint — sanity', () => {
  it('finds at least one panel file consuming PanelHeader', () => {
    expect(PANEL_FILES.length).toBeGreaterThan(0);
  });
});
