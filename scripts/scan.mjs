/**
 * Hardcoded-string scanner — the enforcement gate of I18N_PLAN.md §7.
 *
 * Flags English prose in localizable positions: JSX text children,
 * `{'string'}` JSX children, string values of the `title`,
 * `placeholder`, `label`, `aria-label`, `alt`, `description`, and
 * `tooltip` attributes, and the first string argument of antd
 * `message.*` / `notification.*` calls. Detection is AST-positional
 * via the TypeScript compiler — never substring matching.
 *
 * The whitelist is the machine-readable English boundary (plan §3):
 * terms from `packages/i18n/src/glossary.ts`, non-prose shapes
 * (identifiers, paths, acronyms, bare punctuation), raw containers
 * (`<code>`/`<pre>`/`<kbd>`/`<samp>` and elements carrying a boolean
 * `code` prop, e.g. antd `<Typography.Text code>`), and exempt paths
 * (docs diagrams stay raw by decision; dev showcases and tests are
 * not shipped surfaces).
 *
 * Usage: node scripts/scan.mjs [--warn] <dir...>
 * Directories resolve against the invoking package's cwd (turbo runs
 * one scan per package). `--warn` reports without failing; without it
 * any finding exits 1 — the per-surface ratchet flips a surface to
 * blocking by dropping its `--warn`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ATTRIBUTES = new Set(['title', 'placeholder', 'label', 'aria-label', 'alt', 'description', 'tooltip']);
const MESSAGE_OBJECTS = new Set(['message', 'notification']);
const MESSAGE_METHODS = new Set(['success', 'error', 'info', 'warning', 'loading', 'open']);
const RAW_CONTAINERS = new Set(['code', 'pre', 'kbd', 'samp']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'tests', 'e2e', '__mocks__', 'coverage', 'dev']);
const EXEMPT_PATHS = ['/docs/diagrams/'];

function fail(message) {
  console.error(`scan: ${message}`);
  process.exit(2);
}

function loadGlossary() {
  const glossaryPath = path.join(repoRoot, 'packages/i18n/src/glossary.ts');
  const sf = ts.createSourceFile(glossaryPath, readFileSync(glossaryPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const terms = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'GLOSSARY' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const el of node.initializer.elements) {
        if (ts.isStringLiteralLike(el)) terms.add(el.text.toLowerCase());
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (terms.size === 0) fail(`no GLOSSARY terms found in ${glossaryPath}`);
  return terms;
}

const glossary = loadGlossary();

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const entry = path.join(dir, name);
    if (statSync(entry).isDirectory()) {
      yield* walk(entry);
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name) && !name.endsWith('.d.ts')) {
      yield entry;
    }
  }
}

function isProse(text) {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]{2}/.test(collapsed)) return false;
  const bare = collapsed.replace(/[.,!?…:;()]+$/, '').toLowerCase();
  if (glossary.has(collapsed.toLowerCase()) || glossary.has(bare)) return false;
  if (!/\s/.test(collapsed) && /[./_:{}#@\-]|^[A-Z0-9_]+$/.test(collapsed)) return false;
  return true;
}

function isRawContainer(node) {
  let tagName;
  let attributes;
  if (ts.isJsxElement(node)) {
    tagName = node.openingElement.tagName.getText();
    attributes = node.openingElement.attributes;
  } else if (ts.isJsxSelfClosingElement(node)) {
    tagName = node.tagName.getText();
    attributes = node.attributes;
  } else {
    return false;
  }
  if (RAW_CONTAINERS.has(tagName)) return true;
  return attributes.properties.some(
    (p) => ts.isJsxAttribute(p) && p.name.getText() === 'code' && p.initializer === undefined,
  );
}

function scanFile(filePath) {
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, kind);
  const findings = [];

  function report(position, node, text) {
    const snippet = text.replace(/\s+/g, ' ').trim();
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    findings.push({ line: line + 1, position, snippet });
  }

  function attributeStringLiteral(initializer) {
    if (ts.isStringLiteral(initializer)) return initializer;
    if (ts.isJsxExpression(initializer) && initializer.expression && ts.isStringLiteralLike(initializer.expression)) {
      return initializer.expression;
    }
    return null;
  }

  function visit(node) {
    if (ts.isJsxText(node) && isProse(node.text) && !isRawContainer(node.parent)) {
      report('jsx-text', node, node.text);
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isStringLiteralLike(node.expression) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      isProse(node.expression.text) &&
      !isRawContainer(node.parent)
    ) {
      report('jsx-text', node, node.expression.text);
    }
    if (ts.isJsxAttribute(node) && node.initializer && ATTRIBUTES.has(node.name.getText())) {
      const literal = attributeStringLiteral(node.initializer);
      if (literal && isProse(literal.text)) report(`attr:${node.name.getText()}`, node, literal.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      MESSAGE_OBJECTS.has(node.expression.expression.text) &&
      MESSAGE_METHODS.has(node.expression.name.text) &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      isProse(node.arguments[0].text)
    ) {
      report('antd-message', node, node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return findings;
}

const argv = process.argv.slice(2);
const warnOnly = argv.includes('--warn');
const dirs = argv.filter((a) => a !== '--warn');
if (dirs.length === 0) fail('usage: node scripts/scan.mjs [--warn] <dir...>');

let total = 0;
for (const dir of dirs) {
  const root = path.resolve(process.cwd(), dir);
  for (const file of walk(root)) {
    const relative = path.relative(repoRoot, file);
    if (EXEMPT_PATHS.some((p) => file.includes(p))) continue;
    const findings = scanFile(file);
    total += findings.length;
    for (const f of findings) {
      const snippet = f.snippet.length > 100 ? `${f.snippet.slice(0, 97)}...` : f.snippet;
      console.log(`${relative}:${f.line} [${f.position}] "${snippet}"`);
    }
  }
}

if (total > 0) {
  console.log(`\nscan: ${total} hardcoded string${total === 1 ? '' : 's'}${warnOnly ? ' (warn-only)' : ''}`);
  if (!warnOnly) process.exit(1);
} else {
  console.log('scan: clean');
}
