"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasScope = exports.buildYouTubeScopes = exports.YOUTUBE_MEMBERSHIP_SCOPE = exports.YOUTUBE_REQUIRED_SCOPES = void 0;
exports.YOUTUBE_REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl"
];
exports.YOUTUBE_MEMBERSHIP_SCOPE = "https://www.googleapis.com/auth/youtube.channel-memberships.creator";
const buildYouTubeScopes = (includeMembership = false) => [
    ...exports.YOUTUBE_REQUIRED_SCOPES,
    ...(includeMembership ? [exports.YOUTUBE_MEMBERSHIP_SCOPE] : [])
];
exports.buildYouTubeScopes = buildYouTubeScopes;
const hasScope = (scopeString, scope) => Boolean(scopeString?.split(/\s+/).includes(scope));
exports.hasScope = hasScope;
