/**
 * Header Actions — diagrams, split by operation.
 *
 *   override.tsx — Add / Replace scenarios + won't-apply gotcha.
 *   append.tsx   — duplicate-row outcome + duplicate-unfriendly gotcha.
 *   remove.tsx   — deletion + already-absent gotcha.
 *   merge.tsx    — script-based concatenation + scope gotchas.
 *   overview.tsx — hero comparison (`HeaderOpsDiagram`).
 *
 * Per-action diagrams are self-contained: each tells the story of one
 * operation in detail without repeating the hero's full comparison.
 */

export { AppendDiagram, AppendWontApplyDiagram } from './append';
export { MergeDiagram, MergeWontApplyDiagram } from './merge';
export { OverrideDiagram, OverrideWontApplyDiagram } from './override';
export { HeaderOpsDiagram } from './overview';
export { RemoveDiagram, RemoveWontApplyDiagram } from './remove';
