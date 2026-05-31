"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeQuotaTracker = void 0;
const WARNING_THRESHOLD = 8500;
class YouTubeQuotaTracker {
    since = new Date().toISOString();
    byPoller = new Map();
    record(poller, units) {
        this.byPoller.set(poller, (this.byPoller.get(poller) ?? 0) + units);
    }
    snapshot() {
        const byPoller = Object.fromEntries(this.byPoller.entries());
        const totalApproxUnits = Object.values(byPoller).reduce((sum, value) => sum + value, 0);
        const warnings = totalApproxUnits >= WARNING_THRESHOLD
            ? [`Approximate YouTube quota usage is ${totalApproxUnits} units since backend start.`]
            : [];
        return {
            totalApproxUnits,
            byPoller,
            warnings,
            since: this.since
        };
    }
}
exports.YouTubeQuotaTracker = YouTubeQuotaTracker;
