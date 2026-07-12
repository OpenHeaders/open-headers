/**
 * electron-builder `msiProjectCreated` hook.
 *
 * WiX caps the MSI ProductVersion's major segment at 255, so the CalVer
 * the app ships under (2026.M.P) fails compilation (CNDL0242). Map the
 * year to its two-digit form (2026 → 26) in the generated .wxs — the
 * MSI metadata only; NSIS, macOS, and the update feed keep full CalVer.
 * The mapping stays monotonic, so MSI major-upgrade detection keeps
 * ordering across releases.
 */

const fs = require('node:fs');

module.exports = function msiProjectCreated(projectPath) {
  const wxs = fs.readFileSync(projectPath, 'utf8');
  const patched = wxs.replace(
    /Version="(\d{4})\.(\d+)\.(\d+)(\.\d+)?"/,
    (_m, year, minor, patch, revision) => `Version="${Number(year) % 100}.${minor}.${patch}${revision ?? ''}"`,
  );
  if (patched === wxs) {
    throw new Error(`msi-project-created: no 4-digit-year Version attribute found in ${projectPath}`);
  }
  fs.writeFileSync(projectPath, patched);
};
