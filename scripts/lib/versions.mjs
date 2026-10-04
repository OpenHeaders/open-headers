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

/** `stable` | `beta` from the tag shape — the only channel authority. */
export function channelForTag(tag) {
  return /-beta[.0-9]*$/.test(tag) ? 'beta' : 'stable';
}
