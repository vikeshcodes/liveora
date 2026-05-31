import type { NormalizedYouTubeEvent } from "./youtube.types";

const nowIso = () => new Date().toISOString();

const parseAmount = (micros: unknown) => {
  const value = Number(micros ?? 0);
  return Number.isFinite(value) ? value / 1_000_000 : null;
};

const pickThumbnail = (thumbnails: any) =>
  thumbnails?.default?.url ?? thumbnails?.medium?.url ?? thumbnails?.high?.url ?? thumbnails?.standard?.url ?? null;

export const normalizeYouTubeChatMessage = (item: any, overlayId: string): NormalizedYouTubeEvent => {
  const snippet = item.snippet ?? {};
  const author = item.authorDetails ?? {};
  const publishedAt = snippet.publishedAt ?? nowIso();

  return {
    id: item.id,
    platform: "youtube",
    type: "chat",
    overlayId,
    priority: 5,
    username: author.displayName ?? "YouTube Viewer",
    message: snippet.displayMessage ?? snippet.textMessageDetails?.messageText ?? "",
    amount: null,
    currency: null,
    displayAmount: null,
    avatarUrl: author.profileImageUrl ?? null,
    publishedAt,
    isVerified: Boolean(author.isVerified),
    isChatOwner: Boolean(author.isChatOwner),
    isChatSponsor: Boolean(author.isChatSponsor),
    isChatModerator: Boolean(author.isChatModerator),
    meta: {
      youtubeMessageType: snippet.type,
      liveChatId: snippet.liveChatId
    },
    raw: item
  };
};

export const normalizeYouTubeSuperChat = (item: any, overlayId: string): NormalizedYouTubeEvent => {
  const snippet = item.snippet ?? {};
  const amountMicros = Number(snippet.amountMicros ?? 0);
  const publishedAt = snippet.createdAt ?? nowIso();

  return {
    id: item.id,
    platform: "youtube",
    type: "superchat",
    overlayId,
    priority: 1,
    username: snippet.supporterDetails?.displayName ?? "YouTube Supporter",
    message: snippet.commentText ?? "",
    amount: parseAmount(amountMicros),
    amountMicros,
    currency: snippet.currency ?? null,
    displayAmount: snippet.displayString ?? null,
    avatarUrl: snippet.supporterDetails?.profileImageUrl ?? null,
    publishedAt,
    meta: {
      tier: snippet.messageType ?? null,
      isSuperStickerEvent: Boolean(snippet.isSuperStickerEvent),
      superStickerMetadata: snippet.superStickerMetadata ?? null
    },
    raw: item
  };
};

export const normalizeYouTubeViewerCount = (
  videoId: string,
  count: number,
  overlayId: string,
  publishedAt = nowIso()
): NormalizedYouTubeEvent => ({
  id: `viewer-count-${videoId}-${publishedAt}`,
  platform: "youtube",
  type: "viewer_count",
  overlayId,
  priority: 6,
  username: "YouTube",
  message: `${count} watching`,
  amount: count,
  currency: null,
  displayAmount: null,
  avatarUrl: null,
  publishedAt,
  count,
  meta: { videoId },
  raw: {}
});

export const normalizeYouTubeSubscriber = (item: any, overlayId: string): NormalizedYouTubeEvent => {
  const snippet = item.subscriberSnippet ?? item.snippet ?? {};
  const channelId = snippet.channelId ?? item.id;
  const publishedAt = snippet.publishedAt ?? nowIso();

  return {
    id: `youtube-subscriber-${channelId}`,
    platform: "youtube",
    type: "subscriber",
    overlayId,
    priority: 3,
    username: snippet.title ?? "YouTube Subscriber",
    message: "subscribed to the channel",
    amount: null,
    currency: null,
    displayAmount: null,
    avatarUrl: pickThumbnail(snippet.thumbnails),
    publishedAt,
    reliability: "best_effort",
    meta: {
      subscriberChannelId: channelId,
      warning: "Subscriber alerts are best-effort because YouTube does not expose all private subscriber events."
    },
    raw: item
  };
};

export const normalizeYouTubeMember = (item: any, overlayId: string): NormalizedYouTubeEvent => {
  const snippet = item.snippet ?? {};
  const memberDetails = snippet.memberDetails ?? {};
  const membershipsDetails = snippet.membershipsDetails ?? {};
  const publishedAt = membershipsDetails.memberSince ?? nowIso();
  const levelName = membershipsDetails.highestAccessibleLevelDisplayName ?? membershipsDetails.levelName ?? null;

  return {
    id: item.id ?? memberDetails.channelId ?? `youtube-member-${publishedAt}`,
    platform: "youtube",
    type: "membership",
    overlayId,
    priority: 2,
    username: memberDetails.displayName ?? "YouTube Member",
    message: "became a member",
    amount: null,
    currency: null,
    displayAmount: null,
    avatarUrl: memberDetails.profileImageUrl ?? null,
    publishedAt,
    levelName,
    meta: {
      levelName,
      memberChannelId: memberDetails.channelId ?? null,
      membershipsDetails
    },
    raw: item
  };
};

export const normalizeYouTubeStreamStatus = (
  overlayId: string,
  status: string,
  raw: Record<string, unknown> = {}
): NormalizedYouTubeEvent => {
  const publishedAt = nowIso();
  return {
    id: `youtube-stream-status-${status}-${publishedAt}`,
    platform: "youtube",
    type: "stream_status",
    overlayId,
    priority: 7,
    username: "YouTube",
    message: `Stream status: ${status}`,
    amount: null,
    currency: null,
    displayAmount: null,
    avatarUrl: null,
    publishedAt,
    meta: { status },
    raw
  };
};
