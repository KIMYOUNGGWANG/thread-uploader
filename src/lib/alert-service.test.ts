import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendSystemAlert, checkTokenExpiryAlert } from "./alert-service";

describe("alert-service", () => {
  const originalEnv = process.env.ALERT_WEBHOOK_URL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.ALERT_WEBHOOK_URL = originalEnv;
  });

  it("logs structured alerts and returns false when ALERT_WEBHOOK_URL is not set", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const delivered = await sendSystemAlert({
      level: "error",
      title: "Publish Failed",
      message: "Threads API timeout",
      brandName: "CosmicPath",
      postId: "post-123",
    });

    expect(delivered).toBe(false);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("sends formatted webhook payload when ALERT_WEBHOOK_URL is configured", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://discord.com/api/webhooks/1234/test";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
    } as unknown as Response);

    const delivered = await sendSystemAlert({
      level: "warning",
      title: "Token Expiring Soon",
      message: "Token expires in 3 days",
      brandName: "CosmicPath Global",
    });

    expect(delivered).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/1234/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    fetchSpy.mockRestore();
  });

  it("triggers warning or error alert when token expires within threshold", async () => {
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const expirySoon = new Date();
    expirySoon.setDate(expirySoon.getDate() + 3); // 3 days remaining

    const alerted = await checkTokenExpiryAlert("CosmicPath", expirySoon, 7);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
