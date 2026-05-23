/**
 * Sidebar mount-time self-close, no-op stub on Firefox.
 *
 * Firefox's manifest schema requires `sidebar_action.default_panel`,
 * and on temp install (or initial install) Firefox auto-opens that
 * panel. We previously attempted a programmatic close here, but
 * Firefox restricts `sidebarAction.close()` to user-gesture handlers
 * — there is no script-context exemption, including the sidebar's
 * own scripts. The sidebar therefore stays open until the user
 * dismisses it (sidebar rail icon, sidebar X button, or the in-app
 * close affordance — all gesture contexts).
 *
 * Kept as an empty module so the import in `sidepanel/index.tsx`
 * remains a stable seam if a future Firefox release relaxes the
 * gesture requirement.
 */

export {};
