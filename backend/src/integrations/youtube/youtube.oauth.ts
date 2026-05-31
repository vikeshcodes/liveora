import { randomBytes } from "node:crypto";
import { env } from "../../config/env";
import type { YouTubeOAuthTokens } from "./youtube.types";
import { buildYouTubeScopes } from "./youtube.scopes";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
type OAuthConfig = { clientId?: string; clientSecret?: string; redirectUri?: string };

interface OAuthState {
  overlayId: string;
  createdAt: number;
}

const stateStore = new Map<string, OAuthState>();
let oauthConfigProvider = (): OAuthConfig => ({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_REDIRECT_URI
});

export const isPlaceholderGoogleCredential = (value: string | undefined) =>
  !value || value.startsWith("replace_with_") || value.includes("REPLACE_WITH");

const ensureGoogleOAuthConfig = () => {
  const config = oauthConfigProvider();
  if (
    isPlaceholderGoogleCredential(config.clientId) ||
    isPlaceholderGoogleCredential(config.clientSecret) ||
    !config.redirectUri
  ) {
    throw Object.assign(new Error("Google OAuth env vars are not configured"), {
      statusCode: 503,
      code: "YOUTUBE_OAUTH_NOT_CONFIGURED"
    });
  }

  return config as Required<OAuthConfig>;
};

export const setYouTubeOAuthConfigProvider = (provider: () => OAuthConfig) => {
  oauthConfigProvider = provider;
};

export const createOAuthState = (overlayId: string) => {
  const state = randomBytes(24).toString("hex");
  stateStore.set(state, { overlayId, createdAt: Date.now() });
  return state;
};

export const consumeOAuthState = (state: string) => {
  const value = stateStore.get(state);
  stateStore.delete(state);

  if (!value || Date.now() - value.createdAt > 10 * 60 * 1000) {
    throw Object.assign(new Error("Invalid or expired OAuth state"), { statusCode: 400 });
  }

  return value;
};

export const getYouTubeAuthUrl = (overlayId: string, includeMembership = false) => {
  const config = ensureGoogleOAuthConfig();
  const state = createOAuthState(overlayId);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: buildYouTubeScopes(includeMembership).join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state
  });

  return `${AUTH_URL}?${params.toString()}`;
};

const parseTokenResponse = async (response: Response) => {
  const payload = (await response.json()) as YouTubeOAuthTokens & { error?: string; error_description?: string };
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

export const exchangeCodeForTokens = async (code: string) => {
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

export const refreshGoogleAccessToken = async (refreshToken: string) => {
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

export const revokeGoogleToken = async (token: string) => {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
};
