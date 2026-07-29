/**
 * Numeric interpreters for {@link ComboKnob} — each turns free text
 * into concrete bounded candidates, and formats committed values back
 * into the same labels. Unit symbols (ms · s · min · KB · MB) are
 * locale-neutral by design, so no catalog legs ride these labels.
 */
import type { ComboKnobOption } from './ComboKnob';

export interface NumericBounds {
  min: number;
  max: number;
}

const dedupeInBounds = (values: number[], bounds: NumericBounds): number[] => [
  ...new Set(values.filter((v) => Number.isFinite(v) && v >= bounds.min && v <= bounds.max)),
];

// ── Durations (milliseconds) ─────────────────────────────────────────

export const formatDurationMs = (ms: number): string => {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms % 60_000 === 0) return `${ms / 60_000} min`;
  if (ms % 1_000 === 0) return `${ms / 1_000} s`;
  return `${ms} ms`;
};

const DURATION_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/i;

/** "10" → 10 ms / 10 s / 10 min readings (bounds prune the absurd
 *  ones); an explicit unit yields the one reading. */
export const durationMsInterpreter =
  (bounds: NumericBounds) =>
  (input: string): ComboKnobOption<number>[] => {
    const match = DURATION_PATTERN.exec(input.trim());
    if (!match) return [];
    const n = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return [];
    const unit = match[2]?.toLowerCase();
    const readings =
      unit === undefined
        ? [n, n * 1_000, n * 60_000]
        : unit === 'ms'
          ? [n]
          : unit.startsWith('h')
            ? [n * 3_600_000]
            : unit === 'm' || unit.startsWith('min')
              ? [n * 60_000]
              : [n * 1_000];
    return dedupeInBounds(readings.map(Math.round), bounds).map((value) => ({
      value,
      label: formatDurationMs(value),
    }));
  };

// ── Byte sizes ───────────────────────────────────────────────────────

const KB = 1024;
const MB = 1024 * 1024;

export const formatByteSize = (bytes: number): string => {
  if (bytes % MB === 0) return `${bytes / MB} MB`;
  if (bytes % KB === 0) return `${bytes / KB} KB`;
  return `${bytes} B`;
};

const BYTE_SIZE_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(b|kb|k|mb|m)?$/i;

/** "512" → 512 KB / 512 MB readings (bounds prune); an explicit unit
 *  yields the one reading. Bare numbers read as KB first — the scale
 *  response caps are quoted in. */
export const byteSizeInterpreter =
  (bounds: NumericBounds) =>
  (input: string): ComboKnobOption<number>[] => {
    const match = BYTE_SIZE_PATTERN.exec(input.trim());
    if (!match) return [];
    const n = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return [];
    const unit = match[2]?.toLowerCase();
    const readings =
      unit === undefined ? [n * KB, n * MB] : unit === 'b' ? [n] : unit.startsWith('k') ? [n * KB] : [n * MB];
    return dedupeInBounds(readings.map(Math.round), bounds).map((value) => ({
      value,
      label: formatByteSize(value),
    }));
  };

// ── Plain counts ─────────────────────────────────────────────────────

const COUNT_PATTERN = /^\d+$/;

export const countInterpreter =
  (bounds: NumericBounds) =>
  (input: string): ComboKnobOption<number>[] => {
    const trimmed = input.trim();
    if (!COUNT_PATTERN.test(trimmed)) return [];
    return dedupeInBounds([Number(trimmed)], bounds).map((value) => ({ value, label: String(value) }));
  };

/** Preset list from raw values via the matching formatter. */
export const numericPresets = (values: number[], format: (value: number) => string): ComboKnobOption<number>[] =>
  values.map((value) => ({ value, label: format(value) }));
