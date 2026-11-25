/**
 * Checks a signed Windows package against the tree it was packed from
 * and the certificate it was signed with — the release leg runs it
 * before the package leaves the leg.
 *
 *   node scripts/build/check-msix.mjs <manifest> <tree>
 *
 *   <manifest>  AppxManifest.xml, taken out of the signed package
 *   <tree>      the unpacked app the package was packed from
 *
 *   OH_PACKAGE_SIGNER  the subject of the certificate the package is
 *                      signed with, as Windows spells it
 *
 * Four things a package's identity says, each held to where it is read:
 *
 *   the name       the product's own manifest
 *   the arch       the header of the tree's program
 *   the version    the app's own version, inside the tree's archive —
 *                  the pack stamps the version it is handed
 *   the publisher  the package's signer: Windows takes an update only
 *                  from the publisher the installed package names
 *
 * The signature itself — valid, timestamped — is Windows' to read; the
 * leg reads it and hands the signer's subject over.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageVersion } from '../../../../scripts/lib/versions.mjs';
import { appProgramInTree, manifestIdentity, manifestTemplate, programArch } from './pack-msix.mjs';

// The tree is read here as files on disk. Under the desktop's own
// runtime `fs` opens an .asar as an archive instead; plain Node has no
// such switch and ignores this one.
process.noAsar = true;

const require = createRequire(import.meta.url);

/** The app's own version: the one its archive carries, read with the library the builder wrote it with. */
function appVersion(treeDir) {
  const archive = path.join(treeDir, 'resources', 'app.asar');
  if (!existsSync(archive)) throw new Error(`the tree has no ${archive}`);
  const builderDir = path.dirname(require.resolve('electron-builder/package.json'));
  const builderLibDir = path.dirname(require.resolve('app-builder-lib/package.json', { paths: [builderDir] }));
  const { extractFile } = require(require.resolve('@electron/asar', { paths: [builderLibDir] }));
  const { version } = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
  if (!version) throw new Error(`the app in ${archive} carries no version`);
  return version;
}

/** What a package's identity says against what was read, as one line per difference. */
function identityDifferences(identity, read) {
  return Object.keys(read)
    .filter((part) => identity[part] !== read[part].value)
    .map((part) => `the package's ${part} is '${identity[part]}', ${read[part].source} is '${read[part].value}'`);
}

function fail(message) {
  console.error(`check-msix: ${message}`);
  process.exit(1);
}

function main([manifestFile, tree]) {
  if (!manifestFile || !tree) fail('usage: check-msix.mjs <manifest> <tree>');
  const signer = process.env.OH_PACKAGE_SIGNER;
  if (!signer) fail("OH_PACKAGE_SIGNER is not set: the package's signer is what its publisher is held to");
  if (!existsSync(manifestFile)) fail(`no manifest at ${manifestFile}`);
  const treeDir = path.resolve(tree);

  let identity;
  let differences;
  try {
    const manifest = readFileSync(manifestFile, 'utf8');
    identity = manifestIdentity(manifest);
    const version = appVersion(treeDir);
    differences = identityDifferences(identity, {
      name: { value: manifestIdentity(manifestTemplate()).name, source: "the product's manifest" },
      arch: { value: programArch(appProgramInTree(manifest, treeDir)), source: "the tree's program" },
      version: { value: packageVersion(version), source: `the app's own version (${version})` },
      publisher: { value: signer, source: "the package's signer" },
    });
  } catch (error) {
    fail(error.message);
  }

  console.log(`check-msix: ${identity.name} ${identity.version} ${identity.arch}, publisher ${identity.publisher}`);
  for (const difference of differences) console.error(`check-msix: ${difference}`);
  if (differences.length > 0) fail(`${differences.length} difference(s) between the package and what it was packed from`);
  console.log("check-msix: the package's identity is the tree's and the signer's");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
