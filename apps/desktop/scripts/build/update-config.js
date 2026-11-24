/**
 * The update config of a Windows package (`resources/app-update.yml`).
 *
 * The updater reads two facts from it at run time: the folder its
 * download cache lives in, and the publisher a downloaded installer
 * must be signed by. The installer keeps a copy of itself in that same
 * folder — the old file a differential download is computed against —
 * so the app and its installer have to name it from one place: the
 * builder.
 *
 * The builder writes the file itself in every pack that has an
 * installer target. The signed lane packs the unpacked tree alone first
 * (the tree is signed before its installers are built from it), and
 * that pack gets no file from the builder. `writeUpdateConfig` writes
 * it there with the builder's own function: the folder name, the feed
 * and the publisher are the builder's values, never ours.
 *
 * The publisher is `win.signtoolOptions.publisherName` in the build
 * config, by common name only — the full-name compare is brittle across
 * Windows' renderings of it. A lane whose installer ships unsigned
 * packs with `win.verifyUpdateCodeSignature` false and the builder
 * leaves the name out: an install that carried it would refuse that
 * lane's own updates.
 *
 * The release leg checks the outcome after packaging:
 *
 *   node scripts/build/update-config.js <unpacked dir> <packaging log>
 *
 * The packaging step runs with `DEBUG=electron-builder:nsis`, so its
 * log holds the values the builder handed to the installer's compiler.
 * The check fails unless the folder the installer keeps its copy in is
 * the folder the packed app reads.
 */

const fs = require('fs');
const path = require('path');

// The builder's library, reached through the builder this app depends on.
const builderDir = path.dirname(require.resolve('electron-builder/package.json'));
const fromBuilder = (id) => require(require.resolve(id, { paths: [builderDir] }));
const { getAppUpdatePublishConfiguration } = fromBuilder('app-builder-lib/out/publish/PublishManager');
const { serializeToYaml } = fromBuilder('builder-util');

const UPDATE_CONFIG = 'app-update.yml';
// The installer's copy of itself, as the builder names it inside the cache folder.
const INSTALLER_STORE_DEFINE = /APP_INSTALLER_STORE_FILE: '([^']*)'/g;

/**
 * Writes the update config into a packed tree the builder left without
 * one, and returns what it wrote; null when the builder's file is
 * already there.
 */
async function writeUpdateConfig({ packager, appOutDir, arch }) {
  const file = path.join(appOutDir, 'resources', UPDATE_CONFIG);
  if (fs.existsSync(file)) return null;
  const config = await getAppUpdatePublishConfiguration(packager, null, arch, false);
  if (config == null) throw new Error('update-config: the build config names no update feed (`publish`)');
  fs.writeFileSync(file, serializeToYaml(config));
  return config;
}

/** The cache folder a packed tree's update config names. */
function packedCacheDirName(unpackedDir) {
  const file = path.join(unpackedDir, 'resources', UPDATE_CONFIG);
  if (!fs.existsSync(file)) throw new Error(`update-config: no ${UPDATE_CONFIG} at ${file}`);
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('updaterCacheDirName:'));
  const name = line ? line.slice(line.indexOf(':') + 1).trim() : '';
  if (name === '') throw new Error(`update-config: ${file} names no updaterCacheDirName`);
  return name;
}

/** The cache folder the installer was compiled to keep its copy in, read from the packaging log. */
function installerCacheDirName(packagingLog) {
  // The log prints the value as a quoted string, its path separator doubled.
  const folders = [...packagingLog.matchAll(INSTALLER_STORE_DEFINE)].map(([, storeFile]) =>
    path.win32.dirname(storeFile.replace(/\\\\/g, '\\')),
  );
  if (folders.length === 0) {
    throw new Error('update-config: the packaging log holds no APP_INSTALLER_STORE_FILE (DEBUG=electron-builder:nsis)');
  }
  const distinct = [...new Set(folders)];
  if (distinct.length > 1) {
    throw new Error(`update-config: the packaging log names more than one installer folder: ${distinct.join(', ')}`);
  }
  return distinct[0];
}

function checkCacheDirName(unpackedDir, packagingLog) {
  const packed = packedCacheDirName(unpackedDir);
  const installer = installerCacheDirName(packagingLog);
  if (packed !== installer) {
    throw new Error(
      `update-config: the packed app reads its update cache in "${packed}" and the installer keeps its copy in "${installer}" — every update would be a full download`,
    );
  }
  return packed;
}

function main([unpackedDir, logFile]) {
  if (!unpackedDir || !logFile) {
    console.error('update-config: usage: update-config.js <unpacked dir> <packaging log>');
    process.exit(1);
  }
  try {
    const name = checkCacheDirName(path.resolve(unpackedDir), fs.readFileSync(logFile, 'utf8'));
    console.log(`update-config: the packed app and its installer both use "${name}"`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { writeUpdateConfig, checkCacheDirName };

if (require.main === module) main(process.argv.slice(2));
