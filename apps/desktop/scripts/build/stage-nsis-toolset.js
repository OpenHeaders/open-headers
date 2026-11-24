/**
 * Stages the installer toolset for the signed Windows lane.
 *
 * The installer and the uninstaller carry plugin libraries from the
 * builder's toolset and unpack them to a temp folder each time they
 * run. The builder ships those libraries unsigned, so the signed lane
 * compiles its installer from a copy of the toolset whose plugins it
 * has signed. This script makes the copy: the builder's two toolset
 * folders, fetched by the builder's own downloader — a builder update
 * brings its toolset with it — land under <dir>.
 *
 *   node scripts/build/stage-nsis-toolset.js <dir>
 *
 *   <dir>/nsis        the compiler's folder, whole
 *   <dir>/resources   the plugin toolset
 *
 * The leg then signs the plugin folder of each
 * (`nsis/Plugins/x86-unicode`, `resources/plugins/x86-unicode`) with
 * `sign-windows.js` and points the builder at the copies through
 * `ELECTRON_BUILDER_NSIS_DIR` and `ELECTRON_BUILDER_NSIS_RESOURCES_DIR`.
 * Only the plugin folders are signed: the compiler's stubs are PE files
 * too, and a stub that carries a signature breaks the installer built
 * on it.
 */

const fs = require('fs');
const path = require('path');
const { build } = require('../../package.json');

// The toolset functions live in the builder's library, reached through
// the builder this app depends on.
const builderDir = path.dirname(require.resolve('electron-builder/package.json'));
const { getNsisElevatePath, getNsisPluginsPath } = require(
  require.resolve('app-builder-lib/out/toolsets/windows', { paths: [builderDir] }),
);

// The installer is a Unicode one unless the config says otherwise, and
// its plugins are 32-bit like the installer itself.
const PLUGIN_ARCH = 'x86-unicode';

function fail(message) {
  console.error(`stage-nsis-toolset: ${message}`);
  process.exit(1);
}

async function main([dir]) {
  if (!dir) fail('usage: stage-nsis-toolset.js <dir>');
  const root = path.resolve(dir);
  const toolset = build.toolsets?.nsis;

  // The elevation helper sits at the root of the compiler's folder.
  const compiler = path.dirname(await getNsisElevatePath(toolset, build.nsis?.customNsisBinary));
  const plugins = await getNsisPluginsPath(toolset, build.nsis?.customNsisResources);

  const staged = [
    { from: compiler, to: path.join(root, 'nsis'), pluginDir: path.join(root, 'nsis', 'Plugins', PLUGIN_ARCH) },
    {
      from: plugins,
      to: path.join(root, 'resources', 'plugins'),
      pluginDir: path.join(root, 'resources', 'plugins', PLUGIN_ARCH),
    },
  ];
  for (const { from, to, pluginDir } of staged) {
    fs.cpSync(from, to, { recursive: true });
    // A toolset laid out another way must stop the leg here, not ship unsigned plugins.
    if (!fs.existsSync(pluginDir)) fail(`no plugin folder at ${pluginDir} (copied from ${from})`);
    console.log(`stage-nsis-toolset: ${from} -> ${to}`);
  }
}

main(process.argv.slice(2)).catch((error) => fail(error.message));
