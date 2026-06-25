export function isQuietHours(date = new Date(), timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return hour >= 23 || hour < 6;
}

export function formatSentTime(date = new Date(), timeZone = "America/New_York") {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
    year: "numeric"
  }).format(date);
}

export function notificationTitle(tracking) {
  return tracking.delivered ? "USPS Package Delivered" : "USPS Package Update";
}

export function notificationBody(tracking, sent) {
  return [
    `Location: ${tracking.location || "not shown"}.`,
    `Status: ${tracking.status || "Status not shown"}.`,
    `Sent: ${sent}.`,
    `ETA: ${tracking.eta || "USPS does not show one yet"}.`
  ].join(" ");
}
