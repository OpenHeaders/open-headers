/**
 * Hand-crafted merge-conflict scenarios for the showcase page.
 *
 * Each scenario produces a single-file `MergeSession` with a synthetic
 * 3-pane (theirs / mine / base) input modeling one specific shape of
 * conflict — pure-add, leaf-modify, set-reorder, etc. — across header
 * rule rows. The scenarios are organized so a developer or designer
 * can flip through every case the merge editor must handle without
 * fabricating real data.
 *
 * Header rule shape (Rule.action.requestHeaders set-by-uid):
 *   - uid: r-aaaaaa
 *     operation: override
 *     headerName: x-token
 *     value: "..."
 *
 * `theirs` = remote / saved version (incoming).
 * `mine`   = local user draft (current).
 * `base`   = common ancestor (when defined → 3-pane). Some scenarios
 *            omit base to exercise the 2-pane fallback as well.
 */

import type { MergeFile, MergeSession } from '@openheaders/ui/shared/merge-editor';

export interface ShowcaseScenario {
  /** URL slug — also used as the React key. */
  id: string;
  /** Sidebar group header. */
  category: string;
  /** Sidebar label. */
  title: string;
  /** Short prose explanation of what the scenario is testing. */
  description: string;
  /** The merge-editor session this scenario produces. */
  buildSession(onApplied: () => void): MergeSession;
}

// ── Helpers ─────────────────────────────────────────────────────────

interface HeaderRow {
  uid: string;
  name: string;
  value: string;
  operation?: 'override' | 'add' | 'remove' | 'merge';
}

function header(uid: string, name: string, value: string, operation: HeaderRow['operation'] = 'override'): HeaderRow {
  return { uid, name, value, operation };
}

function renderHeader(h: HeaderRow): string {
  return [
    `  - uid: ${h.uid}`,
    `    operation: ${h.operation}`,
    `    headerName: ${h.name}`,
    `    value: "${h.value}"`,
  ].join('\n');
}

function renderRule(headers: readonly HeaderRow[], ruleName = 'Demo header rule'): string {
  return [
    'schemaVersion: 5',
    'uid: ru000001',
    `name: "${ruleName}"`,
    'type: header',
    'enabled: true',
    'conditions:',
    '  - uid: cnd00001',
    '    type: url-filter',
    "    values: ['||openheaders.com^']",
    'action:',
    '  requestHeaders:',
    headers.map(renderHeader).join('\n'),
    '  responseHeaders: []',
    '',
  ].join('\n');
}

function makeFile(args: {
  base?: readonly HeaderRow[];
  theirs: readonly HeaderRow[];
  mine: readonly HeaderRow[];
  ruleName?: string;
}): MergeFile {
  const baseText = args.base !== undefined ? renderRule(args.base, args.ruleName) : undefined;
  return {
    id: 'showcase-rule',
    label: 'rules/demo-ru000001.yaml',
    language: 'yaml',
    kind: 'modify',
    base: baseText,
    theirs: renderRule(args.theirs, args.ruleName),
    mine: renderRule(args.mine, args.ruleName),
    initialResult: renderRule(args.mine, args.ruleName),
  };
}

function buildSession(file: MergeFile, title: string, onApplied: () => void): MergeSession {
  return {
    title,
    files: [file],
    onApply: async () => {
      onApplied();
      return [{ fileId: file.id, ok: true, status: 'resolved' }];
    },
    onCancel: () => onApplied(),
  };
}

// Canonical row alphabet — A through E. Reused across scenarios so
// the same rows show up in different positions / states, making
// cross-scenario comparison straightforward.
const A = (val = 'A') => header('hr0000aa', 'X-A', val);
const B = (val = 'B') => header('hr0000bb', 'X-B', val);
const C = (val = 'C') => header('hr0000cc', 'X-C', val);
const D = (val = 'D') => header('hr0000dd', 'X-D', val);
const E = (val = 'E') => header('hr0000ee', 'X-E', val);

// ── Scenarios ───────────────────────────────────────────────────────

