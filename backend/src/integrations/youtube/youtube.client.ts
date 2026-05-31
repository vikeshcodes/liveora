import { refreshGoogleAccessToken } from "./youtube.oauth";
import { YouTubeTokenStore } from "./youtube.tokens";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  statusCode: number;
  reason: string | null;

  constructor(message: string, statusCode: number, reason: string | null) {
    super(message);
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

export class YouTubeClient {
  constructor(private readonly tokenStore: YouTubeTokenStore) {}

  async get<T>(overlayId: string, path: string, params: Record<string, string | number | boolean | undefined | null>) {
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

    return this.parseResponse<T>(response);
  }

  async stream(overlayId: string, path: string, params: Record<string, string | number | boolean | undefined | null>) {
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

    return response.body!;
  }

  async getAccessToken(overlayId: string) {
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

    const refreshed = await refreshGoogleAccessToken(auth.tokens.refreshToken);
    await this.tokenStore.updateTokens(overlayId, refreshed);
    return refreshed.access_token;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const payload = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      const detail = payload.error?.errors?.[0];
      const message = payload.error?.message ?? "YouTube API request failed";
      throw new YouTubeApiError(message, response.status, detail?.reason ?? payload.error?.status ?? null);
    }

    return payload as T;
  }
}
