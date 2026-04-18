/**
 * Threads API Client
 * Uses the official Threads Publishing API (Meta)
 * 
 * Flow for publishing:
 * 1. Create a media container (POST /{user-id}/threads)
 * 2. Publish the container (POST /{user-id}/threads_publish)
 * 
 * For images/carousels:
 * 1. Create item containers for each image
 * 2. Create a carousel container referencing the items
 * 3. Publish the carousel container
 */

const THREADS_API_BASE = "https://graph.threads.net/v1.0";

interface ThreadsContainerResponse {
    id: string;
}

interface ThreadsPublishResponse {
    id: string;
}

interface ThreadsError {
    error: {
        message: string;
        type: string;
        code: number;
    };
}

interface TokenRefreshResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize tokens in DB from environment variables
 * Called on first run or when DB is empty
 */
export async function initializeTokensInDB(): Promise<void> {
    const { prisma } = await import("@/lib/prisma");

    const existing = await prisma.settings.findUnique({
        where: { id: "default" },
    });

    if (!existing) {
        const accessToken = process.env.THREADS_ACCESS_TOKEN;
        const userId = process.env.THREADS_USER_ID;

        if (!accessToken || !userId) {
            throw new Error("THREADS_ACCESS_TOKEN and THREADS_USER_ID must be set in environment variables");
        }

        // Set expiry to 60 days from now (default for new long-lived tokens)
        const tokenExpiry = new Date();
        tokenExpiry.setDate(tokenExpiry.getDate() + 60);

        await prisma.settings.create({
            data: {
                id: "default",
                accessToken,
                userId,
                tokenExpiry,
            },
        });

        console.log("Tokens initialized in database");
    }
}

/**
 * Get access token from DB (with fallback to env vars)
 */
async function getAccessToken(): Promise<string> {
    const { prisma } = await import("@/lib/prisma");

    const settings = await prisma.settings.findUnique({
        where: { id: "default" },
    });

    if (settings?.accessToken) {
        return settings.accessToken;
    }

    // Fallback to environment variable
    const token = process.env.THREADS_ACCESS_TOKEN;
    if (!token) {
        throw new Error("THREADS_ACCESS_TOKEN is not configured");
    }
    return token;
}

/**
 * Get user ID from DB (with fallback to env vars)
 */
async function getUserId(): Promise<string> {
    const { prisma } = await import("@/lib/prisma");

    const settings = await prisma.settings.findUnique({
        where: { id: "default" },
    });

    if (settings?.userId) {
        return settings.userId;
    }

    // Fallback to environment variable
    const userId = process.env.THREADS_USER_ID;
    if (!userId) {
        throw new Error("THREADS_USER_ID is not configured");
    }
    return userId;
}

/**
 * Check if token needs refresh (expires within 7 days)
 */
export async function shouldRefreshToken(): Promise<boolean> {
    const { prisma } = await import("@/lib/prisma");

    const settings = await prisma.settings.findUnique({
        where: { id: "default" },
    });

    if (!settings) {
        return false;
    }

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    return settings.tokenExpiry <= sevenDaysFromNow;
}

/**
 * Get token status information
 */
export async function getTokenStatus(): Promise<{
    hasToken: boolean;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
}> {
    const { prisma } = await import("@/lib/prisma");

    const settings = await prisma.settings.findUnique({
        where: { id: "default" },
    });

    if (!settings) {
        return { hasToken: false, expiresAt: null, daysUntilExpiry: null };
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
        (settings.tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
        hasToken: true,
        expiresAt: settings.tokenExpiry,
        daysUntilExpiry,
    };
}

/**
 * Refresh the long-lived access token
 * Returns new token info and updates the database
 */
export async function refreshAccessToken(): Promise<{
    accessToken: string;
    expiresIn: number;
}> {
    const { prisma } = await import("@/lib/prisma");

    const settings = await prisma.settings.findUnique({
        where: { id: "default" },
    });

    if (!settings) {
        throw new Error("No token found in database. Initialize tokens first.");
    }

    const response = await fetch(
        `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${settings.accessToken}`
    );

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`Token refresh failed: ${errorData.error?.message || "Unknown error"}`);
    }

    const tokenData = data as TokenRefreshResponse;

    // Calculate new expiry date
    const tokenExpiry = new Date();
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + tokenData.expires_in);

    // Update database
    await prisma.settings.update({
        where: { id: "default" },
        data: {
            accessToken: tokenData.access_token,
            tokenExpiry,
        },
    });

    console.log(`Token refreshed successfully. New expiry: ${tokenExpiry.toISOString()}`);

    return {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
    };
}

/**
 * Refresh the long-lived access token for a specific Brand
 */
