/**
 * The Git window's type sizes — its branches rail, its log and the
 * bands over them read at ONE size, the reference's measure: 13 px
 * text on the rows' own pitch (24 px in the rail, 26 px in the log),
 * every glyph a step up with it. The row heights are not here: the
 * text grew inside them.
 */

/** A row's text: a ref's name, a commit's subject, author and date, a filter chip. */
export const GIT_TEXT_SIZE = 13;

/** The code face beside it (the hash column, the filter field's toggles) — a half step under, as before. */
export const GIT_CODE_SIZE = 12.5;

/** The glyph in a rail row's icon slot: the folder, the branch, the tag. */
export const GIT_ROW_GLYPH_SIZE = 14;

/** A fold caret, and the small chevron that ends a chip. */
export const GIT_CARET_SIZE = 10;

/** The tag-shaped glyph that leads a log row's ref label — the reference's size, a step over a rail row's. */
export const GIT_LABEL_GLYPH_SIZE = 16;

/** A band button's glyph — the rail's vertical bar and the pane toolbars. */
export const GIT_BAR_GLYPH_SIZE = 16;
