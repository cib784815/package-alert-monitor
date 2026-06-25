import fs from "node:fs";
import { formatSentTime, isQuietHours, notificationBody, notificationTitle } from "./monitor-core.mjs";

const cloudflareUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/+$/, "");
const cloudflareKey = process.env.CLOUDFLARE_MANUAL_RUN_KEY?.trim();
const ntfyTopic = process.env.NTFY_TOPIC?.trim();
const ntfyToken = process.env.NTFY_TOKEN?.trim();
const forceNotify = process.env.FORCE_NOTIFY === "1";

if (!cloudflareUrl) throw new Error("CLOUDFLARE_WORKER_URL is missing.");
if (!cloudflareKey) throw new Error("CLOUDFLARE_MANUAL_RUN_KEY is missing.");
if (!/^[-_A-Za-z0-9]{1,128}$/.test(ntfyTopic ?? "")) throw new Error("NTFY_TOPIC is missing or invalid.");
if (!ntfyToken) throw new Error("NTFY_TOKEN is missing.");

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function notify(title, body) {
  const response = await fetch(`https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ntfyToken}`,
      "Content-Type": "text/plain; charset=utf-8",
      Priority: "high",
      Title: title
    },
    body
  });
  if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}.`);
}

async function checkCloudflare() {
  const response = await fetch(`${cloudflareUrl}/check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cloudflareKey}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error || !payload.tracking) {
    throw new Error(payload.error || `Cloudflare check returned HTTP ${response.status}.`);
  }
  return payload.tracking;
}

setOutput("delivered", "false");

const now = new Date();
const sent = formatSentTime(now);

try {
  const tracking = await checkCloudflare();

  if (isQuietHours(now) && !tracking.delivered && !forceNotify) {
    console.log("Quiet hours are active; no routine notification was sent.");
  } else {
    await notify(notificationTitle(tracking), notificationBody(tracking, sent));
    console.log("USPS notification sent.");
  }

  if (tracking.delivered) setOutput("delivered", "true");
} catch (error) {
  if (!isQuietHours(now) || forceNotify) {
    await notify("USPS Tracking Unavailable", `Official USPS tracking is unavailable. Sent: ${sent}.`);
  }
  throw error;
}