export async function refreshBrandAccessToken(brandId: string): Promise<{
    accessToken: string;
    expiresIn: number;
}> {
    const { prisma } = await import("@/lib/prisma");

    const brand = await prisma.brand.findUnique({
        where: { id: brandId },
    });

    if (!brand) {
        throw new Error(`Brand not found: ${brandId}`);
    }

    const response = await fetch(
        `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${brand.accessToken}`
    );

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`[Brand ${brand.slug}] Token refresh failed: ${errorData.error?.message || "Unknown error"}`);
    }

    const tokenData = data as TokenRefreshResponse;

    // Calculate new expiry date
    const tokenExpiry = new Date();
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + tokenData.expires_in);

    // Update database
    await prisma.brand.update({
        where: { id: brandId },
        data: {
            accessToken: tokenData.access_token,
            tokenExpiry,
        },
    });

    console.log(`[Brand ${brand.slug}] Token refreshed successfully. New expiry: ${tokenExpiry.toISOString()}`);

    return {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
    };
}

/**
 * Create a text-only thread container
 */
export async function createTextContainer(text: string): Promise<string> {
    const accessToken = await getAccessToken();
    const userId = await getUserId();
    const topicTag = process.env.THREADS_DEFAULT_TOPIC;

    const params = new URLSearchParams({
        media_type: "TEXT",
        text,
        access_token: accessToken,
    });

    // Add topic tag if configured
    if (topicTag) {
        params.append("topic_tag", topicTag);
    }

    const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`[Container Creation Failed] ${errorData.error?.message || "Unknown error"}`);
    }

    return (data as ThreadsContainerResponse).id;
}

/**
 * Create a single image thread container
 */
export async function createImageContainer(text: string, imageUrl: string): Promise<string> {
    const accessToken = await getAccessToken();
    const userId = await getUserId();
    const topicTag = process.env.THREADS_DEFAULT_TOPIC;

    const params = new URLSearchParams({
        media_type: "IMAGE",
        image_url: imageUrl,
        text,
        access_token: accessToken,
    });

    // Add topic tag if configured
    if (topicTag) {
        params.append("topic_tag", topicTag);
    }

    const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`Threads API Error: ${errorData.error?.message || "Unknown error"}`);
    }

    return (data as ThreadsContainerResponse).id;
}

/**
 * Create a carousel item container (for multi-image posts)
 */
async function createCarouselItemContainer(imageUrl: string): Promise<string> {
    const accessToken = await getAccessToken();
    const userId = await getUserId();

    const params = new URLSearchParams({
        media_type: "IMAGE",
        image_url: imageUrl,
        is_carousel_item: "true",
        access_token: accessToken,
    });

    const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`Threads API Error: ${errorData.error?.message || "Unknown error"}`);
    }

    return (data as ThreadsContainerResponse).id;
}

/**
 * Create a carousel container with multiple images
 */
export async function createCarouselContainer(
    text: string,
    imageUrls: string[]
): Promise<string> {
    // First, create container for each image
    const itemIds: string[] = [];
    for (const imageUrl of imageUrls) {
        const itemId = await createCarouselItemContainer(imageUrl);
        itemIds.push(itemId);
        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const accessToken = await getAccessToken();
    const userId = await getUserId();
    const topicTag = process.env.THREADS_DEFAULT_TOPIC;

    const params = new URLSearchParams({
        media_type: "CAROUSEL",
        children: itemIds.join(","),
        text,
        access_token: accessToken,
    });

    // Add topic tag if configured
    if (topicTag) {
        params.append("topic_tag", topicTag);
    }

    const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`Threads API Error: ${errorData.error?.message || "Unknown error"}`);
    }

    return (data as ThreadsContainerResponse).id;
}

/**
 * Publish a thread container
 */
