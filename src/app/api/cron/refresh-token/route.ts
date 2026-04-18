import { NextRequest, NextResponse } from "next/server";
import {
    initializeTokensInDB,
    shouldRefreshToken,
    refreshAccessToken,
    getTokenStatus,
    refreshBrandAccessToken,
} from "@/lib/threads-api";

/**
 * Cron endpoint for refreshing Threads API access token
 * 
 * This should be called daily by Vercel Cron to check if the token
 * needs refresh (within 7 days of expiry) and refresh it if needed.
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
        await initializeTokensInDB();
        const status = await getTokenStatus();
        let legacyRefreshResults = null;

        if (status.hasToken && await shouldRefreshToken()) {
            legacyRefreshResults = await refreshAccessToken();
        }

        // 2. Multi-brand refresh
        const brands = await prisma.brand.findMany();
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        const refreshResults = [];
        for (const brand of brands) {
            if (brand.tokenExpiry <= sevenDaysFromNow) {
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
            legacyRefreshed: !!legacyRefreshResults,
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
