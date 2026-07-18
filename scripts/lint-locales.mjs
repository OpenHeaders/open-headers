/**
 * Locale-catalog lint — the Phase I translation gate.
 *
 * For every real-locale catalog dir under `packages/i18n/src/catalogs`
 * (everything except `en`), verifies the translation laws against the
 * English source, file by file:
 *   - a present file carries a key set byte-identical to its en sibling
 *     and exports the same const name
 *   - per-key message kind (template string vs function) matches
 *   - per-key `{hole}` name sets match (function messages compare the
 *     union of holes across their string literals)
 *   - every `plural()` call's form keys equal the locale's CLDR plural
 *     categories, and a key en pluralizes must pluralize in the locale
 *   - glossary terms present as standalone tokens in the en value stay
 *     untranslated in the locale value (case-sensitive)
 *   - whole-raw en values (no prose — chords, glyphs, format examples)
 *     copy verbatim
 *   - the locale `index.ts` imports exactly the present files
 *   - the locale has a `LocaleDef` in `locales.ts` and a loader in
 *     `catalog-registry.ts`, and neither names a locale without a dir
 *
 * Missing files are pending coverage — reported, never failing: a
 * locale ships file-by-file behind the per-key English fallback.
 *
 * Usage: node scripts/lint-locales.mjs [<locale>...]
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogsDir = path.join(repoRoot, 'packages/i18n/src/catalogs');
const localesPath = path.join(repoRoot, 'packages/i18n/src/locales.ts');
const registryPath = path.join(repoRoot, 'packages/i18n/src/catalog-registry.ts');
const glossaryPath = path.join(repoRoot, 'packages/i18n/src/glossary.ts');

function fail(message) {
  console.error(`lint-locales: ${message}`);
  process.exit(2);
}

function sourceFile(filePath) {
  return ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true);
}

// ── Glossary obligations ─────────────────────────────────────────────

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Glossary terms that double as ordinary prose words ("Header" the JWT
 * part vs "header" the sentence noun, "Path" the cookie attribute vs a
 * file path). Their presence in an en value can't be machine-read as a
 * protected-token obligation — translation review covers them instead.
 */
const AMBIGUOUS_TERMS = new Set([
  'Connection Start',
  'Domain',
  'Expires',
  'Header',
  'Headers',
  'Initiator',
  'Partitioned',
  'Path',
  'Payload',
  'Preflight',
  'Secure',
  'Signature',
  'Stalled',
  'Timing',
  'Waterfall',
  's',
]);

function loadGlossary() {
  const sf = sourceFile(glossaryPath);
  const terms = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'GLOSSARY' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const el of node.initializer.elements) {
        if (ts.isStringLiteralLike(el)) terms.push(el.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (terms.length === 0) fail(`no GLOSSARY terms found in ${glossaryPath}`);
  // Standalone-token match: not butted against a letter or digit.
  return terms.filter((term) => !AMBIGUOUS_TERMS.has(term)).map((term) => ({
    term,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'u'),
  }));
}

const glossary = loadGlossary();

// ── Catalog parsing ──────────────────────────────────────────────────

const HOLE = /\{(\w+)\}/g;

function holes(text) {
  return new Set([...text.matchAll(HOLE)].map((m) => m[1]));
}

/** Prose floor mirrors scan.mjs: no two consecutive letters = raw. */
function isWholeRaw(text) {
  return !/[A-Za-z]{2}/.test(text);
}

function unwrapExpression(node) {
  let current = node;
  while (ts.isSatisfiesExpression(current) || ts.isAsExpression(current)) {
    current = current.expression;
  }
  return current;
}

