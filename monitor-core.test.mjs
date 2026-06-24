import test from "node:test";
import assert from "node:assert/strict";
import { isQuietHours, parseTrackingPage } from "./monitor-core.mjs";

test("parses an in-transit package with an ETA", () => {
  const result = parseTrackingPage([
    "Tracking Number:",
    "Your item is being processed at our USPS facility in RANDALLSTOWN, MD 21133.",
    "On the Way",
    "Processing at USPS Facility",
    "RANDALLSTOWN, MD 21133",
    "June 23, 2026 6:12 AM"
  ], [
    "USPS Tracking",
    "Expected Delivery by:",
    "Friday 26 June 2026 Expected Delivery Date by 9:00pm Expected Delivery Time"
  ]);

  assert.equal(result.delivered, false);
  assert.equal(result.status, "Processing at USPS Facility");
  assert.equal(result.location, "RANDALLSTOWN, MD 21133");
  assert.equal(result.eta, "Friday 26 June 2026 by 9:00pm");
});

test("recognizes delivery and a missing ETA", () => {
  const result = parseTrackingPage([
    "Tracking Number:",
    "Your item was delivered in or at the mailbox at 2:34 pm.",
    "Delivered",
    "Delivered, In/At Mailbox",
    "BALTIMORE, MD 21201",
    "June 26, 2026 2:34 PM"
  ], ["USPS Tracking"]);

  assert.equal(result.delivered, true);
  assert.equal(result.status, "Delivered, In/At Mailbox");
  assert.equal(result.location, "BALTIMORE, MD 21201");
  assert.equal(result.eta, "USPS does not show one yet");
});

test("uses America/New_York quiet hours", () => {
  assert.equal(isQuietHours(new Date("2026-06-24T03:30:00Z")), true);
  assert.equal(isQuietHours(new Date("2026-06-24T10:00:00Z")), false);
});
