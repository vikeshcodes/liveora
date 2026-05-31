import assert from "node:assert/strict";
import test from "node:test";
import { normalizeYouTubeChatMessage, normalizeYouTubeMember, normalizeYouTubeSubscriber, normalizeYouTubeSuperChat, normalizeYouTubeViewerCount } from "./youtube.event-normalizer";

test("normalizes YouTube chat messages with author badges", () => {
  const event = normalizeYouTubeChatMessage(
    {
      id: "chat-1",
      snippet: {
        displayMessage: "Hello Vikesh!",
        publishedAt: "2026-05-26T08:00:00.000Z",
        type: "textMessageEvent",
        liveChatId: "live-chat-1"
      },
      authorDetails: {
        displayName: "Viewer",
        profileImageUrl: "https://example.com/avatar.png",
        isVerified: true,
        isChatOwner: false,
        isChatSponsor: true,
        isChatModerator: false
      }
    },
    "main-overlay"
  );

  assert.equal(event.id, "chat-1");
  assert.equal(event.type, "chat");
  assert.equal(event.priority, 5);
  assert.equal(event.username, "Viewer");
  assert.equal(event.message, "Hello Vikesh!");
  assert.equal(event.isVerified, true);
  assert.equal(event.isChatSponsor, true);
  assert.equal(event.meta.liveChatId, "live-chat-1");
});

test("normalizes Super Chats with amount micros and display amount", () => {
  const event = normalizeYouTubeSuperChat(
    {
      id: "superchat-1",
      snippet: {
        createdAt: "2026-05-26T08:01:00.000Z",
        supporterDetails: {
          displayName: "Aisha",
          profileImageUrl: "https://example.com/aisha.png"
        },
        commentText: "Great stream!",
        amountMicros: 100000000,
        currency: "INR",
        displayString: "₹100.00",
        messageType: 1
      }
    },
    "main-overlay"
  );

  assert.equal(event.type, "superchat");
  assert.equal(event.priority, 1);
  assert.equal(event.amount, 100);
  assert.equal(event.amountMicros, 100000000);
  assert.equal(event.currency, "INR");
  assert.equal(event.displayAmount, "₹100.00");
});

test("normalizes viewer count events without spamming alert priority", () => {
  const event = normalizeYouTubeViewerCount("video-1", 42, "main-overlay", "2026-05-26T08:02:00.000Z");

  assert.equal(event.id, "viewer-count-video-1-2026-05-26T08:02:00.000Z");
  assert.equal(event.type, "viewer_count");
  assert.equal(event.priority, 6);
  assert.equal(event.count, 42);
  assert.equal(event.message, "42 watching");
});

test("normalizes subscribers as best effort", () => {
  const event = normalizeYouTubeSubscriber(
    {
      subscriberSnippet: {
        channelId: "subscriber-channel-1",
        title: "Rahul",
        publishedAt: "2026-05-26T08:03:00.000Z",
        thumbnails: { default: { url: "https://example.com/rahul.png" } }
      }
    },
    "main-overlay"
  );

  assert.equal(event.id, "youtube-subscriber-subscriber-channel-1");
  assert.equal(event.type, "subscriber");
  assert.equal(event.priority, 3);
  assert.equal(event.reliability, "best_effort");
  assert.match(String(event.meta.warning), /best-effort/);
});

test("normalizes memberships with level name when provided", () => {
  const event = normalizeYouTubeMember(
    {
      id: "member-1",
      snippet: {
        memberDetails: {
          displayName: "Meera",
          profileImageUrl: "https://example.com/meera.png",
          channelId: "member-channel-1"
        },
        membershipsDetails: {
          highestAccessibleLevelDisplayName: "Gold",
          memberSince: "2026-05-26T08:04:00.000Z"
        }
      }
    },
    "main-overlay"
  );

  assert.equal(event.id, "member-1");
  assert.equal(event.type, "membership");
  assert.equal(event.priority, 2);
  assert.equal(event.levelName, "Gold");
  assert.equal(event.meta.memberChannelId, "member-channel-1");
});