/** Fold a string literal or a `+`-concatenation of them into one text. */
function stringConstant(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = stringConstant(node.left);
    const right = stringConstant(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}

/**
 * Parse one catalog file into { exportName, entries } where entries
 * maps key → { kind, line, text?, holes, pluralForms }.
 */
function parseCatalog(filePath) {
  const sf = sourceFile(filePath);
  let exportName;
  let objectLiteral;
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const declaration = statement.declarationList.declarations[0];
    if (!declaration?.initializer || !ts.isIdentifier(declaration.name)) continue;
    const unwrapped = unwrapExpression(declaration.initializer);
    if (ts.isObjectLiteralExpression(unwrapped)) {
      exportName = declaration.name.text;
      objectLiteral = unwrapped;
      break;
    }
  }
  if (!objectLiteral) fail(`${filePath}: no exported catalog object literal found`);

  const entries = new Map();
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name)) {
      fail(`${filePath}: unsupported catalog property shape at position ${property.pos}`);
    }
    const key = property.name.text;
    const line = sf.getLineAndCharacterOfPosition(property.getStart()).line + 1;
    const value = property.initializer;
    const constant = stringConstant(value);
    if (constant !== undefined) {
      entries.set(key, { kind: 'string', line, text: constant, holes: holes(constant), pluralForms: [] });
    } else if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
      const literals = [];
      const pluralForms = [];
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'plural') {
          const forms = node.arguments[2];
          if (forms !== undefined && ts.isObjectLiteralExpression(forms)) {
            const formKeys = new Set();
            for (const form of forms.properties) {
              if (ts.isPropertyAssignment(form)) formKeys.add(form.name.getText());
            }
            pluralForms.push(formKeys);
          }
        }
        if (ts.isStringLiteralLike(node)) literals.push(node.text);
        ts.forEachChild(node, visit);
      }
      visit(value);
      const literalHoles = new Set(literals.flatMap((text) => [...holes(text)]));
      entries.set(key, { kind: 'fn', line, text: undefined, holes: literalHoles, pluralForms });
    } else {
      fail(`${filePath}:${line} unsupported message value for "${key}" — string literal or function only`);
    }
  }
  return { exportName, entries };
}

/** Collect './file' import specifiers from a locale index.ts. */
function indexImports(filePath) {
  const sf = sourceFile(filePath);
  const specifiers = new Set();
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      const spec = statement.moduleSpecifier.text;
      if (spec.startsWith('./')) specifiers.add(spec.slice(2));
    }
  }
  return specifiers;
}

/** LocaleDef codes declared in locales.ts (excluding synthetic). */
function declaredLocaleCodes() {
  const sf = sourceFile(localesPath);
  const codes = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'LOCALES' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const el of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue;
        let code;
        let synthetic = false;
        for (const property of el.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = property.name.getText();
          if (name === 'code' && ts.isStringLiteralLike(property.initializer)) code = property.initializer.text;
          if (name === 'synthetic' && property.initializer.kind === ts.SyntaxKind.TrueKeyword) synthetic = true;
        }
        if (code !== undefined && !synthetic) codes.add(code);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (codes.size === 0) fail(`no LOCALES entries found in ${localesPath}`);
  return codes;
}

