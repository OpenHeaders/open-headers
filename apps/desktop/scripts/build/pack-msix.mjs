/**
 * Packs the Windows package: the second wrapper around the signed tree
 * the installer is compiled from.
 *
 *   node scripts/build/pack-msix.mjs <tree> <version> <signer> <out dir>
 *
 *   <tree>     the unpacked app, as the release leg signed it
 *   <version>  the release's version (2026.11.3, 2026.11.3-beta.2)
 *   <signer>   a file that carries the certificate the package will be
 *              signed with: a signed program, or a certificate file
 *   <out dir>  where `<product>-<version>-<arch>.msix` lands
 *
 * The package is laid out in a folder first:
 *
 *   assets\            the logo set, as committed
 *   resources.pri      the index of the logo set, made while nothing else is there
 *   AppxManifest.xml   build/windows/AppxManifest.xml, its three values filled
 *   app\               the tree, byte for byte
 *
 * Nothing in the package is typed that can be read: the arch comes from
 * the program's own header and the publisher from the signer's
 * certificate, in Windows' spelling — a package whose manifest names
 * another publisher than its signature cannot be signed.
 *
 * The layout runs anywhere. Reading a signer, indexing and packing need
 * Windows and its SDK. The package is not signed here.
 */

import { execFileSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packageVersion } from '../../../../scripts/lib/versions.mjs';

// The tree is read here as files on disk. Under the desktop's own
// runtime `fs` opens an .asar as an archive instead; plain Node has no
// such switch and ignores this one.
process.noAsar = true;

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST_TEMPLATE = path.join(appDir, 'build', 'windows', 'AppxManifest.xml');
const RESOURCE_INDEX_CONFIG = path.join(appDir, 'build', 'windows', 'priconfig.xml');
const LOGO_SET_DIR = path.join(appDir, 'build', 'windows', 'package-assets');
const PRODUCT_NAME = JSON.parse(readFileSync(path.join(appDir, 'package.json'), 'utf8')).build.productName;

/** The manifest's name in a package, and the folders beside it. */
const MANIFEST_FILE_NAME = 'AppxManifest.xml';
const TREE_DIR_NAME = 'app';
const LOGO_SET_DIR_NAME = 'assets';
const RESOURCE_INDEX_FILE_NAME = 'resources.pri';

/** The file the classic installer adds to an installed tree. */
const CLASSIC_UNINSTALLER_FILE_NAME = `Uninstall ${PRODUCT_NAME}.exe`;

/** A PE header's machine field, as a manifest names the arch. */
const PACKAGE_ARCH_BY_MACHINE = new Map([
  [0x8664, 'x64'],
  [0xaa64, 'arm64'],
]);

function escapeXmlAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The manifest with its values filled. Each must have exactly one place, and none may be left. */
export function fillManifest(template, values) {
  let manifest = template;
  for (const [name, value] of Object.entries(values)) {
    const token = `\${${name}}`;
    const places = manifest.split(token).length - 1;
    if (places !== 1) throw new Error(`the manifest has ${places} places for ${token}, not one`);
    manifest = manifest.replace(token, () => escapeXmlAttribute(value));
  }
  const left = /\$\{[^}]*\}/.exec(manifest);
  if (left) throw new Error(`the manifest keeps an unfilled ${left[0]}`);
  return manifest;
}

/** The product's manifest, its three values still to fill. */
export function manifestTemplate() {
  return readFileSync(MANIFEST_TEMPLATE, 'utf8');
}

function unescapeXmlAttribute(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** A manifest's identity, each value as the text it stands for. */
export function manifestIdentity(manifest) {
  const element = /<Identity\b([^>]*)\/>/.exec(manifest)?.[1];
  if (element === undefined) throw new Error('the manifest names no identity');
  const values = Object.fromEntries(
    [...element.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], unescapeXmlAttribute(match[2])]),
  );
  for (const name of ['Name', 'ProcessorArchitecture', 'Publisher', 'Version']) {
    if (!values[name]) throw new Error(`the manifest's identity has no ${name}`);
  }
  return {
    name: values.Name,
    arch: values.ProcessorArchitecture,
    publisher: values.Publisher,
    version: values.Version,
  };
}

