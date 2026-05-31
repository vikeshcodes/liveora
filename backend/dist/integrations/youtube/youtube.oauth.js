"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeGoogleToken = exports.refreshGoogleAccessToken = exports.exchangeCodeForTokens = exports.getYouTubeAuthUrl = exports.consumeOAuthState = exports.createOAuthState = exports.setYouTubeOAuthConfigProvider = exports.isPlaceholderGoogleCredential = void 0;
const node_crypto_1 = require("node:crypto");
const env_1 = require("../../config/env");
const youtube_scopes_1 = require("./youtube.scopes");
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const stateStore = new Map();
let oauthConfigProvider = () => ({
    clientId: env_1.env.GOOGLE_CLIENT_ID,
    clientSecret: env_1.env.GOOGLE_CLIENT_SECRET,
    redirectUri: env_1.env.GOOGLE_REDIRECT_URI
});
const isPlaceholderGoogleCredential = (value) => !value || value.startsWith("replace_with_") || value.includes("REPLACE_WITH");
exports.isPlaceholderGoogleCredential = isPlaceholderGoogleCredential;
const ensureGoogleOAuthConfig = () => {
    const config = oauthConfigProvider();
    if ((0, exports.isPlaceholderGoogleCredential)(config.clientId) ||
        (0, exports.isPlaceholderGoogleCredential)(config.clientSecret) ||
        !config.redirectUri) {
        throw Object.assign(new Error("Google OAuth env vars are not configured"), {
            statusCode: 503,
            code: "YOUTUBE_OAUTH_NOT_CONFIGURED"
        });
    }
    return config;
};
const setYouTubeOAuthConfigProvider = (provider) => {
    oauthConfigProvider = provider;
};
exports.setYouTubeOAuthConfigProvider = setYouTubeOAuthConfigProvider;
const createOAuthState = (overlayId) => {
    const state = (0, node_crypto_1.randomBytes)(24).toString("hex");
    stateStore.set(state, { overlayId, createdAt: Date.now() });
    return state;
};
exports.createOAuthState = createOAuthState;
const consumeOAuthState = (state) => {
    const value = stateStore.get(state);
    stateStore.delete(state);
    if (!value || Date.now() - value.createdAt > 10 * 60 * 1000) {
        throw Object.assign(new Error("Invalid or expired OAuth state"), { statusCode: 400 });
    }
    return value;
};
exports.consumeOAuthState = consumeOAuthState;
const getYouTubeAuthUrl = (overlayId, includeMembership = false) => {
    const config = ensureGoogleOAuthConfig();
    const state = (0, exports.createOAuthState)(overlayId);
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: (0, youtube_scopes_1.buildYouTubeScopes)(includeMembership).join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        state
    });
    return `${AUTH_URL}?${params.toString()}`;
};
exports.getYouTubeAuthUrl = getYouTubeAuthUrl;
const parseTokenResponse = async (response) => {
    const payload = (await response.json());
    if (!response.ok) {
        throw Object.assign(new Error(payload.error_description ?? payload.error ?? "Google OAuth token request failed"), {
            statusCode: 502
        });
    }
    return {
        ...payload,
        expiry_date: Date.now() + Number(payload.expires_in ?? 3600) * 1000
    };
};
const exchangeCodeForTokens = async (code) => {
    const config = ensureGoogleOAuthConfig();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: config.redirectUri
        })
    });
    return parseTokenResponse(response);
};
exports.exchangeCodeForTokens = exchangeCodeForTokens;
const refreshGoogleAccessToken = async (refreshToken) => {
    const config = ensureGoogleOAuthConfig();
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        })
    });
    return parseTokenResponse(response);
};
exports.refreshGoogleAccessToken = refreshGoogleAccessToken;
const revokeGoogleToken = async (token) => {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
};
exports.revokeGoogleToken = revokeGoogleToken;
