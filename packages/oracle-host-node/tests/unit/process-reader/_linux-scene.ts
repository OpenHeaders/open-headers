/**
 * The kept /proc text of one terminal scene, as a source the Linux
 * reader reads. The text is REAL — dumped inside a Linux container by
 * `fixtures/linux-terminal-scene.sh` — and nothing in it is edited:
 *
 *   1   the container's init (root)        — its executable link refused
 *   7   the pty's keeper (root), child of 1 — its executable link refused
 *   8   the terminal's shell, the session leader on the pty
 *   9   a child of the shell that stays
 *   10  a child of the shell whose own child burned one second and exited
 *   12  started under the shell, outlived its parent: now a child of 1,
 *       still on the shell's terminal
 */

import { readFileSync } from 'node:fs';
import type { LinuxProcSource } from '../../../src/process-reader';

const SECTION = /^==> (file|link|dir|refused|note)(?: (\S+))? <==$/;

interface Scene {
  files: Map<string, string>;
  links: Map<string, string>;
  dirs: Map<string, string[]>;
}

function parseScene(text: string): Scene {
  const scene: Scene = { files: new Map(), links: new Map(), dirs: new Map() };
  let kind = 'note';
  let path = '';
  let lines: string[] = [];
  const flush = (): void => {
    if (kind === 'file') scene.files.set(path, `${lines.join('\n')}\n`);
    if (kind === 'link') scene.links.set(path, lines[0]);
    if (kind === 'dir') scene.dirs.set(path, lines);
    lines = [];
  };
  for (const line of text.split('\n')) {
    const header = SECTION.exec(line);
    if (header === null) {
      lines.push(line);
      continue;
    }
    flush();
    kind = header[1];
    path = header[2] ?? '';
  }
  flush();
  return scene;
}

const SCENE = parseScene(readFileSync(new URL('./fixtures/linux-terminal-scene.txt', import.meta.url), 'utf8'));

export const SCENE_PIDS = { init: 1, ptyKeeper: 7, shell: 8, stays: 9, waited: 10, outlived: 12 } as const;

/** Seconds since the epoch the scene's system booted — its `btime`. */
export const SCENE_BOOT_SECONDS = 1_795_181_941;

export interface SceneOverrides {
  files?: Record<string, string | null>;
  links?: Record<string, string | null>;
}

/** The scene as it was dumped; an override replaces one path's answer, and null takes it away. */
export function sceneSource(overrides: SceneOverrides = {}): LinuxProcSource {
  const pick = <T>(over: Record<string, T | null> | undefined, kept: Map<string, T>, path: string): T | null =>
    over !== undefined && path in over ? over[path] : (kept.get(path) ?? null);
  return {
    readFile: (path) => pick(overrides.files, SCENE.files, path),
    readLink: (path) => pick(overrides.links, SCENE.links, path),
    readDir: (path) => SCENE.dirs.get(path) ?? null,
  };
}

/** The scene on a kernel built without the per-thread children list. */
export function sceneSourceWithoutChildrenLists(): LinuxProcSource {
  const whole = sceneSource();
  return { ...whole, readFile: (path) => (path.endsWith('/children') ? null : whole.readFile(path)) };
}
