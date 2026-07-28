/**
 * The `virtual:whats-new` module is provided at build time by the
 * whats-new-entry plugin (see `vite.config.ts`): the running version's
 * canonical changelog entry body with frontmatter stripped, or the
 * empty string when the version has no entry.
 */
declare module 'virtual:whats-new' {
  const body: string;
  export default body;
}
