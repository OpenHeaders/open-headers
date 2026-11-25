/**
 * Generates the Windows package's logo set from the app's own artwork.
 *
 * A package names three images in its manifest — the app-list icon, the
 * medium tile and the package logo — and Windows picks, per image, the
 * file whose name carries the size it needs. Every file here is a
 * render of the SVG the shipped icons are rendered from, by the same
 * renderer; nothing is drawn.
 *
 *   node scripts/build/generate-package-logos.mjs          render the set
 *   node scripts/build/generate-package-logos.mjs --list   print "<file> <pixels>" per image
 *
 * The app-list icon comes in exact sizes, each under three names: the
 * plain one, and one per theme that Windows shows without a plate
 * behind it. Without those two the taskbar shrinks the icon onto a
 * plate. The artwork carries its own background, so all three are the
 * same picture.
 *
 * The medium tile is the padded artwork: a tile is a surface the icon
 * sits on, not one it fills.
 *
 * Rendering needs `rsvg-convert` on the PATH. The set is committed; the
 * pack script copies it as it is.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARTWORK = path.join(appDir, 'build', 'assets', 'logo.svg');
const PADDED_ARTWORK = path.join(appDir, 'build', 'assets', 'logo-padded.svg');
const OUTPUT_DIR = path.join(appDir, 'build', 'windows', 'package-assets');

/** The exact sizes Windows asks the app-list icon for, across its display scales. */
const TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256];

/** Plain, shown bare on a dark theme, shown bare on a light theme. */
const TARGET_SIZE_FORMS = ['', '_altform-unplated', '_altform-lightunplated'];

const SCALES = [100, 125, 150, 200, 400];

/** The images the manifest names, with the size of each at scale 100. */
const SCALED_LOGOS = [
  { name: 'Square44x44Logo', base: 44, artwork: ARTWORK },
  { name: 'Square150x150Logo', base: 150, artwork: PADDED_ARTWORK },
  { name: 'StoreLogo', base: 50, artwork: ARTWORK },
];

function logoSet() {
  const set = [];
  for (const size of TARGET_SIZES) {
    for (const form of TARGET_SIZE_FORMS) {
      set.push({ file: `Square44x44Logo.targetsize-${size}${form}.png`, pixels: size, artwork: ARTWORK });
    }
  }
  for (const { name, base, artwork } of SCALED_LOGOS) {
    for (const scale of SCALES) {
      set.push({ file: `${name}.scale-${scale}.png`, pixels: Math.round((base * scale) / 100), artwork });
    }
  }
  return set;
}

function main([option]) {
  const set = logoSet();
  if (option === '--list') {
    for (const { file, pixels } of set) console.log(`${file} ${pixels}`);
    return;
  }
  if (option !== undefined) {
    console.error('generate-package-logos: usage: generate-package-logos.mjs [--list]');
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const stale of readdirSync(OUTPUT_DIR)) rmSync(path.join(OUTPUT_DIR, stale));
  for (const { file, pixels, artwork } of set) {
    execFileSync('rsvg-convert', ['-w', String(pixels), '-h', String(pixels), artwork, '-o', path.join(OUTPUT_DIR, file)]);
  }
  console.log(`generate-package-logos: ${set.length} images in ${OUTPUT_DIR}`);
}

main(process.argv.slice(2));
