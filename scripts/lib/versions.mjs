/**
 * Version and channel rules shared by the release scripts: the CalVer
 * compare every feed decision rests on, and the tag-shape channel
 * authority. One implementation, so the manifest generator, the feed
 * generator, the apt/rpm stagers and the entry patcher can never
 * disagree on which of two versions is newer.
 */

/**
 * Numeric segment-wise CalVer compare, prerelease-aware: on an equal
 * base a `-beta.N` sorts below the plain release and betas order by N.
 * Mirrors the client's `compareCalVer` (versions-manifest.ts) exactly.
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const match = /-beta\.(\d+)$/.exec(v);
    return {
      base: v
        .replace(/-beta\.\d+$/, '')
        .split('.')
        .map(Number),
      beta: match ? Number(match[1]) : null,
    };
  };
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(pa.base.length, pb.base.length); i++) {
    const diff = (pa.base[i] ?? 0) - (pb.base[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.beta === null && pb.beta === null) return 0;
  if (pa.beta === null) return 1;
  if (pb.beta === null) return -1;
  return pa.beta - pb.beta;
}

/** The largest number Windows takes in one part of a package version. */
const PACKAGE_VERSION_PART_MAX = 65535;

/** The fourth number of a stable's package version; a beta N takes N, so N stays below it. */
const STABLE_PACKAGE_REVISION = 1000;

/**
 * The Windows package version of a release. A package version is four
 * numbers and has no prerelease part, so CalVer `Y.M.P` becomes
 * `Y.M.P.R`: beta N takes R = N, the stable R = 1000. A stable then
 * sorts above every beta of its base, and the next base above the
 * stable — the order {@link compareVersions} gives the releases.
 *
 * Throws on anything that is not exactly one release version: two
 * spellings of a release would be two package versions, or one package
 * version for two releases.
 */
export function packageVersion(version) {
  const match = /^([1-9]\d{3})\.([1-9]\d?)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.exec(version);
  if (!match) throw new Error(`'${version}' is not a release version (YYYY.M.PATCH or YYYY.M.PATCH-beta.N)`);
  const [year, month, patch] = [match[1], match[2], match[3]].map(Number);
  if (month > 12) throw new Error(`'${version}' names month ${month}`);
  if (patch > PACKAGE_VERSION_PART_MAX) {
    throw new Error(`'${version}': Windows takes no package version part above ${PACKAGE_VERSION_PART_MAX}`);
  }
  if (match[4] === undefined) return `${year}.${month}.${patch}.${STABLE_PACKAGE_REVISION}`;
  const beta = Number(match[4]);
  if (beta < 1 || beta >= STABLE_PACKAGE_REVISION) {
    throw new Error(`'${version}': a beta is numbered 1 to ${STABLE_PACKAGE_REVISION - 1}`);
  }
  return `${year}.${month}.${patch}.${beta}`;
}

/** `stable` | `beta` from the tag shape — the only channel authority. */
export function channelForTag(tag) {
  return /-beta[.0-9]*$/.test(tag) ? 'beta' : 'stable';
}
