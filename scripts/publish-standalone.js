const fs = require('fs');
const path = require('path');

for (const envFile of ['.env.local', '.env']) {
    const envPath = path.resolve(__dirname, '..', envFile);
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx === -1) continue;
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
        }
        break;
    }
}

const { PrismaClient } = require('@prisma/client');
const { refreshTokens } = require('./refresh-token-standalone');
const prisma = new PrismaClient();

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

async function pollContainerStatus(containerId, accessToken, maxAttempts = 8, delayMs = 3000) {
    console.log(`  ⏳ Polling container ${containerId} status...`);
    let finished = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(delayMs);
        try {
            const statusRes = await fetch(`${THREADS_API_BASE}/${containerId}?fields=status,error_message&access_token=${accessToken}`);
            const statusData = await statusRes.json();
            if (statusData.status === "FINISHED") {
                finished = true;
                break;
            }
            if (statusData.status === "ERROR") {
                throw new Error(`Media processing error: ${statusData.error_message || "Unknown error"}`);
            }
        } catch (err) {
            if (err.message.includes("Media processing error")) throw err;
            break;
        }
    }
    if (!finished) {
        await sleep(2000);
    }
}

async function publishPost(text, credentials, imageUrls = []) {
    let containerId;
    const validHttpImageUrls = (imageUrls || []).filter((url) => typeof url === "string" && /^https?:\/\//i.test(url));

    if (validHttpImageUrls.length === 0) {
        // 1. Text only
        const params = new URLSearchParams({
            media_type: "TEXT",
            text,
            access_token: credentials.accessToken,
        });
        const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(`Threads API Error (Text): ${data.error?.message || "Unknown error"}`);
        containerId = data.id;
        await sleep(3000);
    } else if (validHttpImageUrls.length === 1) {
        // 2. Single Image
        const params = new URLSearchParams({
            media_type: "IMAGE",
            image_url: validHttpImageUrls[0],
            text,
            access_token: credentials.accessToken,
        });
        const res = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${params}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(`Threads API Error (Image): ${data.error?.message || "Unknown error"}`);
        containerId = data.id;

        await pollContainerStatus(containerId, credentials.accessToken);
    } else {
        // 3. Carousel (Multiple Images)
        console.log(`  📸 Creating Carousel with ${validHttpImageUrls.length} images...`);
        const childContainerIds = [];

        for (let i = 0; i < validHttpImageUrls.length; i++) {
            const imgUrl = validHttpImageUrls[i];
            const childParams = new URLSearchParams({
                media_type: "IMAGE",
                image_url: imgUrl,
                is_carousel_item: "true",
                access_token: credentials.accessToken,
            });
            const childRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${childParams}`, { method: "POST" });
            const childData = await childRes.json();
            if (!childRes.ok) {
                throw new Error(`Threads API Error (Carousel Item ${i + 1}): ${childData.error?.message || "Unknown error"}`);
            }
            childContainerIds.push(childData.id);
        }

        // Wait for child containers to process
        for (const childId of childContainerIds) {
            await pollContainerStatus(childId, credentials.accessToken);
        }

        // Create parent carousel container
        const carouselParams = new URLSearchParams({
            media_type: "CAROUSEL",
            children: childContainerIds.join(","),
            text,
            access_token: credentials.accessToken,
        });
        const carouselRes = await fetch(`${THREADS_API_BASE}/${credentials.userId}/threads?${carouselParams}`, { method: "POST" });
        const carouselData = await carouselRes.json();
        if (!carouselRes.ok) {
            throw new Error(`Threads API Error (Carousel Parent): ${carouselData.error?.message || "Unknown error"}`);
        }
        containerId = carouselData.id;

        await pollContainerStatus(containerId, credentials.accessToken);
    }

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
    console.log("Starting standalone publisher with brand isolation & circuit breaker...");

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

        let brandConfig = {};
        try {
            brandConfig = JSON.parse(brand.brandConfig || "{}");
        } catch (_) {
            brandConfig = {};
        }

        // Circuit breaker check
        if (brandConfig.circuitBreaker?.pausedUntil) {
            const pauseExpiresAt = new Date(brandConfig.circuitBreaker.pausedUntil);
            if (pauseExpiresAt.getTime() > Date.now()) {
                console.log(`  ⏸️ Skipping ${brand.slug}: Circuit breaker active until ${brandConfig.circuitBreaker.pausedUntil} (Reason: ${brandConfig.circuitBreaker.lastFailureReason || "Unknown"}).`);
                continue;
            }
        }

        if (!brand.accessToken || !brand.threadsUserId) {
            console.log(`  ⚠️ Skipping ${brand.slug}: Missing Threads credentials (accessToken or threadsUserId).`);
            continue;
        }

        // 24-hour rate limit check (Threads allows max 250 posts/24h per user)
        const publishedLast24h = await prisma.post.count({
            where: {
                brandId: brand.id,
                status: "PUBLISHED",
                publishedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });
        if (publishedLast24h >= 240) {
            console.warn(`  ⚠️ Skipping ${brand.slug}: Reached 24h safety limit (${publishedLast24h}/250 posts).`);
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
            let imageUrls = [];
            try {
                imageUrls = JSON.parse(post.imageUrls || "[]");
            } catch {
                imageUrls = [];
            }
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

            // Reset circuit breaker on success
            brandConfig.circuitBreaker = {
                consecutiveFailures: 0,
                pausedUntil: null,
                lastFailureReason: null
            };
            await prisma.brand.update({
                where: { id: brand.id },
                data: { brandConfig: JSON.stringify(brandConfig) }
            });

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

            // Update circuit breaker
            const currentFailures = (brandConfig.circuitBreaker?.consecutiveFailures || 0) + 1;
            const pausedUntil = currentFailures >= 3
                ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
                : null;
            brandConfig.circuitBreaker = {
                consecutiveFailures: currentFailures,
                pausedUntil,
                lastFailureReason: error.message
            };
            if (pausedUntil) {
                console.error(`  🚨 Circuit breaker tripped for ${brand.slug}: 3 consecutive failures. Paused for 1 hour.`);
            }
            await prisma.brand.update({
                where: { id: brand.id },
                data: { brandConfig: JSON.stringify(brandConfig) }
            });
        }
    }
}

if (require.main === module) {
    main()
        .catch(e => {
            console.error("Execution error:", e);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}

module.exports = {
    pollContainerStatus,
    publishPost,
    publishReply,
    publishReplyWithRetry,
    splitIntoThreadParts,
    main,
};
