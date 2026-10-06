import { describe, it, expect } from "vitest";
import { getAverageWaitTime } from "@/lib/wait-time-utils";

const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString();

const EXPIRY = {
  report_expiry_30min_minutes: 30,
  report_expiry_60min_minutes: 60,
  report_expiry_90plus_minutes: 90,
};

describe("getAverageWaitTime", () => {
  it("defaults to green On Time (lastReported null) when there are no reports", () => {
    // Product decision (2026-07-22): no active report shows the green "On Time"
    // default, matching the mobile app — not a grey "No reports" state.
    const result = getAverageWaitTime([], EXPIRY);
    expect(result.category).toBe("on_time");
    expect(result.lastReported).toBeNull();
  });

  it("defaults to On Time when the most recent report has aged out of its own window", () => {
    const stale = [{ wait_time: "1_hour" as const, reported_at: minutesAgo(500) }];
    const result = getAverageWaitTime(stale, EXPIRY);
    expect(result.category).toBe("on_time");
    expect(result.lastReported).toBeNull();
  });

  it("marks a real on_time report with a timestamp (not the default)", () => {
    const result = getAverageWaitTime(
      [{ wait_time: "on_time" as const, reported_at: minutesAgo(5) }],
      EXPIRY
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
      EXPIRY
    );
    expect(result?.category).toBe("1.5_hours_plus");
    expect(result?.lastReported).toBe(recent);
  });

  // Regression test: a newer, shorter-lived report expiring must NOT reveal
  // an older report that happens to still be inside its own longer window —
  // once superseded, a report is done for good, even after the one that
  // superseded it has itself expired.
  it("reverts to On Time once the latest report expires, never resurrecting an older superseded one", () => {
    const result = getAverageWaitTime(
      [
        // Submitted first — a 90-min category report, 90-min window not yet elapsed.
        { wait_time: "1.5_hours_plus", reported_at: minutesAgo(40) },
        // Submitted later, superseding the one above — but its own 30-min
        // window elapsed 5 minutes ago.
        { wait_time: "30_min", reported_at: minutesAgo(35) },
      ],
      EXPIRY
    );
    expect(result.category).toBe("on_time");
    expect(result.lastReported).toBeNull();
  });

  it("still shows the latest report while it's within its own window, ignoring older ones underneath", () => {
    const recent = minutesAgo(10);
    const result = getAverageWaitTime(
      [
        { wait_time: "1.5_hours_plus", reported_at: minutesAgo(40) },
        { wait_time: "30_min", reported_at: recent },
      ],
      EXPIRY
    );
    expect(result.category).toBe("30_min");
    expect(result.lastReported).toBe(recent);
  });

  // Regression test: flagging the most recent report must behave the same
  // way as it expiring — revert to On Time, never reveal an older report
  // still sitting underneath within its own window. `reports` passed in
  // must NOT be pre-filtered by is_flagged, or this function never even
  // sees the flagged row to know to stop there.
  it("reverts to On Time when the latest report is flagged, never resurrecting an older one", () => {
    const result = getAverageWaitTime(
      [
        { wait_time: "1.5_hours_plus", reported_at: minutesAgo(40), is_flagged: false },
        { wait_time: "30_min", reported_at: minutesAgo(5), is_flagged: true },
      ],
      EXPIRY
    );
    expect(result.category).toBe("on_time");
    expect(result.lastReported).toBeNull();
  });
});
