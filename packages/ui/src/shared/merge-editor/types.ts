/**
 * Generic merge-editor data contracts.
 *
 * Lift-ready: no shell-specific imports. Adapters
 * (entity-conflict, import, future git) project their domain into
 * this shape; the editor stays domain-agnostic.
 *
 * See the merge-conflict-editor plan §4.
 */

export type MergeFileKind = 'modify' | 'add' | 'remove';

export interface MergeBadge {
  label: string;
  tone?: 'info' | 'warn' | 'error' | 'success';
}

export interface MergeFile {
  id: string;
  label: string;
  language?: 'yaml' | 'json' | 'plaintext' | string;
  /** Common ancestor. When undefined the editor renders 2-pane. */
  base?: string;
  theirs: string;
  mine: string;
  /** Required: adapters seed explicitly. */
  initialResult: string;
  kind: MergeFileKind;
  pairedWith?: string;
  group?: string;
  badges?: ReadonlyArray<MergeBadge>;
}

export type MergeApplyStatus = 'resolved' | 'partial' | 'unresolved';

export interface MergeApplyOutcome {
  fileId: string;
  ok: boolean;
  status: MergeApplyStatus;
  error?: string;
}

export interface MergeSession {
  title: string;
  files: MergeFile[];
  initialFileId?: string;
  onApply(files: MergeFile[], results: Map<string, string>): Promise<MergeApplyOutcome[]>;
  onCancel(): void;
}
