/**
 * Workspace naming utilities — shared between desktop and extension.
 *
 * These functions implement the V5 folder naming conventions:
 *   - Folder names: slug + uid suffix (e.g. "login-x7k2")
 *   - UIDs: 4-char alphanumeric
 *   - Slugs: lowercase alphanumeric + hyphens
 */

/**
 * Generate a 4-char alphanumeric uid for folder naming.
 */
export function generateUid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let uid = '';
  for (let i = 0; i < 4; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

/**
 * Slugify a display name for use in folder names.
 * e.g. "My Rules" → "my-rules", "Bearer Token" → "bearer-token"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a folder name from a display name and uid.
 * e.g. "Login" + "x7k2" → "login-x7k2"
 */
export function toFolderName(name: string, uid: string): string {
  const slug = slugify(name);
  return slug ? `${slug}-${uid}` : uid;
}

/**
 * Extract the uid suffix from a folder name.
 * e.g. "login-x7k2" → "x7k2", "x7k2" → "x7k2"
 */
export function extractUid(folderName: string): string {
  const lastDash = folderName.lastIndexOf('-');
  if (lastDash === -1 || lastDash === folderName.length - 1) return folderName;
  return folderName.slice(lastDash + 1);
}
