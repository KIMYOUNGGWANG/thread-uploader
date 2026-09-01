const { PrismaClient } = require('@prisma/client');
const { refreshTokens } = require('./refresh-token-standalone');
const prisma = new PrismaClient();

// Dynamic import for fetch if needed, but Node 18+ has it built-in
// If you're on an older node, we might need a different approach.

const THREADS_API_BASE = "https://graph.threads.net/v1.0";
const FIRST_COMMENT_FAILURE_PREFIX = "First comment failed:";
const DEFAULT_PUBLISH_BRAND_SLUGS = "cosmicpath,cosmicpath-global";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPublishBrandSlugs() {
    const rawSlugs = process.env.PUBLISH_BRAND_SLUGS || DEFAULT_PUBLISH_BRAND_SLUGS;
    if (rawSlugs.trim() === "*" || rawSlugs.trim().toLowerCase() === "all") {
        return [];
    }
    return rawSlugs
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean);
}

async function publishPost(text, credentials, imageUrls = []) {
    let containerId;

    if (imageUrls.length === 0) {
        // Text only
        const params = new URLSearchParams({
            media_type: "TEXT",
            text,
            access_token: credentials.accessToken,
        });
        const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, { method: "POST" });
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
            access_token: credentials.accessToken,
        });
        const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(`Threads API Error (Image): ${data.error?.message || "Unknown error"}`);
        containerId = data.id;
    }

    // Wait for processing
    await sleep(5000);

    // Publish
    const pubParams = new URLSearchParams({
        creation_id: containerId,
        access_token: credentials.accessToken,
    });
    const pubRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads_publish?${pubParams}`, { method: "POST" });
    const pubData = await pubRes.json();
    if (!pubRes.ok) throw new Error(`Threads Publish Error: ${pubData.error?.message || "Unknown error"}`);

    return pubData.id;
}

async function publishReply(text, replyToId, credentials) {
    const params = new URLSearchParams({
        media_type: "TEXT",
        text,
        reply_to_id: replyToId,
        access_token: credentials.accessToken,
    });

    const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, {
        method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Threads API Error (Reply): ${data.error?.message || "Unknown error"}`);
    }

    await sleep(2000);

    const pubParams = new URLSearchParams({
        creation_id: data.id,
        access_token: credentials.accessToken,
    });
    const pubRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads_publish?${pubParams}`, {
        method: "POST",
    });
    const pubData = await pubRes.json();
    if (!pubRes.ok) {
        throw new Error(`Threads Publish Error (Reply): ${pubData.error?.message || "Unknown error"}`);
    }

    return pubData.id;
}

async function publishReplyWithRetry(text, replyToId, credentials, retries = 4, initialDelayMs = 4000) {
    let lastError = null;

    await sleep(initialDelayMs);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await publishReply(text, replyToId, credentials);
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;

            const retryDelayMs = 3000 * attempt;
            console.warn(
                `Reply publish failed for ${replyToId} (attempt ${attempt}/${retries}). Retrying in ${retryDelayMs}ms...`
            );
            await sleep(retryDelayMs);
        }
    }

    throw lastError || new Error("Failed to publish first comment");
}

function splitIntoThreadParts(text, maxLength = 480, maxParts = 5) {
    const trimmed = text.trim();
    if (trimmed.length <= 500) return [trimmed];

    const paragraphs = trimmed.split(/\n\s*\n/);
    const chunks = [];
    for (const p of paragraphs) {
        const tp = p.trim();
        if (tp) chunks.push(tp);
    }

    for (let targetParts = 2; targetParts <= maxParts; targetParts++) {
        const parts = [];
        let chunkIndex = 0;

        for (let p = 0; p < targetParts; p++) {
            const prefix = `${p + 1}/${targetParts}\n\n`;
            const available = maxLength - prefix.length;
            let partBody = "";

            while (chunkIndex < chunks.length) {
                const nextChunk = chunks[chunkIndex];
                const sep = partBody.length > 0 ? "\n\n" : "";
                if (partBody.length + sep.length + nextChunk.length <= available) {
                    partBody = partBody ? `${partBody}\n\n${nextChunk}` : nextChunk;
                    chunkIndex++;
                } else {
                    break;
                }
            }
            if (!partBody && chunkIndex < chunks.length) {
                partBody = chunks[chunkIndex].slice(0, available);
                chunks[chunkIndex] = chunks[chunkIndex].slice(available).trim();
            }
            parts.push(`${prefix}${partBody}`);
        }
        if (chunkIndex >= chunks.length) return parts;
    }

    return [trimmed.slice(0, 500)];
}

async function main() {
    console.log("Starting standalone publisher...");

    await refreshTokens({ prismaClient: prisma });

    const publishBrandSlugs = getPublishBrandSlugs();
    const brandFilter = publishBrandSlugs.length > 0
        ? { slug: { in: publishBrandSlugs } }
        : {};

    const targetBrands = await prisma.brand.findMany({
        where: brandFilter,
        orderBy: { slug: "asc" }
    });

    if (targetBrands.length === 0) {
        console.log("No matching brands found for slugs:", publishBrandSlugs);
        return;
    }

    console.log(`Processing ${targetBrands.length} brands: ${targetBrands.map(b => b.slug).join(", ")}`);

    for (const brand of targetBrands) {
        console.log(`\n▶ [Brand: ${brand.name} (${brand.slug})]`);

        if (!brand.accessToken || !brand.threadsUserId) {
            console.log(`  ⚠️ Skipping ${brand.slug}: Missing Threads credentials (accessToken or threadsUserId).`);
            continue;
        }

        const post = await prisma.post.findFirst({
            where: {
                brandId: brand.id,
                status: "PENDING",
                OR: [
                    { qualityPass: true },
                    { qualityPass: null },
                ],
            },
            orderBy: { scheduledAt: "asc" },
        });

        if (!post) {
            const blockedCount = await prisma.post.count({
                where: { brandId: brand.id, status: "PENDING", qualityPass: false },
            });
            if (blockedCount > 0) {
                console.log(`  ℹ️ No publishable posts for ${brand.slug}. (${blockedCount} quality-failed posts are blocked)`);
            } else {
                console.log(`  ℹ️ No pending posts found for ${brand.slug}.`);
            }
            continue;
        }

        try {
            console.log(`  🚀 Publishing post ${post.id} for ${brand.slug}...`);
            const credentials = {
                accessToken: brand.accessToken,
                userId: brand.threadsUserId,
            };
            const imageUrls = JSON.parse(post.imageUrls || "[]");
            const parts = splitIntoThreadParts(post.content);
            const threadsId = await publishPost(parts[0], credentials, imageUrls);

            for (let p = 1; p < parts.length; p++) {
                await sleep(3000);
                try {
                    await publishReplyWithRetry(parts[p], threadsId, credentials);
                } catch (partErr) {
                    console.error(`  ❌ Failed to publish thread part ${p + 1}/${parts.length} for ${post.id}:`, partErr);
                }
            }

            let replyErrorMessage = null;
            if (post.firstComment?.trim()) {
                let commentText = post.firstComment.trim();
                if (commentText.length > 500) {
                    console.warn(`  ⚠️ First comment exceeded 500 chars (${commentText.length}). Auto-trimming to 500 chars.`);
                    commentText = commentText.slice(0, 500);
                }
                try {
                    const replyId = await publishReplyWithRetry(commentText, threadsId, credentials);
                    console.log(`  💬 First comment published for ${post.id}. Reply ID: ${replyId}`);
                } catch (replyError) {
                    replyErrorMessage =
                        replyError instanceof Error
                            ? replyError.message
                            : "Failed to publish first comment";
                    console.error(`  ⚠️ Failed to publish first comment for ${post.id}:`, replyErrorMessage);
                }
            }

            await prisma.post.update({
                where: { id: post.id },
                data: {
                    status: "PUBLISHED",
                    threadsId,
                    publishedAt: new Date(),
                    errorLog: replyErrorMessage
                        ? `${FIRST_COMMENT_FAILURE_PREFIX} ${replyErrorMessage}`
                        : null
                }
            });
            console.log(`  ✅ Successfully published ${post.id} (${brand.slug}). Threads ID: ${threadsId}`);

            // Gap between brands to avoid rate limiting
            await sleep(4000);
        } catch (error) {
            console.error(`  ❌ Failed to publish ${post.id} for ${brand.slug}:`, error.message);
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