/** The programs the manifest starts, as paths inside the package. */
function manifestPrograms(manifest) {
  return [...new Set([...manifest.matchAll(/\bExecutable="([^"]+)"/g)].map((match) => match[1]))];
}

/** Where the app's program — the first the manifest starts — lies in a tree. */
export function appProgramInTree(manifest, treeDir) {
  const [program] = manifestPrograms(manifest);
  const treePrefix = `${TREE_DIR_NAME}\\`;
  if (!program?.startsWith(treePrefix)) throw new Error(`the manifest starts no program under ${treePrefix}`);
  return path.join(treeDir, ...program.slice(treePrefix.length).split('\\'));
}

/** The package arch of a program, from its PE header. */
export function programArch(file) {
  const fd = openSync(file, 'r');
  try {
    const dos = Buffer.alloc(64);
    if (readSync(fd, dos, 0, dos.length, 0) < dos.length || dos.readUInt16LE(0) !== 0x5a4d) {
      throw new Error(`${file} is not a Windows program`);
    }
    // The PE signature (4 bytes), then the COFF header, which opens with the machine.
    const head = Buffer.alloc(6);
    if (readSync(fd, head, 0, head.length, dos.readUInt32LE(0x3c)) < head.length || head.readUInt32LE(0) !== 0x00004550) {
      throw new Error(`${file} is not a Windows program`);
    }
    const machine = head.readUInt16LE(4);
    const arch = PACKAGE_ARCH_BY_MACHINE.get(machine);
    if (!arch) throw new Error(`${file} is built for a machine no package is made for (0x${machine.toString(16)})`);
    return arch;
  } finally {
    closeSync(fd);
  }
}

/**
 * Lays the package out in `stagingDir` and returns what was read on the
 * way. `indexLogoSet` runs while the logo set is all the folder holds:
 * the index names each file it finds by its path from the package's
 * root, and it is to find nothing else.
 */
export function layOutPackage({ treeDir, version, publisher, stagingDir, indexLogoSet }) {
  const filledVersion = packageVersion(version);
  if (!existsSync(treeDir) || !statSync(treeDir).isDirectory()) throw new Error(`no tree at ${treeDir}`);
  if (existsSync(path.join(treeDir, CLASSIC_UNINSTALLER_FILE_NAME))) {
    throw new Error(`${treeDir} holds ${CLASSIC_UNINSTALLER_FILE_NAME}: it is an installed copy, not the signed tree`);
  }

  const template = manifestTemplate();
  const programs = manifestPrograms(template);
  const treePrefix = `${TREE_DIR_NAME}\\`;
  for (const program of programs) {
    if (!program.startsWith(treePrefix)) throw new Error(`the manifest starts ${program}, which is outside ${treePrefix}`);
    const inTree = path.join(treeDir, ...program.slice(treePrefix.length).split('\\'));
    if (!existsSync(inTree)) throw new Error(`the manifest starts ${program}, and the tree has no ${inTree}`);
  }
  const arch = programArch(appProgramInTree(template, treeDir));
  const manifest = fillManifest(template, { arch, publisher, version: filledVersion });

  if (existsSync(stagingDir) && readdirSync(stagingDir).length > 0) throw new Error(`${stagingDir} is not empty`);
  mkdirSync(stagingDir, { recursive: true });
  cpSync(LOGO_SET_DIR, path.join(stagingDir, LOGO_SET_DIR_NAME), { recursive: true });
  indexLogoSet({ stagingDir, indexName: manifestIdentity(manifest).name });
  writeFileSync(path.join(stagingDir, MANIFEST_FILE_NAME), manifest);
  cpSync(treeDir, path.join(stagingDir, TREE_DIR_NAME), { recursive: true });

  return { arch, packageVersion: filledVersion, artifactName: `${PRODUCT_NAME}-${version}-${arch}.msix` };
}

function requireWindows(what) {
  if (process.platform !== 'win32') throw new Error(`${what} needs Windows`);
}

/**
 * The subject of the certificate a file carries — a signed program's
 * signer, or a certificate file's own — as Windows spells it. That
 * spelling is the one a manifest's publisher is compared in.
 */
function readPublisher(signerFile) {
  requireWindows('reading a signer');
  if (!existsSync(signerFile)) throw new Error(`no signer file at ${signerFile}`);
  const command = [
    "$ErrorActionPreference = 'Stop'",
    '$signer = (Get-AuthenticodeSignature -LiteralPath $env:OH_SIGNER_FILE).SignerCertificate',
    'if (-not $signer) { $signer = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $env:OH_SIGNER_FILE }',
    '[Console]::Out.Write($signer.Subject)',
  ].join('\n');
  const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  let subject;
  try {
    // Encoded, so no shell or argument quoting stands between this script and PowerShell.
    subject = execFileSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, OH_SIGNER_FILE: signerFile } },
    ).trim();
  } catch {
    throw new Error(`${signerFile} carries no certificate Windows can read`);
  }
  if (!subject) throw new Error(`${signerFile} carries a certificate with no subject`);
  return subject;
}