export async function publishContainer(creationId: string): Promise<string> {
    const accessToken = await getAccessToken();
    const userId = await getUserId();

    const params = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
    });

    const response = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish?${params}`, {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`Threads API Error: ${errorData.error?.message || "Unknown error"}`);
    }

    return (data as ThreadsPublishResponse).id;
}

export interface ThreadsCredentials {
    accessToken: string;
    userId: string;
}

/**
 * Publish a post using explicit brand credentials
 */
export async function publishPostWithCredentials(
    text: string,
    credentials: ThreadsCredentials,
    imageUrls: string[] = []
): Promise<string> {
    const { accessToken, userId } = credentials;
    const topicTag = process.env.THREADS_DEFAULT_TOPIC;
    let containerId: string;

    if (imageUrls.length === 0) {
        const params = new URLSearchParams({ media_type: "TEXT", text, access_token: accessToken });
        if (topicTag) params.append("topic_tag", topicTag);
        const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, { method: "POST" });
        const data = await res.json() as ThreadsContainerResponse | ThreadsError;
        if (!res.ok) throw new Error(`[Container] ${ (data as ThreadsError).error?.message }`);
        containerId = (data as ThreadsContainerResponse).id;
    } else if (imageUrls.length === 1) {
        const params = new URLSearchParams({ media_type: "IMAGE", image_url: imageUrls[0], text, access_token: accessToken });
        if (topicTag) params.append("topic_tag", topicTag);
        const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, { method: "POST" });
        const data = await res.json() as ThreadsContainerResponse | ThreadsError;
        if (!res.ok) throw new Error(`[Container] ${ (data as ThreadsError).error?.message }`);
        containerId = (data as ThreadsContainerResponse).id;
    } else {
        const itemIds: string[] = [];
        for (const imageUrl of imageUrls) {
            const params = new URLSearchParams({ media_type: "IMAGE", image_url: imageUrl, is_carousel_item: "true", access_token: accessToken });
            const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, { method: "POST" });
            const data = await res.json() as ThreadsContainerResponse | ThreadsError;
            if (!res.ok) throw new Error(`[CarouselItem] ${ (data as ThreadsError).error?.message }`);
            itemIds.push((data as ThreadsContainerResponse).id);
            await sleep(1000);
        }
        const params = new URLSearchParams({ media_type: "CAROUSEL", children: itemIds.join(","), text, access_token: accessToken });
        if (topicTag) params.append("topic_tag", topicTag);
        const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, { method: "POST" });
        const data = await res.json() as ThreadsContainerResponse | ThreadsError;
        if (!res.ok) throw new Error(`[Carousel] ${ (data as ThreadsError).error?.message }`);
        containerId = (data as ThreadsContainerResponse).id;
    }

    await sleep(2000);

    const publishParams = new URLSearchParams({ creation_id: containerId, access_token: accessToken });
    const publishRes = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish?${publishParams}`, { method: "POST" });
    const publishData = await publishRes.json() as ThreadsPublishResponse | ThreadsError;
    if (!publishRes.ok) throw new Error(`[Publish] ${ (publishData as ThreadsError).error?.message }`);
    return (publishData as ThreadsPublishResponse).id;
}

export async function publishReplyWithRetryForBrand(
    text: string,
    replyToId: string,
    credentials: ThreadsCredentials,
    retries = 4,
    initialDelayMs = 4000
): Promise<string> {
    const { accessToken, userId } = credentials;
    await sleep(initialDelayMs);
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const containerParams = new URLSearchParams({ media_type: "TEXT", text, reply_to_id: replyToId, access_token: accessToken });
            const containerRes = await fetch(`${THREADS_API_BASE}/${userId}/threads?${containerParams}`, { method: "POST" });
            const containerData = await containerRes.json() as ThreadsContainerResponse | ThreadsError;
            if (!containerRes.ok) throw new Error(`[ReplyContainer] ${ (containerData as ThreadsError).error?.message }`);
            const containerId = (containerData as ThreadsContainerResponse).id;

            await sleep(2000);

            const publishParams = new URLSearchParams({ creation_id: containerId, access_token: accessToken });
            const publishRes = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish?${publishParams}`, { method: "POST" });
            const publishData = await publishRes.json() as ThreadsPublishResponse | ThreadsError;
            if (!publishRes.ok) throw new Error(`[ReplyPublish] ${ (publishData as ThreadsError).error?.message }`);
            return (publishData as ThreadsPublishResponse).id;
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                console.warn(`Reply attempt ${attempt}/${retries} failed. Retrying...`, error);
                await sleep(3000 * attempt);
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to publish reply");
}

/**
 * High-level function to publish a complete post
 */
export async function publishPost(
    text: string,
    imageUrls: string[] = []
): Promise<string> {
    let containerId: string;

    if (imageUrls.length === 0) {
        // Text-only post
        containerId = await createTextContainer(text);
    } else if (imageUrls.length === 1) {
        // Single image post
        containerId = await createImageContainer(text, imageUrls[0]);
    } else {
        // Carousel post
        containerId = await createCarouselContainer(text, imageUrls);
    }

    // Wait a moment for media processing
    await sleep(2000);

    // Publish the container
    const postId = await publishContainer(containerId);
    return postId;
}

/**
 * Publish a reply to an existing thread
 */
export async function publishReply(
    text: string,
    replyToId: string
): Promise<string> {
    const accessToken = await getAccessToken();
    const userId = await getUserId();

    const params = new URLSearchParams({
        media_type: "TEXT",
        text,
        reply_to_id: replyToId,
        access_token: accessToken,
    });

    const response = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
        const errorData = data as ThreadsError;
        throw new Error(`Threads API Error (reply): ${errorData.error?.message || "Unknown error"}`);
    }

    const containerId = (data as ThreadsContainerResponse).id;

    // Wait a moment for container to be ready
    await sleep(2000);

    // Publish the container
    return await publishContainer(containerId);
}

export async function publishReplyWithRetry(
    text: string,
    replyToId: string,
    retries = 4,
    initialDelayMs = 4000
): Promise<string> {
    let lastError: unknown;

    await sleep(initialDelayMs);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await publishReply(text, replyToId);
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;

            const retryDelayMs = 3000 * attempt;
            console.warn(
                `Reply publish failed (attempt ${attempt}/${retries}). Retrying in ${retryDelayMs}ms...`,
                error
            );
            await sleep(retryDelayMs);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error("Failed to publish first comment");
}
