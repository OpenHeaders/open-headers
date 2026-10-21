/**
 * The line every launch writes once its main window exists — the
 * boundary the diagnostic bundle cuts `main.log` on (this launch and
 * the one before it). The window manager writes it; the log reader
 * looks for it.
 */

export const LAUNCH_MARKER = 'main window created';
/** The marker as it reads in the file, under the `startup` scope. */
export const LAUNCH_MARKER_LINE = `[startup] ${LAUNCH_MARKER}`;
