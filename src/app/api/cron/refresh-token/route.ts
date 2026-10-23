import { NextRequest, NextResponse } from "next/server";
import {
    initializeTokensInDB,
    isTokenRefreshDue,
    shouldRefreshToken,
    refreshAccessToken,
    getTokenStatus,
    refreshBrandAccessToken,
    TOKEN_REFRESH_WINDOW_DAYS,
} from "@/lib/threads-api";
import { verifyCronSecret } from "@/lib/cron-auth";
import { checkTokenExpiryAlert, sendSystemAlert } from "@/lib/alert-service";
import { refreshBrandInstagramToken } from "@/lib/instagram-api";

const DAY_MS = 24 * 60 * 60 * 1000;

type InstagramBrand = {
    id: string;
    slug: string;
    name: string;
    instagramAccessToken: string | null;
    instagramTokenExpiry: Date | null;
};

type InstagramRefreshResult = {
    slug: string;
    success: boolean;
    instagramNeedsReconnect?: boolean;
    error?: string;
    message?: string;
    newExpiry?: string;
};

async function refreshInstagramTokens(brands: InstagramBrand[], now: Date): Promise<InstagramRefreshResult[]> {
    const results: InstagramRefreshResult[] = [];
    for (const brand of brands) {
        if (!brand.instagramAccessToken || !brand.instagramTokenExpiry) continue;
        results.push(await refreshInstagramBrand(brand, brand.instagramTokenExpiry, now));
    }
    return results;
}

async function refreshInstagramBrand(brand: InstagramBrand, expiry: Date, now: Date): Promise<InstagramRefreshResult> {
    // An expired Instagram token cannot be refreshed; only an OAuth reconnect fixes it.
    if (expiry <= now) {
        await alertIfJustExpired(brand, expiry, now);
        return { slug: brand.slug, success: false, instagramNeedsReconnect: true, error: "Token expired; reconnect Instagram via OAuth" };
    }
    if (!isTokenRefreshDue(expiry, now)) return { slug: brand.slug, success: true, message: "Still valid" };

    try {
        const result = await refreshBrandInstagramToken(brand.id);
        return { slug: brand.slug, success: true, newExpiry: new Date(Date.now() + result.expiresIn * 1000).toISOString() };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to refresh Instagram token for brand ${brand.slug}:`, err);
        await sendSystemAlert({
            level: "error",
            title: `Instagram Token Refresh Failed (${brand.name})`,
            message: `Failed to refresh Instagram token for brand "${brand.name}": ${errorMsg}`,
            brandName: brand.name,
        });
        return { slug: brand.slug, success: false, error: errorMsg };
    }
}

// The cron runs daily, so a token that expired in the last 24h is the first time we see it: alert once.
async function alertIfJustExpired(brand: InstagramBrand, expiry: Date, now: Date): Promise<void> {
    if (now.getTime() - expiry.getTime() > DAY_MS) return;
    await sendSystemAlert({
        level: "error",
        title: `Instagram Token Expired (${brand.name})`,
        message: `The Instagram token for brand "${brand.name}" has expired. Reconnect Instagram via OAuth.`,
        brandName: brand.name,
    });
}

/**
 * Cron endpoint for refreshing Threads API access token
 * 
 * This should be called daily by Vercel Cron to check if the token
 * needs refresh before expiry and refresh it if needed.
 * 
 * Security: Requires CRON_SECRET header or query param
 */
export async function GET(request: NextRequest) {
    if (!verifyCronSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { prisma } = await import("@/lib/prisma");

        // 1. Legacy Settings refresh (fallback)
        let legacyRefreshResults = null;
        let legacyRefreshError = null;

        try {
            await initializeTokensInDB();
            const status = await getTokenStatus();

            if (status.hasToken && await shouldRefreshToken()) {
                legacyRefreshResults = await refreshAccessToken();
            }
        } catch (err) {
            legacyRefreshError = err instanceof Error ? err.message : "Unknown error";
            console.warn("Legacy token refresh skipped:", err);
        }

        // 2. Multi-brand refresh
        const brands = await prisma.brand.findMany();
        const now = new Date();

        const refreshResults = [];
        for (const brand of brands) {
            if (!brand.tokenExpiry || !brand.accessToken) {
                refreshResults.push({
                    slug: brand.slug,
                    success: true,
                    message: "No Threads token or expiry to refresh",
                });
                continue;
            }

            // An expired Threads token cannot be refreshed; only an OAuth reconnect fixes it, so don't fail the run daily.
            if (brand.tokenExpiry <= now) {
                refreshResults.push({
                    slug: brand.slug,
                    success: false,
                    needsReconnect: true,
                    error: "Token expired; reconnect Threads via OAuth",
                });
                continue;
            }

            if (isTokenRefreshDue(brand.tokenExpiry, now)) {
                try {
                    const result = await refreshBrandAccessToken(brand.id);
                    refreshResults.push({
                        slug: brand.slug,
                        success: true,
                        newExpiry: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
                    });
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : "Unknown error";
                    console.error(`Failed to refresh token for brand ${brand.slug}:`, err);
                    refreshResults.push({
                        slug: brand.slug,
                        success: false,
                        error: errorMsg,
                    });
                    await sendSystemAlert({
                        level: "error",
                        title: `Token Refresh Failed (${brand.name})`,
                        message: `Failed to refresh token for brand "${brand.name}": ${errorMsg}`,
                        brandName: brand.name,
                    });
                }
            } else {
                await checkTokenExpiryAlert(brand.name, brand.tokenExpiry, 7);
                refreshResults.push({
                    slug: brand.slug,
                    success: true,
                    message: "Still valid",
                    daysLeft: Math.ceil((brand.tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                });
            }
        }

        // 3. Instagram refresh (same structure as Threads)
        const instagramRefreshResults = await refreshInstagramTokens(brands, now);

        // ALERT_WEBHOOK_URL is unset in production, so a 500 (red GitHub Actions run + email) is the alert that reaches someone.
        const refreshFailed = refreshResults.some((result) => !result.success && !("needsReconnect" in result))
            || instagramRefreshResults.some((result) => !result.success && !result.instagramNeedsReconnect);
        return NextResponse.json({
            success: !refreshFailed,
            refreshWindowDays: TOKEN_REFRESH_WINDOW_DAYS,
            legacyRefreshed: !!legacyRefreshResults,
            legacyRefreshError,
            brandsCount: brands.length,
            refreshResults,
            instagramRefreshResults,
        }, { status: refreshFailed ? 500 : 200 });
    } catch (error) {
        console.error("Token refresh cron error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
