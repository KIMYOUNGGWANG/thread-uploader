/**
 * System Alert & Observability Service
 *
 * Provides real-time notifications for critical operational events:
 * - Thread publish failures & partial failures
 * - Access token expiration warnings (7-day window)
 * - Cron execution aborts and unexpected runtime errors
 *
 * Supports Slack/Discord/Generic webhooks via ALERT_WEBHOOK_URL.
 */

export type AlertLevel = "info" | "warning" | "error";

export interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  brandName?: string;
  postId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Dispatches an alert payload to configured webhooks and structured logs.
 */
export async function sendSystemAlert(alert: AlertPayload): Promise<boolean> {
  const timestamp = alert.timestamp || new Date().toISOString();
  const logPrefix = `[SYSTEM_ALERT][${alert.level.toUpperCase()}]`;

  // Always log structured output to stdout/stderr
  const logData = {
    ...alert,
    timestamp,
  };

  if (alert.level === "error") {
    console.error(logPrefix, JSON.stringify(logData));
  } else if (alert.level === "warning") {
    console.warn(logPrefix, JSON.stringify(logData));
  } else {
    console.log(logPrefix, JSON.stringify(logData));
  }

  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl || webhookUrl === "undefined") {
    return false;
  }

  try {
    const isDiscord = webhookUrl.includes("discord.com");
    const isSlack = webhookUrl.includes("hooks.slack.com");

    let body: unknown;

    if (isDiscord) {
      const color = alert.level === "error" ? 0xff0000 : alert.level === "warning" ? 0xffa500 : 0x00ff00;
      body = {
        embeds: [
          {
            title: `🚨 ${alert.title}`,
            description: alert.message,
            color,
            fields: [
              ...(alert.brandName ? [{ name: "Brand", value: alert.brandName, inline: true }] : []),
              ...(alert.postId ? [{ name: "Post ID", value: alert.postId, inline: true }] : []),
              { name: "Time", value: timestamp, inline: true },
            ],
          },
        ],
      };
    } else if (isSlack) {
      body = {
        text: `*${alert.level === "error" ? "🚨 ERROR" : "⚠️ WARNING"}: ${alert.title}*\n${alert.message}`,
        attachments: [
          {
            fields: [
              ...(alert.brandName ? [{ title: "Brand", value: alert.brandName, short: true }] : []),
              ...(alert.postId ? [{ title: "Post ID", value: alert.postId, short: true }] : []),
            ],
          },
        ],
      };
    } else {
      // Generic JSON Webhook
      body = logData;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch (err) {
    console.error("[sendSystemAlert] Webhook delivery failed:", err);
    return false;
  }
}

/**
 * Checks token expiration date and sends an alert if within warning threshold (default: 7 days)
 */
export async function checkTokenExpiryAlert(
  brandName: string,
  tokenExpiry: Date,
  warningDays = 7
): Promise<boolean> {
  const now = new Date();
  const diffMs = tokenExpiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= warningDays) {
    return sendSystemAlert({
      level: diffDays <= 2 ? "error" : "warning",
      title: `Threads Access Token Expiring (${brandName})`,
      message: `Token for brand "${brandName}" expires in ${diffDays} day(s) (${tokenExpiry.toISOString()}). Immediate renewal required.`,
      brandName,
      metadata: { diffDays, tokenExpiry: tokenExpiry.toISOString() },
    });
  }

  return false;
}
