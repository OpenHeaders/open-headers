/**
 * editor-keybindings — makes editor-scoped rebinds real.
 *
 * The `kind: 'editor'` SHORTCUTS entries (find / replace / format) are
 * never dispatched by the window shortcut loop; Monaco owns them. Out
 * of the box Monaco dispatches its *built-in* chords, so a rebind in
 * Settings → Keyboard used to change the displayed hint only. This
 * module closes that gap: on first CodeEditor mount it registers the
 * *configured* chords as Monaco keybinding rules and re-registers them
 * whenever the setting changes.
 *
 * Mechanics per binding, applied through Monaco's dynamic keybinding
 * rules (`monaco.editor.addKeybindingRules`, page-global across every
 * mounted editor):
 *   - one `-commandId` removal rule per built-in default chord, so the
 *     stock binding stops dispatching (removals that match no default
 *     rule are no-ops, so the per-platform variants are all listed);
 *   - one rule binding the configured chord to the command (skipped
 *     when unbound).
 * Each apply disposes the previous rules first — Monaco's disposable
 * genuinely splices dynamic rules out — so re-binds never stack.
 */

import { get as getSetting, subscribeKey } from '../../settings/store';
import type { SettingKey } from '../../settings/types';
import { chordToMonacoKeybinding, type MonacoKeyCodeValues, type MonacoKeyModValues } from './chord-keybinding';

export interface EditorKeybindingRule {
  keybinding: number;
  command?: string | null;
  when?: string | null;
}

export interface EditorKeybindingDisposable {
  dispose(): void;
}

/** The slice of the mounted Monaco API this module drives —
 *  structurally satisfied by the `Monaco` instance `onMount` hands out. */
export interface MonacoKeybindingHost {
  editor: {
    addKeybindingRules(rules: EditorKeybindingRule[]): EditorKeybindingDisposable;
  };
  KeyMod: MonacoKeyModValues;
  KeyCode: MonacoKeyCodeValues;
}

interface EditorShortcutBinding {
  settingKey: SettingKey;
  commandId: string;
  /**
   * Monaco's own default chords for the command, in our chord
   * vocabulary, across every platform variant Monaco ships (`mod` = ⌘
   * on macOS / Ctrl elsewhere, so one token usually covers two
   * platforms). All are removed unconditionally — a removal that
   * matches no default rule on the running platform is a no-op.
   */
  builtinChords: readonly string[];
  /** Context-key expression gating the rule, mirroring the built-in. */
  when?: string;
}

const EDITOR_SHORTCUT_BINDINGS: readonly EditorShortcutBinding[] = [
  {
    settingKey: 'keyboard.find',
    commandId: 'actions.find',
    builtinChords: ['mod+f'],
  },
  {
    settingKey: 'keyboard.replace',
    commandId: 'editor.action.startFindReplaceAction',
    builtinChords: ['mod+alt+f', 'mod+h'],
  },
  {
    settingKey: 'keyboard.formatCode',
    commandId: 'editor.action.formatDocument',
    builtinChords: ['shift+alt+f', 'mod+shift+i'],
    when: 'editorTextFocus',
  },
];

interface BindingState {
  disposable: EditorKeybindingDisposable | null;
  unsubscribe: () => void;
}

let activeStates: BindingState[] | null = null;

function chordValue(settingKey: SettingKey): string {
  const value = getSetting(settingKey);
  return typeof value === 'string' ? value : '';
}

function applyBinding(
  host: MonacoKeybindingHost,
  binding: EditorShortcutBinding,
  chord: string,
): EditorKeybindingDisposable {
  const rules: EditorKeybindingRule[] = [];
  for (const builtin of binding.builtinChords) {
    const keybinding = chordToMonacoKeybinding(builtin, host.KeyMod, host.KeyCode);
    if (keybinding !== null) rules.push({ keybinding, command: `-${binding.commandId}` });
  }
  const keybinding = chordToMonacoKeybinding(chord, host.KeyMod, host.KeyCode);
  if (keybinding !== null) {
    rules.push({ keybinding, command: binding.commandId, when: binding.when ?? null });
  }
  return host.editor.addKeybindingRules(rules);
}

/**
 * Install the settings→Monaco keybinding sync. Idempotent — the first
 * mounted CodeEditor wins; the rules live on the page-global keybinding
 * service, so later mounts share them.
 */
export function ensureEditorKeybindingSync(host: MonacoKeybindingHost): void {
  if (activeStates) return;
  activeStates = EDITOR_SHORTCUT_BINDINGS.map((binding) => {
    const state: BindingState = {
      disposable: applyBinding(host, binding, chordValue(binding.settingKey)),
      unsubscribe: () => {},
    };
    state.unsubscribe = subscribeKey(binding.settingKey, () => {
      state.disposable?.dispose();
      state.disposable = applyBinding(host, binding, chordValue(binding.settingKey));
    });
    return state;
  });
}

/** Tear the sync down so a test can re-install it against a fresh host. */
export function __resetEditorKeybindingSyncForTests(): void {
  if (!activeStates) return;
  for (const state of activeStates) {
    state.disposable?.dispose();
    state.unsubscribe();
  }
  activeStates = null;
}
