/**
 * Numeric interpreters for {@link ComboKnob} — each turns free text
 * into concrete bounded candidates, and formats committed values back
 * into the same labels. Unit symbols (ms · s · min · KB · MB) and the
 * min/max bound suffixes are locale-neutral by design, so no catalog
 * legs ride these labels; number GROUPING follows the runtime locale
 * via Intl (display only — parsing keeps plain numbers).
 *
 * Out-of-bounds readings are NOT silently pruned: they survive as
 * disabled candidates whose label names the violated bound
 * ("32 s — max 30 s"), so the dropdown explains while the user types
 * instead of a reading just vanishing.
 */
import type { ComboKnobOption } from './ComboKnob';

export interface NumericBounds {
  min: number;
  max: number;
}

/** Locale-aware grouping for label numbers ("29304" → "29,304" /
 *  "29.304" per the runtime locale) — display only; the model and the
 *  input parsing keep plain numbers. */
const groupedNumber = new Intl.NumberFormat();

/** Unique finite readings → candidates; in-bounds enabled, out-of-
 *  bounds disabled with the violated bound in the label. */
const boundedOptions = (
  values: number[],
  bounds: NumericBounds,
  format: (value: number) => string,
): ComboKnobOption<number>[] =>
  [...new Set(values.filter((v) => Number.isFinite(v)))].map((value) =>
    value < bounds.min
      ? { value, label: `${format(value)} — min ${format(bounds.min)}`, disabled: true }
      : value > bounds.max
        ? { value, label: `${format(value)} — max ${format(bounds.max)}`, disabled: true }
        : { value, label: format(value) },
  );

// ── Durations (milliseconds) ─────────────────────────────────────────

export const formatDurationMs = (ms: number): string => {
  if (ms === 0) return '0 ms';
  if (ms % 3_600_000 === 0) return `${groupedNumber.format(ms / 3_600_000)} h`;
  if (ms % 60_000 === 0) return `${groupedNumber.format(ms / 60_000)} min`;
  if (ms % 1_000 === 0) return `${groupedNumber.format(ms / 1_000)} s`;
  return `${groupedNumber.format(ms)} ms`;
};

const DURATION_PATTERN =
  /^(\d+(?:[.,]\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/i;

/** "10" → 10 ms / 10 s / 10 min readings (out-of-bounds ones stay as
 *  disabled explanations); an explicit unit yields the one reading. */
export const durationMsInterpreter =
  (bounds: NumericBounds) =>
  (input: string): ComboKnobOption<number>[] => {
    const match = DURATION_PATTERN.exec(input.trim());
    if (!match) return [];
    const n = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(n)) return [];
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
    return boundedOptions(readings.map(Math.round), bounds, formatDurationMs);
  };

// ── Byte sizes ───────────────────────────────────────────────────────

const KB = 1024;
const MB = 1024 * 1024;

export const formatByteSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes % MB === 0) return `${groupedNumber.format(bytes / MB)} MB`;
  if (bytes % KB === 0) return `${groupedNumber.format(bytes / KB)} KB`;
  return `${groupedNumber.format(bytes)} B`;
};

const BYTE_SIZE_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(b|kb|k|mb|m)?$/i;

/** "512" → 512 KB / 512 MB readings (out-of-bounds ones stay as
 *  disabled explanations); an explicit unit yields the one reading.
 *  Bare numbers read as KB first — the scale response caps are quoted
 *  in. */
export const byteSizeInterpreter =
  (bounds: NumericBounds) =>
  (input: string): ComboKnobOption<number>[] => {
    const match = BYTE_SIZE_PATTERN.exec(input.trim());
    if (!match) return [];
    const n = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(n)) return [];
    const unit = match[2]?.toLowerCase();
    const readings =
      unit === undefined ? [n * KB, n * MB] : unit === 'b' ? [n] : unit.startsWith('k') ? [n * KB] : [n * MB];
    return boundedOptions(readings.map(Math.round), bounds, formatByteSize);
  };

// ── Plain counts ─────────────────────────────────────────────────────

const COUNT_PATTERN = /^\d+$/;

/** Optional `format` lets a caller label counts with a localized unit
 *  ("5 hops") without losing the disabled bound explanations. */
export const countInterpreter =
  (bounds: NumericBounds, format: (value: number) => string = String) =>
  (input: string): ComboKnobOption<number>[] => {
    const trimmed = input.trim();
    if (!COUNT_PATTERN.test(trimmed)) return [];
    return boundedOptions([Number(trimmed)], bounds, format);
  };

/** Preset list from raw values via the matching formatter. */
export const numericPresets = (values: number[], format: (value: number) => string): ComboKnobOption<number>[] =>
  values.map((value) => ({ value, label: format(value) }));
