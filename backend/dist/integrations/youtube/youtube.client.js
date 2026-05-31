"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeClient = exports.YouTubeApiError = void 0;
const youtube_oauth_1 = require("./youtube.oauth");
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
class YouTubeApiError extends Error {
    statusCode;
    reason;
    constructor(message, statusCode, reason) {
        super(message);
        this.statusCode = statusCode;
        this.reason = reason;
    }
}
exports.YouTubeApiError = YouTubeApiError;
class YouTubeClient {
    tokenStore;
    constructor(tokenStore) {
        this.tokenStore = tokenStore;
    }
    async get(overlayId, path, params) {
        const accessToken = await this.getAccessToken(overlayId);
        const url = new URL(`${YOUTUBE_API_BASE}${path}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        });
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });
        return this.parseResponse(response);
    }
    async stream(overlayId, path, params) {
        const accessToken = await this.getAccessToken(overlayId);
        const url = new URL(`${YOUTUBE_API_BASE}${path}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        });
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });
        if (!response.ok || !response.body) {
            await this.parseResponse(response);
        }
        return response.body;
    }
    async getAccessToken(overlayId) {
        const auth = await this.tokenStore.getAuth(overlayId);
        if (!auth) {
            throw Object.assign(new Error("YouTube OAuth is not connected"), { statusCode: 401 });
        }
        if (auth.tokens.expiryDate > Date.now() + 60_000) {
            return auth.tokens.accessToken;
        }
        if (!auth.tokens.refreshToken) {
            throw Object.assign(new Error("YouTube refresh token is missing. Reconnect YouTube."), { statusCode: 401 });
        }
        const refreshed = await (0, youtube_oauth_1.refreshGoogleAccessToken)(auth.tokens.refreshToken);
        await this.tokenStore.updateTokens(overlayId, refreshed);
        return refreshed.access_token;
    }
    async parseResponse(response) {
        const payload = (await response.json().catch(() => ({})));
        if (!response.ok) {
            const detail = payload.error?.errors?.[0];
            const message = payload.error?.message ?? "YouTube API request failed";
            throw new YouTubeApiError(message, response.status, detail?.reason ?? payload.error?.status ?? null);
        }
        return payload;
    }
}
exports.YouTubeClient = YouTubeClient;
