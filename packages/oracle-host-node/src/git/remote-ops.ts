/**
 * Remote operations of the Git Remotes dialog: list, add, rename,
 * set-url, remove — `git remote …` behind the same discipline as
 * `branch-ops.ts`: explicit repo addressing, the injected
 * {@link GitRunner} seam, caller-supplied names and urls re-checked
 * here as defense in depth (a name that is not a valid remote name or
 * a value that git would read as an option never reaches it),
 * membership decided HERE from the remote list so the refusals stay
 * typed instead of parsed out of stderr, and the url read NUL-safe
 * through `git config -z`.
 */

import type { GitRunner } from './git-exec';
import { failureDetail, repoArgs } from './repo';

/** One configured remote — its fetch url and, when set apart, its push url. */
export interface RepoRemote {
  name: string;
  url: string;
  pushUrl: string | null;
}

export type RemoteOpResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid-name' | 'invalid-url' | 'exists' | 'unknown-remote' | 'remote-failed';
      detail?: string;
    };

/**
 * The remote-name gate: what `git remote add` itself accepts (a
 * one-level refname) without the spawn — letters, digits, `.`, `_`,
 * `-`, no leading `-` or `.`, no `..`, no `.lock` tail, no `@{`.
 */
export function isSafeRemoteName(name: string): boolean {
  if (name.length === 0 || name.length > 255) return false;
  if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name)) return false;
  if (name.includes('..') || name.endsWith('.lock') || name.endsWith('.')) return false;
  return true;
}

/** A url git will take as a url and not as an option: non-empty, no leading `-`, no control characters. */
export function isSafeRemoteUrl(url: string): boolean {
  if (url.length === 0 || url.startsWith('-')) return false;
  for (const ch of url) if (ch.charCodeAt(0) < 0x20 || ch === '\x7f') return false;
  return true;
}

const URL_KEY = /^remote\.(.+)\.(url|pushurl)$/;

/**
 * Every configured remote with its urls: the names from `git remote`,
 * the urls from one NUL-separated config read (`-z --get-regexp`,
 * each record `key\nvalue\0`). A remote named only by other keys
 * answers an empty url. Null when git itself refuses.
 */
export async function listRemotes(run: GitRunner, rootDir: string): Promise<RepoRemote[] | null> {
  const names = await run([...repoArgs(rootDir), 'remote'], { cwd: rootDir });
  if (names.code !== 0) return null;
  const urls = await run([...repoArgs(rootDir), 'config', '-z', '--get-regexp', '^remote\\..*\\.(url|pushurl)$'], {
    cwd: rootDir,
  });
  // `--get-regexp` exits 1 when nothing matches — an empty set, not a failure.
  if (urls.code !== 0 && urls.code !== 1) return null;
  const fetchUrl = new Map<string, string>();
  const pushUrl = new Map<string, string>();
  for (const record of urls.stdout.split('\0')) {
    if (record.length === 0) continue;
    const cut = record.indexOf('\n');
    const key = cut === -1 ? record : record.slice(0, cut);
    const value = cut === -1 ? '' : record.slice(cut + 1);
    const match = URL_KEY.exec(key);
    if (match === null) continue;
    (match[2] === 'url' ? fetchUrl : pushUrl).set(match[1], value);
  }
  return names.stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .map((name) => ({ name, url: fetchUrl.get(name) ?? '', pushUrl: pushUrl.get(name) ?? null }));
}

async function remoteNames(run: GitRunner, rootDir: string): Promise<Set<string> | null> {
  const remotes = await listRemotes(run, rootDir);
  return remotes === null ? null : new Set(remotes.map((remote) => remote.name));
}

/** `git remote add <name> <url>` — refused typed when the name is taken. */
export async function addRemote(run: GitRunner, rootDir: string, name: string, url: string): Promise<RemoteOpResult> {
  if (!isSafeRemoteName(name)) return { ok: false, reason: 'invalid-name' };
  if (!isSafeRemoteUrl(url)) return { ok: false, reason: 'invalid-url' };
  const names = await remoteNames(run, rootDir);
  if (names === null) return { ok: false, reason: 'remote-failed', detail: 'could not list remotes' };
  if (names.has(name)) return { ok: false, reason: 'exists' };
  const result = await run([...repoArgs(rootDir), 'remote', 'add', name, url], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, reason: 'remote-failed', detail: failureDetail(result) };
  return { ok: true };
}

/** `git remote rename <name> <newName>` — the remote-tracking refs and branch configs follow. */
export async function renameRemote(
  run: GitRunner,
  rootDir: string,
  name: string,
  newName: string,
): Promise<RemoteOpResult> {
  if (!isSafeRemoteName(name) || !isSafeRemoteName(newName)) return { ok: false, reason: 'invalid-name' };
  const names = await remoteNames(run, rootDir);
  if (names === null) return { ok: false, reason: 'remote-failed', detail: 'could not list remotes' };
  if (!names.has(name)) return { ok: false, reason: 'unknown-remote' };
  if (names.has(newName)) return { ok: false, reason: 'exists' };
  const result = await run([...repoArgs(rootDir), 'remote', 'rename', name, newName], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, reason: 'remote-failed', detail: failureDetail(result) };
  return { ok: true };
}

/** `git remote set-url <name> <url>` — the fetch url; a separate push url, when any, is left as it is. */
export async function setRemoteUrl(
  run: GitRunner,
  rootDir: string,
  name: string,
  url: string,
): Promise<RemoteOpResult> {
  if (!isSafeRemoteName(name)) return { ok: false, reason: 'invalid-name' };
  if (!isSafeRemoteUrl(url)) return { ok: false, reason: 'invalid-url' };
  const names = await remoteNames(run, rootDir);
  if (names === null) return { ok: false, reason: 'remote-failed', detail: 'could not list remotes' };
  if (!names.has(name)) return { ok: false, reason: 'unknown-remote' };
  const result = await run([...repoArgs(rootDir), 'remote', 'set-url', name, url], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, reason: 'remote-failed', detail: failureDetail(result) };
  return { ok: true };
}

/** `git remote remove <name>` — its remote-tracking refs and branch configs go with it. */
export async function removeRemote(run: GitRunner, rootDir: string, name: string): Promise<RemoteOpResult> {
  if (!isSafeRemoteName(name)) return { ok: false, reason: 'invalid-name' };
  const names = await remoteNames(run, rootDir);
  if (names === null) return { ok: false, reason: 'remote-failed', detail: 'could not list remotes' };
  if (!names.has(name)) return { ok: false, reason: 'unknown-remote' };
  const result = await run([...repoArgs(rootDir), 'remote', 'remove', name], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, reason: 'remote-failed', detail: failureDetail(result) };
  return { ok: true };
}
