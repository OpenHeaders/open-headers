/**
 * The log graph's linear fragments (the reference's hover and collapse
 * unit): a plain commit widens to the anchors around it, an anchor reads
 * the run below it, refs and HEAD are anchors, the window's edge ends a
 * run; a collapsed fragment hides its interior and rewires the top end's
 * parent to the bottom end; a hover on either end of a collapsed
 * fragment resolves to it; the gear's Collapse Linear Branches names
 * every fragment of the window once, two runs under one merge apart.
 */

import { edgeKey } from '@openheaders/ui/workbench/components/panels/git/graph';
import {
  allLinearFragments,
  collapseLog,
  fragmentEdges,
  fragmentKey,
  fragmentShas,
  hoverFragment,
  linearFragment,
} from '@openheaders/ui/workbench/components/panels/git/graph-fragment';
import { describe, expect, it } from 'vitest';

// merge -> [m2, f2]; m2 -> m1; f2 -> f1; f1 -> base; m1 -> base; base -> r2 -> r1
const LOG = [
  { sha: 'merge', parents: ['m2', 'f2'] },
  { sha: 'm2', parents: ['m1'] },
  { sha: 'f2', parents: ['f1'] },
  { sha: 'f1', parents: ['base'] },
  { sha: 'm1', parents: ['base'] },
  { sha: 'base', parents: ['r2'] },
  { sha: 'r2', parents: ['r1'] },
  { sha: 'r1', parents: [] },
];
const NONE: ReadonlySet<string> = new Set();

describe('linearFragment', () => {
  it('a plain commit widens to the fork and the merge around it', () => {
    expect(linearFragment(LOG, 'f1', NONE)).toEqual({ top: 'merge', bottom: 'base', interior: ['f2', 'f1'] });
    expect(linearFragment(LOG, 'm1', NONE)).toEqual({ top: 'merge', bottom: 'base', interior: ['m2', 'm1'] });
  });

  it('an anchor reads the run below it along its first parent', () => {
    expect(linearFragment(LOG, 'merge', NONE)).toEqual({ top: 'merge', bottom: 'base', interior: ['m2', 'm1'] });
  });

  it('a ref on a commit ends the run there, and a run with nothing to hide is no fragment', () => {
    expect(linearFragment(LOG, 'f1', new Set(['f2']))).toEqual({ top: 'f2', bottom: 'base', interior: ['f1'] });
    expect(linearFragment(LOG, 'f2', new Set(['f2', 'f1']))).toBeNull();
  });

  it('the window edge: the run below the fork ends on the last commit the window holds', () => {
    expect(linearFragment(LOG, 'r2', NONE)).toEqual({ top: 'base', bottom: 'r1', interior: ['r2'] });
    expect(linearFragment(LOG, 'base', NONE)).toEqual({ top: 'base', bottom: 'r1', interior: ['r2'] });
    expect(linearFragment(LOG, 'r1', NONE)).toBeNull();
  });

  it('names the shas and the edges it lights', () => {
    const fragment = { top: 'merge', bottom: 'base', interior: ['f2', 'f1'] };
    expect([...fragmentShas(fragment)]).toEqual(['merge', 'f2', 'f1', 'base']);
    expect([...fragmentEdges(fragment)]).toEqual([
      edgeKey('merge', 'f2'),
      edgeKey('f2', 'f1'),
      edgeKey('f1', 'base'),
      edgeKey('merge', 'base'),
    ]);
  });
});

describe('allLinearFragments', () => {
  it('names every fragment of the window once — both runs under the merge and the run below the fork', () => {
    const fragments = allLinearFragments(LOG, NONE);
    expect(fragments).toEqual([
      { top: 'merge', bottom: 'base', interior: ['m2', 'm1'] },
      { top: 'merge', bottom: 'base', interior: ['f2', 'f1'] },
      { top: 'base', bottom: 'r1', interior: ['r2'] },
    ]);
    expect(new Set(fragments.map(fragmentKey)).size).toBe(3);
  });

  it('a ref on every plain commit leaves nothing to collapse', () => {
    expect(allLinearFragments(LOG, new Set(['m2', 'm1', 'f2', 'f1', 'r2']))).toEqual([]);
  });
});

describe('collapseLog', () => {
  it('hides the interior and rewires the top end to the bottom end, naming the skipping edge', () => {
    const fragment = { top: 'merge', bottom: 'base', interior: ['f2', 'f1'] };
    const { entries, collapsedEdges } = collapseLog(LOG, new Map([['merge', fragment]]));
    expect(entries.map((entry) => entry.sha)).toEqual(['merge', 'm2', 'm1', 'base', 'r2', 'r1']);
    expect(entries[0].parents).toEqual(['m2', 'base']);
    expect([...collapsedEdges]).toEqual([edgeKey('merge', 'base')]);
  });

  it('two collapsed runs under one merge each rewire their own parent pointer', () => {
    const collapsed = new Map(allLinearFragments(LOG, NONE).map((fragment) => [fragmentKey(fragment), fragment]));
    const { entries, collapsedEdges } = collapseLog(LOG, collapsed);
    expect(entries.map((entry) => entry.sha)).toEqual(['merge', 'base', 'r1']);
    expect(entries[0].parents).toEqual(['base', 'base']);
    expect(entries[1].parents).toEqual(['r1']);
    expect([...collapsedEdges]).toEqual([edgeKey('merge', 'base'), edgeKey('base', 'r1')]);
  });

  it('ignores a fragment whose ends left the window and leaves the log alone with none', () => {
    const stale = { top: 'gone', bottom: 'base', interior: ['f2'] };
    expect(collapseLog(LOG, new Map([['gone', stale]])).entries).toHaveLength(LOG.length);
    expect(collapseLog(LOG, new Map()).entries).toEqual(LOG);
  });
});

describe('hoverFragment', () => {
  it('either end of a collapsed fragment resolves to it; elsewhere the linear run', () => {
    const fragment = { top: 'merge', bottom: 'base', interior: ['f2', 'f1'] };
    const collapsed = new Map([['merge', fragment]]);
    const { entries } = collapseLog(LOG, collapsed);
    expect(hoverFragment(entries, 'base', NONE, collapsed)).toBe(fragment);
    expect(hoverFragment(entries, 'merge', NONE, collapsed)).toBe(fragment);
    expect(hoverFragment(entries, 'm1', NONE, collapsed)).toEqual({
      top: 'merge',
      bottom: 'base',
      interior: ['m2', 'm1'],
    });
  });
});