export const SCENARIOS: ShowcaseScenario[] = [
  // ── Add ────────────────────────────────────────────────────────
  {
    id: 'add-theirs-only',
    category: 'Add',
    title: 'Theirs adds a row',
    description: 'Peer added X-C; user untouched. Auto-mergeable — clean from theirs.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B()],
          theirs: [A(), B(), C()],
          mine: [A(), B()],
        }),
        'Add — theirs only',
        cb,
      ),
  },
  {
    id: 'add-mine-only',
    category: 'Add',
    title: 'Mine adds a row',
    description: 'User added X-C; peer untouched. Auto-mergeable — clean from mine.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B()],
          theirs: [A(), B()],
          mine: [A(), B(), C()],
        }),
        'Add — mine only',
        cb,
      ),
  },
  {
    id: 'add-both-same-uid-same-content',
    category: 'Add',
    title: 'Both add the same row (same uid, same content)',
    description: 'Convergent add — both sides independently produced the same X-C row. No conflict.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B()],
          theirs: [A(), B(), C()],
          mine: [A(), B(), C()],
        }),
        'Add — convergent',
        cb,
      ),
  },
  {
    id: 'add-both-same-uid-different-content',
    category: 'Add',
    title: 'Both add same uid, different content',
    description: 'Same row identity, divergent value — leaf conflict on the new row.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B()],
          theirs: [A(), B(), C('THEIRS')],
          mine: [A(), B(), C('MINE')],
        }),
        'Add — uid match, value divergent',
        cb,
      ),
  },
  {
    id: 'add-both-different-uids',
    category: 'Add',
    title: 'Both add different new rows',
    description: 'Peer added X-D, user added X-E. Both new — independent set-adds.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B()],
          theirs: [A(), B(), D()],
          mine: [A(), B(), E()],
        }),
        'Add — both, different uids',
        cb,
      ),
  },

  // ── Delete ────────────────────────────────────────────────────
  {
    id: 'delete-theirs-only',
    category: 'Delete',
    title: 'Theirs deletes a row',
    description: 'Peer removed X-B; user untouched. Auto-mergeable.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [A(), C()],
          mine: [A(), B(), C()],
        }),
        'Delete — theirs only',
        cb,
      ),
  },
  {
    id: 'delete-mine-only',
    category: 'Delete',
    title: 'Mine deletes a row',
    description: 'User removed X-B; peer untouched. Auto-mergeable.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [A(), B(), C()],
          mine: [A(), C()],
        }),
        'Delete — mine only',
        cb,
      ),
  },
  {
    id: 'delete-both-same',
    category: 'Delete',
    title: 'Both delete the same row',
    description: 'Convergent delete — both sides removed X-B. No conflict.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [A(), C()],
          mine: [A(), C()],
        }),
        'Delete — convergent',
        cb,
      ),
  },
  {
    id: 'delete-vs-modify',
    category: 'Delete',
    title: 'Theirs deletes, mine modifies',
    description: "Peer dropped X-B; user changed its value. True conflict — can't auto-merge.",
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B('B'), C()],
          theirs: [A(), C()],
          mine: [A(), B('B-CHANGED'), C()],
        }),
        'Delete vs modify',
        cb,
      ),
  },

  // ── Modify ────────────────────────────────────────────────────
  {
    id: 'modify-theirs-only',
    category: 'Modify',
    title: 'Theirs modifies a value',
    description: 'Peer changed X-A value to "A-NEW". User untouched.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B(), C()],
          theirs: [A('A-NEW'), B(), C()],
          mine: [A('A'), B(), C()],
        }),
        'Modify — theirs only',
        cb,
      ),
  },
  {
    id: 'modify-mine-only',
    category: 'Modify',
    title: 'Mine modifies a value',
    description: 'User changed X-A value to "A-NEW". Peer untouched.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B(), C()],
          theirs: [A('A'), B(), C()],
          mine: [A('A-NEW'), B(), C()],
        }),
        'Modify — mine only',
        cb,
      ),
  },
  {
    id: 'modify-both-same-value',
    category: 'Modify',
    title: 'Both modify to the same value',
    description: 'Convergent modify — both sides changed X-A to "A-NEW". No conflict.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B(), C()],
          theirs: [A('A-NEW'), B(), C()],
          mine: [A('A-NEW'), B(), C()],
        }),
        'Modify — convergent',
        cb,
      ),
  },
  {
    id: 'modify-both-different-value',
    category: 'Modify',
    title: 'Both modify to different values',
    description: 'True leaf conflict — peer set X-A to "THEIRS", user to "MINE".',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B(), C()],
          theirs: [A('THEIRS'), B(), C()],
          mine: [A('MINE'), B(), C()],
        }),
        'Modify — both diverge',
        cb,
      ),
  },
  {
    id: 'modify-different-fields-same-row',
    category: 'Modify',
    title: 'Both modify different fields of the same row',
    description: "Peer changed X-A's name; user changed its value. Both edits land cleanly.",
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B(), C()],
          theirs: [{ ...A('A'), name: 'X-A-Renamed' }, B(), C()],
          mine: [A('A-NEW-VALUE'), B(), C()],
        }),
        'Modify — different fields',
        cb,
      ),
  },

  // ── Reorder ────────────────────────────────────────────────────
  {
    id: 'reorder-theirs-only',
    category: 'Reorder',
    title: 'Theirs reorders rows',
    description: 'Peer reorders [A,B,C] → [B,A,C]. User untouched. Auto-mergeable reorder.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [B(), A(), C()],
          mine: [A(), B(), C()],
        }),
        'Reorder — theirs only',
        cb,
      ),
  },
  {
    id: 'reorder-mine-only',
    category: 'Reorder',
    title: 'Mine reorders rows',
    description: 'User reorders [A,B,C] → [C,A,B]. Peer untouched.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [A(), B(), C()],
          mine: [C(), A(), B()],
        }),
        'Reorder — mine only',
        cb,
      ),
  },
  {
    id: 'reorder-convergent',
    category: 'Reorder',
    title: 'Both reorder the same way',
    description: 'Convergent reorder — both sides reach [B,A,C]. No conflict.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [B(), A(), C()],
          mine: [B(), A(), C()],
        }),
        'Reorder — convergent',
        cb,
      ),
  },
  {
    id: 'reorder-divergent',
    category: 'Reorder',
    title: 'Both reorder differently',
    description: 'Peer → [B,A,C]; user → [C,B,A]. Order conflict — both diverge from base order.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [B(), A(), C()],
          mine: [C(), B(), A()],
        }),
        'Reorder — divergent',
        cb,
      ),
  },

  // ── Mixed (multi-axis) ────────────────────────────────────────
  {
    id: 'mixed-reorder-and-modify',
    category: 'Mixed',
    title: 'Reorder + modify',
    description: 'Peer reorders, user modifies a value. Order vs leaf — exercises the rebase logic.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B('B'), C('C')],
          theirs: [B('B'), A('A'), C('C')],
          mine: [A('A'), B('B-CHANGED'), C('C')],
        }),
        'Reorder + modify',
        cb,
      ),
  },
  {
    id: 'mixed-reorder-and-add',
    category: 'Mixed',
    title: 'Reorder + add',
    description: 'Peer reorders existing rows; user appends a new one.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [C(), A(), B()],
          mine: [A(), B(), C(), D()],
        }),
        'Reorder + add',
        cb,
      ),
  },
  {
    id: 'mixed-reorder-and-delete',
    category: 'Mixed',
    title: 'Reorder + delete',
    description: 'Peer reorders, user deletes a row that peer moved. Order changes around the gap.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C(), D()],
          theirs: [D(), A(), B(), C()],
          mine: [A(), C(), D()],
        }),
        'Reorder + delete',
        cb,
      ),
  },
  {
    id: 'mixed-add-and-delete',
    category: 'Mixed',
    title: 'Add + delete',
    description: 'Peer adds X-E, user deletes X-B. Disjoint changes — clean composition.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C(), D()],
          theirs: [A(), B(), C(), D(), E()],
          mine: [A(), C(), D()],
        }),
        'Add + delete',
        cb,
      ),
  },
  {
    id: 'mixed-everything',
    category: 'Mixed',
    title: 'Everything (add + delete + modify + reorder)',
    description: 'Maximum chaos — every operation type happening at once. Stress-test the merge view.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A('A'), B('B'), C('C'), D('D')],
          theirs: [E('E-NEW'), B('B-THEIRS'), A('A'), D('D')],
          mine: [A('A-MINE'), C('C'), D('D-MINE'), B('B'), E()],
        }),
        'Everything — add + delete + modify + reorder',
        cb,
      ),
  },

  // ── Layout edge cases ─────────────────────────────────────────
  {
    id: 'edge-no-base-2pane',
    category: 'Edge cases',
    title: '2-pane fallback (no base)',
    description: 'Same scenario as "Modify both diverge" but base is undefined → 2-pane render.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          theirs: [A('THEIRS'), B(), C()],
          mine: [A('MINE'), B(), C()],
        }),
        '2-pane fallback',
        cb,
      ),
  },
  {
    id: 'edge-empty-headers',
    category: 'Edge cases',
    title: 'Empty headers on one side',
    description: 'Peer cleared all headers; user kept them. Whole-array deletion.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [],
          mine: [A(), B(), C()],
        }),
        'Empty theirs',
        cb,
      ),
  },
  {
    id: 'edge-fully-resolved',
    category: 'Edge cases',
    title: 'Identical (no conflicts)',
    description: 'All three sides identical — no hunks. Tests the "nothing to do" empty state.',
    buildSession: (cb) =>
      buildSession(
        makeFile({
          base: [A(), B(), C()],
          theirs: [A(), B(), C()],
          mine: [A(), B(), C()],
        }),
        'Identical — no conflicts',
        cb,
      ),
  },
];
