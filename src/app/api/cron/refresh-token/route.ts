import { NextRequest, NextResponse } from "next/server";
import {
    initializeTokensInDB,
    shouldRefreshToken,
    refreshAccessToken,
    getTokenStatus,
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
        // Initialize tokens in DB if not already done
        await initializeTokensInDB();

        // Check current token status
        const status = await getTokenStatus();

        if (!status.hasToken) {
            return NextResponse.json({
                success: false,
                message: "No token found in database",
            }, { status: 500 });
        }

        // Check if token needs refresh
        const needsRefresh = await shouldRefreshToken();

        if (!needsRefresh) {
            return NextResponse.json({
                success: true,
                message: "Token is still valid",
                daysUntilExpiry: status.daysUntilExpiry,
                expiresAt: status.expiresAt?.toISOString(),
                refreshed: false,
            });
        }

        // Refresh the token
        const result = await refreshAccessToken();

        // Get updated status
        const newStatus = await getTokenStatus();

        return NextResponse.json({
            success: true,
            message: "Token refreshed successfully",
            refreshed: true,
            daysUntilExpiry: newStatus.daysUntilExpiry,
            expiresAt: newStatus.expiresAt?.toISOString(),
            expiresIn: result.expiresIn,
        });
    } catch (error) {
        console.error("Token refresh error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
