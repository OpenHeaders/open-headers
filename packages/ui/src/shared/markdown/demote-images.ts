/**
 * Rewrite markdown image embeds (`![alt](url)`) into plain links so
 * rendering never auto-loads the target. Release-notes surfaces use it
 * on feed-served bodies whose asset refs are absolute feed URLs: an
 * embedded <img> would dial the feed on render (and the desktop
 * renderer's CSP blocks remote images outright), while a link keeps the
 * fetch behind an explicit user click — the same degrade-to-link
 * posture `oh changelog` gets for free from the terminal.
 */

export function demoteImagesToLinks(markdown: string): string {
  return markdown.replace(/!\[([^\]]*)\]\(/g, (_match, alt: string) => `[${alt.trim() === '' ? 'image' : alt}](`);
}
