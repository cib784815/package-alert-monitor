import fs from "node:fs";
import { chromium } from "playwright";
import { formatSentTime, isQuietHours, parseTrackingPage } from "./monitor-core.mjs";

const trackingNumber = process.env.TRACKING_NUMBER?.trim();
const ntfyTopic = process.env.NTFY_TOPIC?.trim();
const isManualRun = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

if (!/^\d{20,22}$/.test(trackingNumber ?? "")) {
  throw new Error("TRACKING_NUMBER is missing or invalid.");
}
if (!/^[-_A-Za-z0-9]{1,64}$/.test(ntfyTopic ?? "")) {
  throw new Error("NTFY_TOPIC is missing or invalid.");
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

async function notify(title, body) {
  if (process.env.DRY_RUN === "1") {
    console.log(`Dry run: ${title} - ${body}`);
    return;
  }
  const response = await fetch(`https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Priority: "high",
      Title: title
    },
    body
  });
  if (!response.ok) {
    throw new Error(`ntfy returned HTTP ${response.status}.`);
  }
}

setOutput("delivered", "false");
const now = new Date();
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;

  await page.goto(trackingUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByText("Tracking Number:", { exact: true }).waitFor({
    state: "visible",
    timeout: 30_000
  });

  const paragraphs = await page.locator("p:visible").allTextContents();
  const headings = await page.locator("h1:visible,h2:visible,h3:visible").allTextContents();
  const tracking = parseTrackingPage(paragraphs, headings);

  if (isQuietHours(now) && !tracking.delivered && !isManualRun) {
    console.log("Quiet hours are active; no routine notification was sent.");
    process.exitCode = 0;
  } else {
    const title = tracking.delivered ? "USPS Package Delivered" : "USPS Package Update";
    const body = [
      `Location: ${tracking.location}.`,
      `Status: ${tracking.status}.`,
      `Sent: ${formatSentTime(now)}.`,
      `ETA: ${tracking.eta}.`
    ].join(" ");

    await notify(title, body);
    console.log("USPS notification sent.");
  }

  if (tracking.delivered) {
    setOutput("delivered", "true");
  }
} catch (error) {
  if (!isQuietHours(now) || isManualRun) {
    await notify(
      "USPS Tracking Unavailable",
      `Official USPS tracking is unavailable. Sent: ${formatSentTime(now)}.`
    );
  }
  throw error;
} finally {
  await browser?.close();
}
