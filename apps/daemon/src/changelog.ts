/**
 * This build's own release notes, embedded at build
 * (CHANGELOG_PLAN.md §4.3): the bundle configs stamp the canonical
 * `changelog/daemon` entry body into `__DAEMON_CHANGELOG__`, and the
 * spine serves it to admin surfaces over `oh.daemon.changelog.get` —
 * the served browser tab never dials the feed (offline law). Empty on
 * an unbundled dev run or an entry-less version (entry-existence law);
 * the admin card then hides.
 */

/** Build-time embedded entry body; empty when unbundled or entry-less. */
declare const __DAEMON_CHANGELOG__: string | undefined;

export const DAEMON_CHANGELOG: string = typeof __DAEMON_CHANGELOG__ === 'string' ? __DAEMON_CHANGELOG__ : '';
