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

/**
 * Cron endpoint for refreshing Threads API access token
 * 
 * This should be called daily by Vercel Cron to check if the token
 * needs refresh before expiry and refresh it if needed.
 * 
 * Security: Requires CRON_SECRET header or query param
 */
export async function GET(request: NextRequest) {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret =
        request.headers.get("authorization")?.replace("Bearer ", "") ||
        request.nextUrl.searchParams.get("secret");

    if (cronSecret && providedSecret !== cronSecret) {
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
            if (isTokenRefreshDue(brand.tokenExpiry, now)) {
                try {
                    const result = await refreshBrandAccessToken(brand.id);
                    refreshResults.push({
                        slug: brand.slug,
                        success: true,
                        newExpiry: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
                    });
                } catch (err) {
                    console.error(`Failed to refresh token for brand ${brand.slug}:`, err);
                    refreshResults.push({
                        slug: brand.slug,
                        success: false,
                        error: err instanceof Error ? err.message : "Unknown error",
                    });
                }
            } else {
                refreshResults.push({
                    slug: brand.slug,
                    success: true,
                    message: "Still valid",
                    daysLeft: Math.ceil((brand.tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                });
            }
        }

        return NextResponse.json({
            success: true,
            refreshWindowDays: TOKEN_REFRESH_WINDOW_DAYS,
            legacyRefreshed: !!legacyRefreshResults,
            legacyRefreshError,
            brandsCount: brands.length,
            refreshResults,
        });
    } catch (error) {
        console.error("Token refresh cron error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
