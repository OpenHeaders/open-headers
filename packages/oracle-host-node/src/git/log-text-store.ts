/**
 * The texts of a history's commits — each one's subject and its
 * author's name — held packed: the subjects as one run of UTF-8 bytes
 * with a start per text, an author as a number, a name once. No string
 * is held per commit, so a million commits are a hundred-odd megabytes
 * and not a thousand.
 *
 * A text is a NUMBER in the order it was added; which commit it is of
 * is its caller's to know (`workspace-tree/history/texts.ts` keeps a
 * text per row of a reading). Texts are only ever added.
 *
 * The bytes live in shared memory, so a worker reads them where they
 * stand (`view`): what was added before a view was taken never moves
 * under it — a store that outgrows its memory copies itself to a larger
 * one and the view keeps the one it has.
 */

/** Bytes of subjects a new store has room for. */
const SUBJECT_BYTES = 1 << 20;
/** Texts a new store has room for. */
const TEXTS = 1 << 14;
/** The most bytes one UTF-16 code unit becomes in UTF-8. */
const BYTES_A_UNIT = 3;

/** The store as it stands at one moment — shared memory and nothing copied. */
export interface LogTextView {
  /** Texts the view holds. */
  count: number;
  /** The subjects' bytes: text `i` is `subjects[starts[i] .. starts[i + 1])`. */
  subjects: SharedArrayBuffer;
  /** `count + 1` starts, 32 bits each. */
  starts: SharedArrayBuffer;
  /** An author's number per text, 32 bits each. */
  authorIds: SharedArrayBuffer;
  /** The authors' names, by number. */
  authors: string[];
}

export interface LogTextStore {
  /** Texts held. */
  readonly count: number;
  /** Adds a commit's text and answers its number. */
  add(authorName: string, subject: string): number;
  subjectOf(text: number): string;
  authorIdOf(text: number): number;
  /** The authors' names, by number — each name once. */
  readonly authors: readonly string[];
  view(): LogTextView;
}

function grown(from: SharedArrayBuffer, bytes: number): SharedArrayBuffer {
  let size = from.byteLength;
  while (size < bytes) size *= 2;
  const next = new SharedArrayBuffer(size);
  new Uint8Array(next).set(new Uint8Array(from));
  return next;
}

export function createLogTextStore(): LogTextStore {
  let subjectMemory = new SharedArrayBuffer(SUBJECT_BYTES);
  let subjects = Buffer.from(subjectMemory);
  let startMemory = new SharedArrayBuffer((TEXTS + 1) * 4);
  let starts = new Uint32Array(startMemory);
  let authorMemory = new SharedArrayBuffer(TEXTS * 4);
  let authorIds = new Uint32Array(authorMemory);
  const authors: string[] = [];
  const authorIdByName = new Map<string, number>();
  let count = 0;
  let end = 0;

  const authorIdFor = (name: string): number => {
    let id = authorIdByName.get(name);
    if (id === undefined) {
      id = authors.length;
      authors.push(name);
      authorIdByName.set(name, id);
    }
    return id;
  };

  return {
    get count() {
      return count;
    },
    authors,
    add(authorName, subject) {
      if (count === authorIds.length) {
        startMemory = grown(startMemory, (count * 2 + 1) * 4);
        starts = new Uint32Array(startMemory);
        authorMemory = grown(authorMemory, count * 2 * 4);
        authorIds = new Uint32Array(authorMemory);
      }
      const most = end + subject.length * BYTES_A_UNIT;
      if (most > subjects.length) {
        subjectMemory = grown(subjectMemory, most);
        subjects = Buffer.from(subjectMemory);
      }
      end += subjects.write(subject, end, 'utf8');
      authorIds[count] = authorIdFor(authorName);
      count += 1;
      starts[count] = end;
      return count - 1;
    },
    subjectOf: (text) => subjects.toString('utf8', starts[text], starts[text + 1]),
    authorIdOf: (text) => authorIds[text],
    view: () => ({
      count,
      subjects: subjectMemory,
      starts: startMemory,
      authorIds: authorMemory,
      authors: [...authors],
    }),
  };
}
