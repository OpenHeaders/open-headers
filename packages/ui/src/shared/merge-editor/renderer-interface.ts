/**
 * Renderer Interface — the seam between the resolution-state-machine
 * layer and whatever Monaco strategy renders the panes.
 *
 * Per the merge-conflict state-machine design §5. The state machine
 * observes events the renderer emits and commands operations against
 * a single editable result buffer. Phase 1 wires only the buffer +
 * apply-flush surface; pick events (§5.1 onTablePick / onHunkAccept)
 * arrive in Phase 2.
 */

export interface Range {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export type DecorationKind = 'picked' | 'dismissed' | 'unresolved-region';

export type HunkSide = 'theirs' | 'mine';

export type TablePickChoice = 'theirs' | 'mine' | 'dismiss';

export type FindPathRegion = 'annotate' | 'structural';

export interface MergePaneEvents {
  onBufferChange(range: Range, text: string): void;
  onHunkAccept(side: HunkSide, hunkId: string, range: Range, text: string): void;
  onTablePick(conflictKey: string, choice: TablePickChoice): void;
  onParseStateChange(parseable: boolean, errors?: ReadonlyArray<ParseError>): void;
  onUndo(): void;
  onRedo(): void;
  /**
   * Apply requested by the parent shell. Renderer flushes any pending
   * debounced re-parse / re-resolve so the buffer read which feeds the
   * Apply payload reflects the user's most-recent edits.
   */
  onApplyRequested(): Promise<void>;
}

export interface MergePaneOps {
  replaceTextRange(range: Range, text: string): void;
  getTextAtRange(range: Range): string;
  getResultText(): string;
  findPathRange(path: string, region: FindPathRegion): Range | null;
  setDecoration(conflictKey: string, range: Range | null, kind: DecorationKind): void;
}
