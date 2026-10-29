/**
 * Regenerates the two committed `_locales` sets from the catalogs
 * (`src/bundling/locale-messages.ts`): `public/_locales/<dir>/messages.json`
 * (Vite copies `public/` into every browser's dist) and
 * `manifests/safari/_locales/<dir>/messages.json` (the Safari build
 * overlays it — the shorter App Store Connect description). The unit
 * test `tests/unit/bundling/locale-messages.test.ts` fails when the
 * committed files and the catalogs disagree — so a catalog edit under
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
import { buildLocaleMessages, type ManifestLocaleTarget } from '../../src/bundling/locale-messages';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SETS: Record<ManifestLocaleTarget, string> = {
  store: path.resolve(__dirname, '../../public/_locales'),
  safari: path.resolve(__dirname, '../../manifests/safari/_locales'),
};

for (const [target, localesDir] of Object.entries(SETS) as Array<[ManifestLocaleTarget, string]>) {
  fs.rmSync(localesDir, { recursive: true, force: true });
  for (const [dir, messages] of buildLocaleMessages(target)) {
    const targetDir = path.resolve(localesDir, dir);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.resolve(targetDir, 'messages.json'), `${JSON.stringify(messages, null, 2)}\n`);
  }
}
