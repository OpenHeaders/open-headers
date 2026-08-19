/**
 * Stage the npm-publishable @openheaders/core tarball.
 *
 * The workspace manifest points its `import` conditions at TypeScript
 * source (monorepo consumers bundle it themselves), so the published
 * package gets its own stage: a fresh tsc emit without source maps,
 * relative specifiers rewritten to explicit `.js` paths so the output
 * loads under plain Node ESM (the workspace emit is extensionless,
 * bundler-only), and a generated dist-only manifest. The stage is
 * packed, leak-gated, then verified by installing the tarball into a
 * scratch consumer and importing every declared subpath.
 *
 * Run via `pnpm --filter @openheaders/core run pack` (`run` matters —
 * the bare command resolves to pnpm's built-in pack).
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const stageDir = path.join(packageRoot, 'dist-package');
const require = createRequire(path.join(packageRoot, 'package.json'));
const manifest = require('./package.json');

function fail(message) {
  console.error(`pack: ${message}`);
  process.exit(1);
}

// ── Emit: fresh compile into the stage, no source maps ───────────────

rmSync(stageDir, { recursive: true, force: true });
const emit = spawnSync(
  'pnpm',
  [
    'exec',
    'tsc',
    '-p',
    'tsconfig.build.json',
    '--outDir',
    path.join(stageDir, 'dist'),
    '--sourceMap',
    'false',
    '--declarationMap',
    'false',
  ],
  { cwd: packageRoot, stdio: 'inherit' },
);
if (emit.status !== 0) fail(`tsc exited ${emit.status}`);

// ── Rewrite: relative specifiers gain explicit .js extensions ────────
// The source style is extensionless (`from './encoding'`), which every
// bundler resolves but plain Node ESM refuses. Each emitted file is
// parsed with the TypeScript AST (comments that merely mention paths
// are untouched) and every relative specifier is resolved against the
// staged tree — file → `<spec>.js`, directory → `<spec>/index.js`; a
// specifier that resolves to neither fails the pack.

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function collectSpecifiers(sourceFile) {
  const literals = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      literals.push(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      literals.push(node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      literals.push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return literals.filter((literal) => ts.isStringLiteral(literal) && /^\.\.?\//.test(literal.text));
}

let rewritten = 0;
for (const file of listFiles(path.join(stageDir, 'dist'))) {
  if (!file.endsWith('.js') && !file.endsWith('.d.ts')) fail(`unexpected emit artifact: ${file}`);
  const text = readFileSync(file, 'utf-8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits = [];
  for (const literal of collectSpecifiers(sourceFile)) {
    const spec = literal.text;
    const base = path.dirname(file);
    let resolved;
    if (existsSync(path.join(base, `${spec}.js`))) resolved = `${spec}.js`;
    else if (existsSync(path.join(base, spec, 'index.js'))) resolved = `${spec}/index.js`;
    else fail(`${path.relative(stageDir, file)}: unresolvable specifier '${spec}'`);
    // literal positions include the quotes; keep them, swap the text.
    edits.push({ start: literal.getStart(sourceFile) + 1, end: literal.getEnd() - 1, resolved });
  }
  if (edits.length === 0) continue;
  let next = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.resolved + next.slice(edit.end);
  }
  writeFileSync(file, next);
  rewritten++;
}
console.log(`pack: emitted dist, rewrote specifiers in ${rewritten} files`);

// ── Stage: docs + generated dist-only manifest ───────────────────────

cpSync(path.join(packageRoot, 'README.md'), path.join(stageDir, 'README.md'));
cpSync(path.join(repoRoot, 'LICENSE'), path.join(stageDir, 'LICENSE'));
cpSync(path.join(repoRoot, 'NOTICE'), path.join(stageDir, 'NOTICE'));

// One exports map, derived from the workspace manifest: each subpath's
// dist target becomes `default`, its declaration file `types`.
const exportsMap = {};
for (const [subpath, conditions] of Object.entries(manifest.exports)) {
  const dist = conditions.default;
  exportsMap[subpath] = { types: dist.replace(/\.js$/, '.d.ts'), default: dist };
}

writeFileSync(
  path.join(stageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      license: 'Apache-2.0',
      homepage: 'https://openheaders.com',
      repository: { type: 'git', url: 'git+https://github.com/OpenHeaders/open-headers.git' },
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: exportsMap,
      files: ['dist'],
      dependencies: manifest.dependencies,
      // Publish gates: a release is a deliberate act. `prepublishOnly`
      // refuses without OH_RELEASE=1; the registry is pinned so scope
      // routing in a user npmrc can never redirect the artifact.
      publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' },
      scripts: {
        prepublishOnly:
          'node -e "if(process.env.OH_RELEASE!==\'1\'){console.error(\'refusing to publish: set OH_RELEASE=1 for a deliberate release\');process.exit(1)}"',
      },
    },
    null,
    2,
  )}\n`,
);
console.log(`pack: staged ${stageDir}`);

// ── Tarball + leak gate ──────────────────────────────────────────────
// The tarball may contain ONLY the curated set — the emitted dist plus
// the manifest/docs files. Source maps or anything npm's defaults might
// sweep in fail the pack outright.

const packed = spawnSync('npm', ['pack', '--json'], { cwd: stageDir, encoding: 'utf-8' });
if (packed.status !== 0) fail(`npm pack exited ${packed.status}: ${packed.stderr}`);
const [tarball] = JSON.parse(packed.stdout);
const allowedTop = new Set(['package.json', 'README.md', 'LICENSE', 'NOTICE']);
const contraband = tarball.files
  .map((entry) => entry.path)
  .filter((file) => !(allowedTop.has(file) || (file.startsWith('dist/') && !file.endsWith('.map'))));
if (contraband.length > 0) fail(`tarball contains unexpected files: ${contraband.join(', ')}`);
console.log(`pack: tarball ${tarball.filename} (${tarball.files.length} files, leak gate clean)`);

// ── Verify: the tarball installs and every subpath imports ───────────
// A scratch consumer installs the packed artifact (dependencies come
// from the registry) and imports every declared subpath under plain
// Node — the exact failure mode the specifier rewrite exists to
// prevent. Wildcard subpaths are exercised through one concrete file.

const consumerDir = mkdtempSync(path.join(os.tmpdir(), 'oh-core-pack-verify-'));
writeFileSync(
  path.join(consumerDir, 'package.json'),
  `${JSON.stringify({ name: 'oh-core-pack-verify', private: true, type: 'module' }, null, 2)}\n`,
);
const install = spawnSync(
  'npm',
  ['install', '--no-audit', '--no-fund', path.join(stageDir, tarball.filename)],
  { cwd: consumerDir, stdio: 'inherit' },
);
if (install.status !== 0) fail(`verify npm install exited ${install.status}`);

const subpaths = Object.keys(exportsMap).filter((subpath) => !subpath.includes('*'));
const builderFiles = readdirSync(path.join(stageDir, 'dist', 'sync-builders')).filter(
  (file) => file.endsWith('.js') && file !== 'index.js',
);
if (builderFiles.length > 0) subpaths.push(`./sync-builders/${builderFiles[0].replace(/\.js$/, '')}`);

const smoke = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `const subpaths = ${JSON.stringify(subpaths)};
     for (const subpath of subpaths) {
       await import('@openheaders/core' + subpath.slice(1));
     }
     const licensing = await import('@openheaders/core/licensing');
     const protocol = await import('@openheaders/core/protocol');
     if (typeof licensing.verifyLicense !== 'function') throw new Error('licensing.verifyLicense missing');
     if (typeof licensing.FREE_SEAT_LIMIT !== 'number') throw new Error('licensing.FREE_SEAT_LIMIT missing');
     if (typeof protocol.PROTOCOL_VERSION !== 'number') throw new Error('protocol.PROTOCOL_VERSION missing');
     console.log('pack: verified — ' + subpaths.length + ' subpaths import under node ' + process.version);`,
  ],
  { cwd: consumerDir, stdio: 'inherit' },
);
rmSync(consumerDir, { recursive: true, force: true });
if (smoke.status !== 0) fail('subpath import smoke failed');

console.log(`pack: distribution ready at ${stageDir}`);
