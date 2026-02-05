const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dynamic import for fetch if needed, but Node 18+ has it built-in
// If you're on an older node, we might need a different approach.

const THREADS_API_BASE = "https://graph.threads.net/v1.0";

async function publishPost(text, imageUrls = []) {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    if (!settings) throw new Error("No Threads settings found in DB");

    const userId = settings.userId;
    const accessToken = settings.accessToken;

    let containerId;

    if (imageUrls.length === 0) {
        // Text only
        const params = new URLSearchParams({
            media_type: "TEXT",
            text,
            access_token: accessToken,
        });
        const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(`Threads API Error (Text): ${data.error?.message || "Unknown error"}`);
        containerId = data.id;
    } else {
        // For simplicity in this script, handling single image only or just text
        // (Full carousel logic can be added if needed, but most are text)
        const params = new URLSearchParams({
            media_type: "IMAGE",
            image_url: imageUrls[0],
            text,
            access_token: accessToken,
        });
        const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(`Threads API Error (Image): ${data.error?.message || "Unknown error"}`);
        containerId = data.id;
    }

    // Wait for processing
    await new Promise(r => setTimeout(r, 5000));

    // Publish
    const pubParams = new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken,
    });
    const pubRes = await fetch(`${THREADS_API_BASE}/${userId}/threads_publish?${pubParams}`, { method: "POST" });
    const pubData = await pubRes.json();
    if (!pubRes.ok) throw new Error(`Threads Publish Error: ${pubData.error?.message || "Unknown error"}`);

    return pubData.id;
}

async function main() {
    console.log("Starting standalone publisher...");

    const pendingPosts = await prisma.post.findMany({
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
        take: 3
    });

    if (pendingPosts.length === 0) {
        console.log("No pending posts found.");
        return;
    }

    console.log(`Found ${pendingPosts.length} posts to process.`);

    for (const post of pendingPosts) {
        try {
            console.log(`Publishing post ${post.id}...`);
            const imageUrls = JSON.parse(post.imageUrls || "[]");
            const threadsId = await publishPost(post.content, imageUrls);

            await prisma.post.update({
                where: { id: post.id },
                data: {
                    status: "PUBLISHED",
                    threadsId
                }
            });
            console.log(`Successfully published ${post.id}. Threads ID: ${threadsId}`);

            // Gap between posts
            await new Promise(r => setTimeout(r, 5000));
        } catch (error) {
            console.error(`Failed to publish ${post.id}:`, error.message);
            await prisma.post.update({
                where: { id: post.id },
                data: {
                    status: "FAILED",
                    errorLog: error.message
                }
            });
        }
    }
}

main()
    .catch(e => {
        console.error("Execution error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
