/**
 * Regenerates `public/_locales/<dir>/messages.json` from the catalogs
 * (`src/bundling/locale-messages.ts`). The files are COMMITTED: Vite
 * copies `public/` into every browser's dist, and the unit test
 * `tests/unit/bundling/locale-messages.test.ts` fails when the committed
 * files and the catalogs disagree — so a catalog edit under
 * `extension.manifest.*` is followed by `pnpm run locales` in the same
 * commit. Runs under tsx, the build-plane idiom next to
 * `build-report.ts`; the Vite config itself never imports the i18n
 * package (its config loader externalizes workspace packages to a Node
 * entry that cannot load the catalogs).
 *
 * Usage: pnpm run locales
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocaleMessages } from '../../src/bundling/locale-messages';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../public/_locales');

fs.rmSync(localesDir, { recursive: true, force: true });
for (const [dir, messages] of buildLocaleMessages()) {
  const target = path.resolve(localesDir, dir);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.resolve(target, 'messages.json'), `${JSON.stringify(messages, null, 2)}\n`);
}
