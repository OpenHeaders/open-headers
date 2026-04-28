/**
 * Field paths are dotted strings: `headerMods.0.value`,
 * `conditions.2.fields.url`. Numeric segments index into arrays;
 * non-numeric segments key into objects. The interpretation happens
 * at traversal time against the actual parent type — the segment
 * shape itself is just a string.
 *
 * Schema-typed `FieldPath<E>` is generated from valibot at build
 * time (§7.3); this module is the runtime codec.
 */

export type PathSegment = string;

export function parsePath(path: string): PathSegment[] {
  if (path.length === 0) return [];
  return path.split('.');
}

export function joinPath(segments: readonly PathSegment[]): string {
  return segments.join('.');
}
