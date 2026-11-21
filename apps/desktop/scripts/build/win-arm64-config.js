// The builder config for the Windows ARM installer: package.json's own,
// with the installer named for its arch. The x64 installer keeps the
// bare `-Setup.exe` name every published link and pointer already
// carries; the updater picks an installer by the arch in its file name
// and falls back to the first one listed, so the ARM file must say
// `arm64` and the x64 one may say nothing.
const { build } = require('../../package.json');

const artifactName = '${productName}-${version}-arm64-Setup.${ext}';

module.exports = {
    ...build,
    win: { ...build.win, artifactName },
    nsis: { ...build.nsis, artifactName },
};
