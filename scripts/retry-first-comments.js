const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const THREADS_API_BASE = "https://graph.threads.net/v1.0";
const FAILURE_PREFIX = "First comment failed:";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
    const options = {
        dryRun: false,
        limit: 20,
        postId: null,
    };

    for (const arg of argv) {
        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }

        if (arg.startsWith("--limit=")) {
            const value = Number(arg.split("=")[1]);
            if (!Number.isInteger(value) || value < 1) {
                throw new Error("--limit must be a positive integer");
            }
            options.limit = value;
            continue;
        }

        if (arg.startsWith("--post-id=")) {
            const value = arg.split("=")[1]?.trim();
            if (!value) {
                throw new Error("--post-id requires a value");
            }
            options.postId = value;
            continue;
        }

        if (arg === "--help") {
            printHelp();
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

function printHelp() {
    console.log(`
Usage:
  node scripts/retry-first-comments.js [--dry-run] [--limit=20]
  node scripts/retry-first-comments.js --post-id=<postId> [--dry-run]

Behavior:
  - 기본값: errorLog 에 "First comment failed:" 가 남아 있는 PUBLISHED 글만 재시도
  - --post-id: 특정 글 하나를 강제로 재시도
  - --dry-run: 실제 댓글 발행 없이 대상만 출력
`);
}

async function getSettings() {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    if (!settings) {
        throw new Error("No Threads settings found in DB");
    }
    return settings;
}

async function publishContainer(creationId, settings) {
    const params = new URLSearchParams({
        creation_id: creationId,
        access_token: settings.accessToken,
    });

    const response = await fetch(
        `${THREADS_API_BASE}/${settings.userId}/threads_publish?${params}`,
        { method: "POST" }
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`Threads Publish Error: ${data.error?.message || "Unknown error"}`);
    }

    return data.id;
}

async function publishReply(text, replyToId, settings) {
    const params = new URLSearchParams({
        media_type: "TEXT",
        text,
        reply_to_id: replyToId,
        access_token: settings.accessToken,
    });

    const response = await fetch(
        `${THREADS_API_BASE}/${settings.userId}/threads?${params}`,
        { method: "POST" }
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`Threads Reply Error: ${data.error?.message || "Unknown error"}`);
    }

    await sleep(2000);
    return publishContainer(data.id, settings);
}

async function publishReplyWithRetry(text, replyToId, settings, retries = 4) {
    let lastError = null;

    await sleep(4000);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await publishReply(text, replyToId, settings);
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

async function loadTargets({ postId, limit }) {
    if (postId) {
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            throw new Error(`Post not found: ${postId}`);
        }
        return [post];
    }

    return prisma.post.findMany({
        where: {
            status: "PUBLISHED",
            threadsId: { not: null },
            firstComment: { not: null },
            errorLog: { startsWith: FAILURE_PREFIX },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const settings = await getSettings();
    const targets = await loadTargets(options);

    if (targets.length === 0) {
        console.log("No first-comment recovery targets found.");
        return;
    }

    console.log(`Found ${targets.length} post(s) to recover.`);

    for (const post of targets) {
        if (!post.threadsId || !post.firstComment) {
            console.log(`Skipping ${post.id}: missing threadsId or firstComment`);
            continue;
        }

        console.log(`\n[${post.id}]`);
        console.log(`threadsId: ${post.threadsId}`);
        console.log(`comment preview: ${post.firstComment.slice(0, 80)}`);

        if (options.dryRun) {
            continue;
        }

        try {
            const replyId = await publishReplyWithRetry(post.firstComment, post.threadsId, settings);

            await prisma.post.update({
                where: { id: post.id },
                data: { errorLog: null },
            });

            console.log(`Recovered first comment. Reply ID: ${replyId}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to publish first comment";

            await prisma.post.update({
                where: { id: post.id },
                data: { errorLog: `${FAILURE_PREFIX} ${message}` },
            });

            console.error(`Recovery failed for ${post.id}: ${message}`);
        }
    }
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