/** The newest SDK tools folder for this machine's own arch that holds both tools. */
function sdkToolsDir() {
  requireWindows('packing');
  const binDir = path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  const versions = existsSync(binDir) ? readdirSync(binDir).filter((name) => /^\d+(\.\d+){3}$/.test(name)) : [];
  const byNewest = versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const sdkVersion of byNewest) {
    const dir = path.join(binDir, sdkVersion, process.arch);
    if (existsSync(path.join(dir, 'makepri.exe')) && existsSync(path.join(dir, 'makeappx.exe'))) return dir;
  }
  throw new Error(`no Windows SDK with makepri.exe and makeappx.exe for ${process.arch} under ${binDir}`);
}

function fail(message) {
  console.error(`pack-msix: ${message}`);
  process.exit(1);
}

function main([tree, version, signer, outDir]) {
  if (!tree || !version || !signer || !outDir) fail('usage: pack-msix.mjs <tree> <version> <signer> <out dir>');
  const out = path.resolve(outDir);
  const stagingDir = path.join(out, 'msix-staging');
  try {
    const toolsDir = sdkToolsDir();
    const publisher = readPublisher(path.resolve(signer));
    rmSync(stagingDir, { recursive: true, force: true });
    const laidOut = layOutPackage({
      treeDir: path.resolve(tree),
      version,
      publisher,
      stagingDir,
      indexLogoSet: ({ stagingDir: packageRoot, indexName }) => {
        execFileSync(
          path.join(toolsDir, 'makepri.exe'),
          [
            'new',
            '/o',
            '/pr',
            packageRoot,
            '/cf',
            RESOURCE_INDEX_CONFIG,
            '/in',
            indexName,
            '/of',
            path.join(packageRoot, RESOURCE_INDEX_FILE_NAME),
          ],
          { stdio: 'inherit' },
        );
      },
    });
    const artifact = path.join(out, laidOut.artifactName);
    // `/l`: the logos are named once in the manifest and found through the index, not as files of that name.
    execFileSync(path.join(toolsDir, 'makeappx.exe'), ['pack', '/o', '/l', '/d', stagingDir, '/p', artifact], {
      stdio: 'inherit',
    });
    rmSync(stagingDir, { recursive: true, force: true });
    console.log(`pack-msix: ${artifact} (${laidOut.arch}, ${laidOut.packageVersion}, publisher ${publisher})`);
  } catch (error) {
    fail(error.message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
