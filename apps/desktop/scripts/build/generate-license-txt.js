/**
 * Derives build/license.txt from the repo-root LICENSE.md so the
 * installers always carry the current EULA without a second copy to
 * keep in sync. electron-builder picks it up in two places: the DMG
 * builder attaches build resources' license.txt as the image's
 * agree-on-mount license, and the NSIS config references it explicitly.
 */

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', '..', '..', '..', 'LICENSE.md');
const target = path.join(__dirname, '..', '..', 'build', 'license.txt');

const markdown = fs.readFileSync(source, 'utf8');

// Em dashes fold to plain hyphens: the NSIS license box decodes a
// BOM-less file as ANSI, so any non-ASCII byte renders as mojibake.
const text = markdown
  .replace(/^#+\s*/gm, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/^- /gm, '  - ')
  .replace(/—/g, '-');

fs.writeFileSync(target, text);
console.log(`Wrote ${target} from ${source}`);
