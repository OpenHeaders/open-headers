/**
 * The web tab's single backend identity. The tab is served by exactly
 * one daemon — `wss://<location.host>` — so the backend needs no
 * `OH.backends` registry record (and could not have one: that slot is
 * sensitive and the cipher-less web host refuses it). This fixed id is
 * what joined Orgs bind to, what the pending-out queue cursors under,
 * and what boot pins as always-present for the identity fold.
 */
export const WEB_DAEMON_BACKEND_ID = 'web-serving-daemon';
