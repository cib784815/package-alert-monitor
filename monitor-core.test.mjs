import test from "node:test";
import assert from "node:assert/strict";
import { formatSentTime, isQuietHours, notificationBody, notificationTitle } from "./monitor-core.mjs";

test("applies Eastern quiet hours", () => {
  assert.equal(isQuietHours(new Date("2026-06-25T03:00:00Z")), true);
  assert.equal(isQuietHours(new Date("2026-06-25T10:00:00Z")), false);
});

test("formats the package update notification body", () => {
  const tracking = {
    delivered: false,
    eta: "Friday, June 26, 2026 by 9:00 PM",
    location: "RANDALLSTOWN, MD 21133",
    status: "Processing at USPS Facility"
  };
  const sent = formatSentTime(new Date("2026-06-25T15:10:00Z"));

  assert.equal(notificationTitle(tracking), "USPS Package Update");
  assert.match(notificationBody(tracking, sent), /Location: RANDALLSTOWN, MD 21133\./);
  assert.match(notificationBody(tracking, sent), /ETA: Friday, June 26, 2026 by 9:00 PM\./);
});

test("uses delivered title for final notification", () => {
  assert.equal(notificationTitle({ delivered: true }), "USPS Package Delivered");
});
