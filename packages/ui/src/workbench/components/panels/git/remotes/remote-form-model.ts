/**
 * remote-form-model — the Define Remote form's pure rules: what the
 * draft is missing before it can be sent (the host re-checks the same
 * shapes), and which of a remote's fields an edit actually changes
 * (so an untouched field never rides the verb). Pure over strings.
 */

/** The form's two fields, as typed. */
export interface RemoteDraft {
  name: string;
  url: string;
}

/** A configured remote as the dialog lists it. */
export interface RemoteRow {
  name: string;
  url: string;
}

export type RemoteDraftIssue = 'name-empty' | 'name-invalid' | 'url-empty' | 'url-invalid';

/** The host's remote-name gate, mirrored for the inline nudge. */
export function isValidRemoteName(name: string): boolean {
  if (name.length === 0 || name.length > 255) return false;
  if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name)) return false;
  return !(name.includes('..') || name.endsWith('.lock') || name.endsWith('.'));
}

/** The first thing wrong with the draft, or null when it can be sent. */
export function remoteDraftIssue(draft: RemoteDraft): RemoteDraftIssue | null {
  const name = draft.name.trim();
  const url = draft.url.trim();
  if (name.length === 0) return 'name-empty';
  if (!isValidRemoteName(name)) return 'name-invalid';
  if (url.length === 0) return 'url-empty';
  if (url.startsWith('-')) return 'url-invalid';
  return null;
}

/** The Edit verb's patch — only the fields that differ from the row; null when nothing changed. */
export function remoteUpdatePatch(row: RemoteRow, draft: RemoteDraft): { newName?: string; url?: string } | null {
  const name = draft.name.trim();
  const url = draft.url.trim();
  const patch: { newName?: string; url?: string } = {};
  if (name !== row.name) patch.newName = name;
  if (url !== row.url) patch.url = url;
  return patch.newName === undefined && patch.url === undefined ? null : patch;
}
