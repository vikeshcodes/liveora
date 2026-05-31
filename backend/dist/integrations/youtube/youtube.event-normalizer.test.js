"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
(0, node_test_1.default)("normalizes YouTube chat messages with author badges", () => {
    const event = (0, youtube_event_normalizer_1.normalizeYouTubeChatMessage)({
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
    }, "main-overlay");
    strict_1.default.equal(event.id, "chat-1");
    strict_1.default.equal(event.type, "chat");
    strict_1.default.equal(event.priority, 5);
    strict_1.default.equal(event.username, "Viewer");
    strict_1.default.equal(event.message, "Hello Vikesh!");
    strict_1.default.equal(event.isVerified, true);
    strict_1.default.equal(event.isChatSponsor, true);
    strict_1.default.equal(event.meta.liveChatId, "live-chat-1");
});
(0, node_test_1.default)("normalizes Super Chats with amount micros and display amount", () => {
    const event = (0, youtube_event_normalizer_1.normalizeYouTubeSuperChat)({
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
    }, "main-overlay");
    strict_1.default.equal(event.type, "superchat");
    strict_1.default.equal(event.priority, 1);
    strict_1.default.equal(event.amount, 100);
    strict_1.default.equal(event.amountMicros, 100000000);
    strict_1.default.equal(event.currency, "INR");
    strict_1.default.equal(event.displayAmount, "₹100.00");
});
(0, node_test_1.default)("normalizes viewer count events without spamming alert priority", () => {
    const event = (0, youtube_event_normalizer_1.normalizeYouTubeViewerCount)("video-1", 42, "main-overlay", "2026-05-26T08:02:00.000Z");
    strict_1.default.equal(event.id, "viewer-count-video-1-2026-05-26T08:02:00.000Z");
    strict_1.default.equal(event.type, "viewer_count");
    strict_1.default.equal(event.priority, 6);
    strict_1.default.equal(event.count, 42);
    strict_1.default.equal(event.message, "42 watching");
});
(0, node_test_1.default)("normalizes subscribers as best effort", () => {
    const event = (0, youtube_event_normalizer_1.normalizeYouTubeSubscriber)({
        subscriberSnippet: {
            channelId: "subscriber-channel-1",
            title: "Rahul",
            publishedAt: "2026-05-26T08:03:00.000Z",
            thumbnails: { default: { url: "https://example.com/rahul.png" } }
        }
    }, "main-overlay");
    strict_1.default.equal(event.id, "youtube-subscriber-subscriber-channel-1");
    strict_1.default.equal(event.type, "subscriber");
    strict_1.default.equal(event.priority, 3);
    strict_1.default.equal(event.reliability, "best_effort");
    strict_1.default.match(String(event.meta.warning), /best-effort/);
});
(0, node_test_1.default)("normalizes memberships with level name when provided", () => {
    const event = (0, youtube_event_normalizer_1.normalizeYouTubeMember)({
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
    }, "main-overlay");
    strict_1.default.equal(event.id, "member-1");
    strict_1.default.equal(event.type, "membership");
    strict_1.default.equal(event.priority, 2);
    strict_1.default.equal(event.levelName, "Gold");
    strict_1.default.equal(event.meta.memberChannelId, "member-channel-1");
});
