const PHASES = new Set([
  "Pre-Shipment",
  "USPS Awaiting Item",
  "Accepted",
  "In Transit",
  "Moving Through Network",
  "On the Way",
  "Arrived at USPS Facility",
  "Departed USPS Facility",
  "Out for Delivery",
  "Available for Pickup",
  "Delivery Attempted",
  "Held at Post Office",
  "Returning to Sender",
  "Delivered",
  "Alert"
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function looksLikeDate(value) {
  return /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i.test(value)
    && /\b\d{4}\b/.test(value);
}

function parseEta(headings) {
  const values = headings.map(clean).filter(Boolean);
  const labelIndex = values.findIndex((value) =>
    value.toLowerCase().startsWith("expected delivery by")
  );
  if (labelIndex < 0 || !values[labelIndex + 1]) {
    return "USPS does not show one yet";
  }

  const raw = values[labelIndex + 1];
  const date = clean(raw.split(/Expected Delivery Date/i)[0]);
  const time = raw.match(/\bby\s+\d{1,2}:\d{2}\s*(?:am|pm)\b/i)?.[0];
  const eta = clean([date, time].filter(Boolean).join(" "));
  return eta || "USPS does not show one yet";
}

export function parseTrackingPage(paragraphs, headings) {
  const values = paragraphs.map(clean).filter(Boolean);
  const trackingLabelIndex = values.findIndex((value) => value === "Tracking Number:");
  const details = trackingLabelIndex >= 0 ? values.slice(trackingLabelIndex + 1) : values;

  const update = details.find((value) =>
    /^(?:Your item|Your package|Your shipment|We delivered|The item|The package)/i.test(value)
  );
  const phaseIndex = details.findIndex((value) => PHASES.has(value));
  const phase = phaseIndex >= 0 ? details[phaseIndex] : "Status not shown";
  const statusCandidate = phaseIndex >= 0 ? details[phaseIndex + 1] : null;
  const status = statusCandidate && !looksLikeDate(statusCandidate)
    ? statusCandidate
    : phase;
  const locationCandidate = phaseIndex >= 0 ? details[phaseIndex + 2] : null;
  const location = locationCandidate
    && !looksLikeDate(locationCandidate)
    && !/Contact USPS Tracking support/i.test(locationCandidate)
      ? locationCandidate
      : "not shown";

  if (!update && phase === "Status not shown") {
    throw new Error("USPS tracking details were not found on the official page.");
  }

  const delivered = phase === "Delivered"
    || /^Delivered\b/i.test(status)
    || /^(?:Your item|Your package|We) (?:was |has been )?delivered\b/i.test(update ?? "");

  return {
    delivered,
    eta: parseEta(headings),
    location,
    status: status === "Status not shown" ? update : status,
    update: update ?? status
  };
}

export function isQuietHours(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: "America/New_York"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return hour >= 23 || hour < 6;
}

export function formatSentTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/New_York",
    timeZoneName: "short",
    year: "numeric"
  }).format(date);
}
