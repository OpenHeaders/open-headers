/**
 * Writes the Safari containing app's two version numbers into the Xcode
 * project from the extension's package CalVer (the Safari distribution
 * plan §4 F6): `MARKETING_VERSION` is the CalVer verbatim, and
 * `CURRENT_PROJECT_VERSION` is `YYYYMMPP.N` — the CalVer with the month
 * and patch zero-padded, then an UPLOAD ORDINAL this script persists in
 * `safari/upload-ordinal.json`. App Store Connect refuses a build number
 * it has seen, and a rejected or failed upload burns its number, so the
 * ordinal only ever grows within a CalVer: `--bump` takes the next one
 * before an upload and the state file is committed with the release.
 *
 * Nobody types a number into Xcode. The extension never carries a beta
 * suffix (stable-only law), so a pre-release version is refused here.
 *
 * Usage: pnpm run version:safari [--bump]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROJECT = path.join(ROOT, 'safari/OpenHeaders for Safari.xcodeproj/project.pbxproj');
const ORDINAL_FILE = path.join(ROOT, 'safari/upload-ordinal.json');

interface UploadOrdinal {
  readonly version: string;
  readonly ordinal: number;
}

export function buildNumberBase(version: string): string {
  const match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(version);
  if (!match) throw new Error(`safari-version: "${version}" is not a release CalVer (YYYY.M.PATCH, no suffix)`);
  const [, year, month, patch] = match;
  return `${year}${month.padStart(2, '0')}${patch.padStart(2, '0')}`;
}

function readOrdinal(version: string): UploadOrdinal {
  if (!fs.existsSync(ORDINAL_FILE)) return { version, ordinal: 1 };
  const state = JSON.parse(fs.readFileSync(ORDINAL_FILE, 'utf8')) as UploadOrdinal;
  return state.version === version ? state : { version, ordinal: 1 };
}

function replaceSetting(source: string, key: string, value: string): string {
  const pattern = new RegExp(`(${key} = )[^;]+;`, 'g');
  const count = source.match(pattern)?.length ?? 0;
  if (count !== 4) throw new Error(`safari-version: expected 4 "${key}" settings in the project, found ${count}`);
  return source.replace(pattern, `$1${value};`);
}

export function applyVersion(version: string, ordinal: number): string {
  const buildNumber = `${buildNumberBase(version)}.${ordinal}`;
  let project = fs.readFileSync(PROJECT, 'utf8');
  project = replaceSetting(project, 'MARKETING_VERSION', version);
  project = replaceSetting(project, 'CURRENT_PROJECT_VERSION', buildNumber);
  fs.writeFileSync(PROJECT, project);
  return buildNumber;
}

const version: string = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const bump = process.argv.includes('--bump');
const current = readOrdinal(version);
const next: UploadOrdinal = bump
  ? { version, ordinal: current.version === version && fs.existsSync(ORDINAL_FILE) ? current.ordinal + 1 : 1 }
  : current;

const buildNumber = applyVersion(version, next.ordinal);
if (bump) fs.writeFileSync(ORDINAL_FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log(`  Safari app version ${version}, build ${buildNumber}${bump ? ' (ordinal bumped)' : ''}`);
