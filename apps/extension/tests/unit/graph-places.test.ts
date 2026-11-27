/**
 * Pure-function tests for the places of a workflow graph's nodes once
 * they are moved by hand: the snap, where each node of an arranged graph
 * stands, what a drop keeps, and the box the nodes fill.
 */

import {
  boundsOfNodes,
  freezePlaces,
  type PlacedStep,
  placedPositions,
  snapPlace,
} from '@openheaders/ui/workbench/components/live/graph-places';
import { describe, expect, it } from 'vitest';

const NODE = { width: 208, height: 82 };
const METRICS = { node: NODE, gapX: 24, gapY: 72 };

const step = (id: string, parents: string[] = []): PlacedStep => ({ id, uid: `uid-${id}`, parents });

describe('snapPlace', () => {
  it('puts a corner on the nearest point of the 8-unit grid', () => {
    expect(snapPlace({ x: 123, y: 77 })).toEqual({ x: 120, y: 80 });
    expect(snapPlace({ x: 124, y: 76 })).toEqual({ x: 128, y: 80 });
    expect(snapPlace({ x: -13, y: -3 })).toEqual({ x: -16, y: 0 });
  });
});

describe('placedPositions', () => {
  it('a step with a place stands there, whatever the computed layout says', () => {
    const positions = placedPositions(
      [step('a'), step('b', ['a'])],
      new Map([
        ['a', { x: 24, y: 24 }],
        ['b', { x: 24, y: 178 }],
      ]),
      { 'uid-a': { x: 400, y: -40 }, 'uid-b': { x: 0, y: 320 } },
      METRICS,
    );

    expect(positions.get('a')).toEqual({ x: 400, y: -40 });
    expect(positions.get('b')).toEqual({ x: 0, y: 320 });
  });

  it('a step with no place lands under its parent, a layer’s gap down', () => {
    const positions = placedPositions(
      [step('a'), step('b', ['a'])],
      new Map([
        ['a', { x: 24, y: 24 }],
        ['b', { x: 24, y: 178 }],
      ]),
      { 'uid-a': { x: 400, y: 80 } },
      METRICS,
    );

    expect(positions.get('b')).toEqual({ x: 400, y: 234 });
  });

  it('a second step under the same parent lands beside the first, clear of it', () => {
    const positions = placedPositions(
      [step('a'), step('b', ['a']), step('c', ['a'])],
      new Map(),
      { 'uid-a': { x: 400, y: 80 }, 'uid-b': { x: 400, y: 234 } },
      METRICS,
    );

    expect(positions.get('c')).toEqual({ x: 632, y: 234 });
  });

  it('two steps with no place under one parent land side by side, in their order', () => {
    const positions = placedPositions(
      [step('a'), step('b', ['a']), step('c', ['a'])],
      new Map(),
      { 'uid-a': { x: 0, y: 0 } },
      METRICS,
    );

    expect(positions.get('b')).toEqual({ x: 0, y: 154 });
    expect(positions.get('c')).toEqual({ x: 232, y: 154 });
  });

  it('a step lands under the first of its parents that stands somewhere', () => {
    const positions = placedPositions(
      [step('a'), step('b'), step('c', ['ghost', 'b'])],
      new Map(),
      { 'uid-a': { x: 0, y: 0 }, 'uid-b': { x: 800, y: 0 } },
      METRICS,
    );

    expect(positions.get('c')).toEqual({ x: 800, y: 154 });
  });

  it('a step that waits on no other lands where the computed layout puts it, moved right off a node there', () => {
    const computed = new Map([
      ['a', { x: 24, y: 24 }],
      ['b', { x: 256, y: 24 }],
    ]);

    expect(placedPositions([step('a'), step('b')], computed, { 'uid-a': { x: 24, y: 24 } }, METRICS).get('b')).toEqual({
      x: 256,
      y: 24,
    });
    expect(placedPositions([step('a'), step('b')], computed, { 'uid-a': { x: 200, y: 40 } }, METRICS).get('b')).toEqual(
      {
        x: 488,
        y: 24,
      },
    );
  });

  it('a place kept for a step the workflow no longer holds is no node', () => {
    const positions = placedPositions(
      [step('a')],
      new Map(),
      { 'uid-a': { x: 8, y: 8 }, 'uid-gone': { x: 0, y: 0 } },
      METRICS,
    );

    expect([...positions.keys()]).toEqual(['a']);
  });
});

describe('freezePlaces', () => {
  it('keeps every node where it stands, by step uid, and nothing else', () => {
    const places = freezePlaces(
      [step('a'), step('b', ['a'])],
      new Map([
        ['a', { x: 24, y: 24 }],
        ['b', { x: 320, y: 176 }],
        ['gone', { x: 0, y: 0 }],
      ]),
    );

    expect(places).toEqual({ 'uid-a': { x: 24, y: 24 }, 'uid-b': { x: 320, y: 176 } });
  });
});

describe('boundsOfNodes', () => {
  it('is the box the nodes fill with the pad around it, off the origin where they are', () => {
    expect(
      boundsOfNodes(
        [
          { x: -100, y: 40 },
          { x: 300, y: -60 },
        ],
        NODE,
        24,
      ),
    ).toEqual({ x: -124, y: -84, width: 656, height: 230 });
  });

  it('of no node is one node’s box at the origin', () => {
    expect(boundsOfNodes([], NODE, 24)).toEqual({ x: 0, y: 0, width: 256, height: 130 });
  });
});
