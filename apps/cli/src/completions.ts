/**
 * Shell completions — generated from the same command tables that
 * drive dispatch, so a new verb completes the moment its spec lands.
 * Static by design: words only (commands, verbs, per-command flags),
 * never a daemon round-trip at completion time.
 */

import { EXEC_COMMANDS } from './exec-commands';
import { UsageError } from './exit-codes';
import { READ_COMMANDS } from './read-commands';
import { WRITE_COMMANDS } from './write-commands';

export type CompletionShell = 'bash' | 'zsh';

const CONNECTION_FLAGS = ['--daemon', '--token', '--workspace', '--json'];

interface CommandTree {
  /** First-word completions: local commands + every table group. */
  top: string[];
  /** group → verbs (groups with a bare '' verb, e.g. `activity`, have none). */
  verbs: Map<string, string[]>;
  /** "group verb" (or bare group / local command) → flag words. */
  flags: Map<string, string[]>;
}

function buildTree(): CommandTree {
  const verbs = new Map<string, string[]>();
  const flags = new Map<string, string[]>();

  flags.set('status', CONNECTION_FLAGS);
  flags.set('connect', CONNECTION_FLAGS);
  // Local command with value words instead of verbs — the channel names
  // complete at the second word, `--json` afterwards.
  verbs.set('channel', ['stable', 'beta']);
  flags.set('channel', ['--json']);
  verbs.set('autoupdate', ['on', 'off']);
  flags.set('autoupdate', ['--json']);
  flags.set('upgrade', ['--channel', '--json']);
  flags.set('changelog', ['--json']);

  for (const spec of READ_COMMANDS) {
    const key = spec.verb === '' ? spec.group : `${spec.group} ${spec.verb}`;
    flags.set(key, [...CONNECTION_FLAGS, ...(spec.limitOption === true ? ['--limit'] : [])]);
    if (spec.verb !== '') verbs.set(spec.group, [...(verbs.get(spec.group) ?? []), spec.verb]);
  }
  for (const spec of [...WRITE_COMMANDS, ...EXEC_COMMANDS]) {
    flags.set(`${spec.group} ${spec.verb}`, [
      ...CONNECTION_FLAGS,
      ...Object.keys(spec.extraOptions ?? {}).map((name) => `--${name}`),
    ]);
    verbs.set(spec.group, [...(verbs.get(spec.group) ?? []), spec.verb]);
  }

  const groups = [...new Set([...verbs.keys(), ...READ_COMMANDS.filter((s) => s.verb === '').map((s) => s.group)])];
  return { top: ['status', 'connect', 'upgrade', 'changelog', 'completion', 'tui', 'help', ...groups], verbs, flags };
}

/** case arms for the second word: verbs per group, or flags for verb-less commands. */
function secondWordArms(tree: CommandTree, reply: (words: string[]) => string): string[] {
  const arms: string[] = [];
  for (const [group, groupVerbs] of tree.verbs) {
    arms.push(`    ${group}) ${reply(groupVerbs)};;`);
  }
  for (const key of tree.flags.keys()) {
    if (!key.includes(' ') && !tree.verbs.has(key)) {
      arms.push(`    ${key}) ${reply(tree.flags.get(key) ?? [])};;`);
    }
  }
  arms.push(`    completion) ${reply(['bash', 'zsh'])};;`);
  return arms;
}

/** case arms for later words: per-command flags keyed on "group verb". */
function flagArms(tree: CommandTree, reply: (words: string[]) => string): string[] {
  const arms: string[] = [];
  for (const [key, flagWords] of tree.flags) {
    if (key.includes(' ')) arms.push(`    "${key}") ${reply(flagWords)};;`);
  }
  return arms;
}

function bashScript(tree: CommandTree): string {
  const reply = (words: string[]) => `COMPREPLY=($(compgen -W "${words.join(' ')}" -- "$cur"))`;
  const bareArms = [...tree.flags.keys()]
    .filter((key) => !key.includes(' '))
    .map((key) => `    ${key}) ${reply(tree.flags.get(key) ?? [])};;`);
  return `# oh shell completion (bash) — add to your profile:
#   source <(oh completion bash)
_oh() {
  local cur group verb
  cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    ${reply(tree.top)}
    return
  fi
  group="\${COMP_WORDS[1]}"
  if [ "$COMP_CWORD" -eq 2 ]; then
    case "$group" in
${secondWordArms(tree, reply).join('\n')}
    esac
    return
  fi
  verb="\${COMP_WORDS[2]}"
  case "$group $verb" in
${flagArms(tree, reply).join('\n')}
    *) case "$group" in
${bareArms.join('\n')}
    esac;;
  esac
}
complete -F _oh oh`;
}

function zshScript(tree: CommandTree): string {
  const reply = (words: string[]) => `compadd -- ${words.join(' ')}`;
  const bareArms = [...tree.flags.keys()]
    .filter((key) => !key.includes(' '))
    .map((key) => `    ${key}) ${reply(tree.flags.get(key) ?? [])};;`);
  return `#compdef oh
# oh shell completion (zsh) — either place this file as _oh on your
# fpath, or add to your profile:
#   source <(oh completion zsh)
_oh() {
  if (( CURRENT == 2 )); then
    ${reply(tree.top)}
    return
  fi
  local group="\${words[2]}"
  if (( CURRENT == 3 )); then
    case "$group" in
${secondWordArms(tree, reply).join('\n')}
    esac
    return
  fi
  local verb="\${words[3]}"
  case "$group $verb" in
${flagArms(tree, reply).join('\n')}
    *) case "$group" in
${bareArms.join('\n')}
    esac;;
  esac
}
if [[ "\${zsh_eval_context[-1]}" == "loadautofunc" ]]; then
  _oh "$@"
else
  compdef _oh oh
fi`;
}

export function completionScript(shell: string | undefined): string {
  const tree = buildTree();
  if (shell === 'bash') return bashScript(tree);
  if (shell === 'zsh') return zshScript(tree);
  throw new UsageError('usage: oh completion bash|zsh');
}
