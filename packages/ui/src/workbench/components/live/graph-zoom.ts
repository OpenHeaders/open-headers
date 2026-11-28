/**
 * The zoom of the workflow graph's pane (the workflow runs plan,
 * Decisions log, S34): how far one wheel event zooms, how large the
 * graph is drawn when it is fitted to its pane, and where zooming stops.
 * Pure.
 */

import type { Size } from './graph-minimap';

/** What a unit of a wheel's travel zooms by: a notch of 100 is about a sixth. */
const WHEEL_RATE = 0.0015;
/**
 * A trackpad's pinch arrives as a wheel event with the control key set
 * and a few units of travel an event — ten times the wheel's rate.
 */
const PINCH_RATE = WHEEL_RATE * 10;
/** No one event zooms by more than two notches of a wheel: the control key held over a real wheel is a pinch here. */
const MAX_EVENT_ZOOM = WHEEL_RATE * 200;

const MAX_SCALE = 2;

/** What one wheel event multiplies the scale by. */
export function wheelZoomFactor(event: { deltaY: number; ctrlKey: boolean }): number {
  const zoom = -event.deltaY * (event.ctrlKey ? PINCH_RATE : WHEEL_RATE);
  return Math.exp(Math.max(-MAX_EVENT_ZOOM, Math.min(MAX_EVENT_ZOOM, zoom)));
}

/** The scale a box is drawn at to sit whole in a pane, `pad` kept clear, never larger than `most`. */
export function fittedScale(box: Size, pane: Size, pad: number, most: number): number {
  return Math.min((pane.width - pad) / box.width, (pane.height - pad) / box.height, most);
}

/** Zooming out stops where the graph is half its fitted size. */
export function zoomOutStopOf(fitted: number): number {
  return fitted / 2;
}

/**
 * A scale zoomed by a factor, held between its stops. A view already
 * past a stop — its pane grew, a step left the graph — stays where it
 * is rather than jump back to it.
 */
export function zoomedScale(current: number, factor: number, zoomOutStop: number): number {
  const next = current * factor;
  return factor < 1 ? Math.max(next, Math.min(zoomOutStop, current)) : Math.min(next, Math.max(MAX_SCALE, current));
}
