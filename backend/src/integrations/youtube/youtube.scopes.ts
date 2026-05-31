export const YOUTUBE_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl"
];

export const YOUTUBE_MEMBERSHIP_SCOPE = "https://www.googleapis.com/auth/youtube.channel-memberships.creator";

export const buildYouTubeScopes = (includeMembership = false) => [
  ...YOUTUBE_REQUIRED_SCOPES,
  ...(includeMembership ? [YOUTUBE_MEMBERSHIP_SCOPE] : [])
];

export const hasScope = (scopeString: string | undefined | null, scope: string) =>
  Boolean(scopeString?.split(/\s+/).includes(scope));
