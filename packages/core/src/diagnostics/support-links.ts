/**
 * The two places a person is sent to for help — the repository's
 * new-issue page (the Report Issue dialog and the root error fallback
 * prefill it) and the community chat server. Both links ship inside a
 * binary, so each must outlive the build: the invite is permanent.
 */

export const ISSUE_NEW_URL = 'https://github.com/OpenHeaders/open-headers/issues/new';

export const COMMUNITY_CHAT_URL = 'https://discord.gg/DXXne8SCXv';
