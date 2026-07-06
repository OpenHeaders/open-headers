/**
 * Shared gate for the playground parity seams (rule import/delete, fire
 * readback). Each seam is inert unless the driving probe has set
 * `chrome.storage.local.__oh_parity_hook__` — see the posture note in
 * `parity-rule-import.ts`.
 */

export async function isParityHookEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get('__oh_parity_hook__');
  return result.__oh_parity_hook__ === true;
}
