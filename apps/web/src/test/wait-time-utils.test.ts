import { describe, it, expect } from "vitest";
import { getAverageWaitTime } from "@/lib/wait-time-utils";

const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString();

describe("getAverageWaitTime", () => {
  it("defaults to green On Time (lastReported null) when there are no reports", () => {
    // Product decision (2026-07-22): no active report shows the green "On Time"
    // default, matching the mobile app — not a grey "No reports" state.
    const result = getAverageWaitTime([]);
    expect(result.category).toBe("on_time");
    expect(result.lastReported).toBeNull();
  });

  it("defaults to On Time when every report has aged out of the window", () => {
    const stale = [{ wait_time: "1_hour" as const, reported_at: minutesAgo(500) }];
    const result = getAverageWaitTime(stale, 180);
    expect(result.category).toBe("on_time");
    expect(result.lastReported).toBeNull();
  });

  it("marks a real on_time report with a timestamp (not the default)", () => {
    const result = getAverageWaitTime(
      [{ wait_time: "on_time" as const, reported_at: minutesAgo(5) }],
      180
    );
    expect(result.category).toBe("on_time");
    expect(result.lastReported).not.toBeNull();
  });

  it("uses the most recent report, not the first in the array", () => {
    const recent = minutesAgo(10);
    const result = getAverageWaitTime(
      [
        { wait_time: "on_time", reported_at: minutesAgo(90) },
        { wait_time: "1.5_hours_plus", reported_at: recent },
      ],
      180
    );
    expect(result?.category).toBe("1.5_hours_plus");
    expect(result?.lastReported).toBe(recent);
  });
});
