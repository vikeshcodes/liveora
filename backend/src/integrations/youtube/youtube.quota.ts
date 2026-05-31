import type { YouTubeQuotaSnapshot } from "./youtube.types";

const WARNING_THRESHOLD = 8500;

export class YouTubeQuotaTracker {
  private readonly since = new Date().toISOString();
  private byPoller = new Map<string, number>();

  record(poller: string, units: number) {
    this.byPoller.set(poller, (this.byPoller.get(poller) ?? 0) + units);
  }

  snapshot(): YouTubeQuotaSnapshot {
    const byPoller = Object.fromEntries(this.byPoller.entries());
    const totalApproxUnits = Object.values(byPoller).reduce((sum, value) => sum + value, 0);
    const warnings =
      totalApproxUnits >= WARNING_THRESHOLD
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