/** Loader keys declared in catalog-registry.ts. */
function declaredLoaderCodes() {
  const sf = sourceFile(registryPath);
  const codes = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'loaders' &&
      node.initializer
    ) {
      const unwrapped = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(unwrapped)) {
        for (const property of unwrapped.properties) {
          if (ts.isPropertyAssignment(property)) {
            const name = property.name;
            codes.add(ts.isStringLiteralLike(name) ? name.text : name.getText());
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return codes;
}

// ── Comparison ───────────────────────────────────────────────────────

function setEquals(a, b) {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function formatSet(set) {
  return `{${[...set].sort().join(', ')}}`;
}

const violations = [];

function report(locale, file, line, message) {
  violations.push(`${locale}/${file}${line ? `:${line}` : ''} ${message}`);
}

function lintFile(locale, fileName, enParsed, pluralCategories) {
  const filePath = path.join(catalogsDir, locale, fileName);
  const parsed = parseCatalog(filePath);
  const shortName = fileName;

  if (parsed.exportName !== enParsed.exportName) {
    report(locale, shortName, undefined, `exports "${parsed.exportName}" — en sibling exports "${enParsed.exportName}"`);
  }

  for (const [key, entry] of parsed.entries) {
    const enEntry = enParsed.entries.get(key);
    if (enEntry === undefined) {
      report(locale, shortName, entry.line, `key "${key}" does not exist in en`);
      continue;
    }
    if (entry.kind !== enEntry.kind) {
      report(locale, shortName, entry.line, `key "${key}" is a ${entry.kind} — en is a ${enEntry.kind}`);
      continue;
    }
    if (!setEquals(entry.holes, enEntry.holes)) {
      report(
        locale,
        shortName,
        entry.line,
        `key "${key}" holes ${formatSet(entry.holes)} differ from en ${formatSet(enEntry.holes)}`,
      );
    }
    if (enEntry.pluralForms.length > 0 && entry.pluralForms.length === 0) {
      report(locale, shortName, entry.line, `key "${key}" drops plural() — en pluralizes here`);
    }
    for (const formKeys of entry.pluralForms) {
      if (!setEquals(formKeys, pluralCategories)) {
        report(
          locale,
          shortName,
          entry.line,
          `key "${key}" plural forms ${formatSet(formKeys)} must equal ${locale}'s CLDR categories ${formatSet(pluralCategories)}`,
        );
      }
    }
    if (entry.kind === 'string') {
      if (isWholeRaw(enEntry.text)) {
        if (entry.text !== enEntry.text) {
          report(locale, shortName, entry.line, `key "${key}" is whole-raw in en — must copy verbatim`);
        }
      } else {
        for (const { term, pattern } of glossary) {
          if (pattern.test(enEntry.text) && !pattern.test(entry.text)) {
            report(locale, shortName, entry.line, `key "${key}" drops glossary term "${term}"`);
          }
        }
      }
    }
  }
  for (const [key, enEntry] of enParsed.entries) {
    if (!parsed.entries.has(key)) {
      report(locale, shortName, undefined, `missing key "${key}" (en ${enParsed.file}:${enEntry.line})`);
    }
  }
  return parsed.entries.size;
}

// ── Main ─────────────────────────────────────────────────────────────

const requested = process.argv.slice(2);

const enFiles = readdirSync(path.join(catalogsDir, 'en'))
  .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
  .sort();
const enParsedByFile = new Map();
let enKeyTotal = 0;
for (const fileName of enFiles) {
  const parsed = parseCatalog(path.join(catalogsDir, 'en', fileName));
  parsed.file = fileName;
  enParsedByFile.set(fileName, parsed);
  enKeyTotal += parsed.entries.size;
}

const localeDirs = readdirSync(catalogsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'en')
  .map((entry) => entry.name)
  .sort();
const locales = requested.length > 0 ? requested : localeDirs;
for (const locale of locales) {
  if (!localeDirs.includes(locale)) fail(`no catalog dir for locale "${locale}"`);
}

const defCodes = declaredLocaleCodes();
const loaderCodes = declaredLoaderCodes();
for (const code of defCodes) {
  if (code !== 'en' && !localeDirs.includes(code)) {
    report(code, 'locales.ts', undefined, 'has a LocaleDef but no catalog dir');
  }
}
for (const code of loaderCodes) {
  if (!localeDirs.includes(code)) {
    report(code, 'catalog-registry.ts', undefined, 'has a loader but no catalog dir');
  }
}

const coverage = [];
for (const locale of locales) {
  if (!defCodes.has(locale)) report(locale, 'locales.ts', undefined, `locale "${locale}" has no LocaleDef`);
  if (!loaderCodes.has(locale)) {
    report(locale, 'catalog-registry.ts', undefined, `locale "${locale}" has no catalog loader`);
  }

  let pluralCategories;
  try {
    pluralCategories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
  } catch {
    fail(`"${locale}" is not a valid Intl locale`);
  }

  const localeDir = path.join(catalogsDir, locale);
  const files = readdirSync(localeDir)
    .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
    .sort();
  let keyCount = 0;
  for (const fileName of files) {
    const enParsed = enParsedByFile.get(fileName);
    if (enParsed === undefined) {
      report(locale, fileName, undefined, 'has no en sibling');
      continue;
    }
    keyCount += lintFile(locale, fileName, enParsed, pluralCategories);
  }

  const indexPath = path.join(localeDir, 'index.ts');
  if (!existsSync(indexPath)) {
    report(locale, 'index.ts', undefined, 'missing');
  } else {
    const imports = indexImports(indexPath);
    const fileSet = new Set(files.map((name) => name.replace(/\.ts$/, '')));
    for (const name of fileSet) {
      if (!imports.has(name)) report(locale, 'index.ts', undefined, `does not import "./${name}"`);
    }
    for (const spec of imports) {
      if (!fileSet.has(spec)) {
        report(locale, 'index.ts', undefined, `imports "./${spec}" which is not a catalog file`);
      }
    }
  }

  coverage.push(
    `${locale}: ${files.length}/${enFiles.length} files, ${keyCount}/${enKeyTotal} keys (${((keyCount / enKeyTotal) * 100).toFixed(1)}%)`,
  );
}

for (const line of coverage) console.log(`lint-locales: ${line}`);
if (violations.length > 0) {
  for (const violation of violations) console.log(violation);
  console.log(`\nlint-locales: ${violations.length} violation${violations.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log('lint-locales: clean');
