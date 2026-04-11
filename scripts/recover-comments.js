const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

function parseMarkdown(text) {
    const posts = [];
    const normalized = text.replace(/\r\n/g, '\n');
    const chunks = normalized.split(/\n#{2,}|#{2,}/);
    
    for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        
        // Extract content
        const body = chunk.replace(/<!--[\s\S]*?-->/g, '').trim();
        const lines = body.split('\n');
        const contentLines = [];
        let firstComment = null;
        let isComment = false;

        for (const line of lines) {
            if (line.includes('💬 첫 댓글')) {
                isComment = true;
                continue;
            }
            if (isComment) {
                if (line.startsWith('>')) {
                    const commentLine = line.replace(/^>\s*/, '').trim();
                    if (commentLine) {
                        firstComment = firstComment ? firstComment + '\n' + commentLine : commentLine;
                    }
                }
            } else if (!line.startsWith('#') && line.trim()) {
                contentLines.push(line);
            }
        }

        if (contentLines.length > 0) {
            posts.push({
                content: contentLines.join('\n').trim(),
                firstComment: firstComment ? firstComment.trim() : null
            });
        }
    }
    return posts;
}

async function main() {
    const filePath = 'output/batch-2026-04-05.md';
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    const text = fs.readFileSync(filePath, 'utf-8');
    const parsedPosts = parseMarkdown(text);
    console.log(`Parsed ${parsedPosts.length} posts from MD.`);

    let updatedCount = 0;
    for (const parsed of parsedPosts) {
        if (!parsed.firstComment) continue;

        // Try to find the post in DB by matching content (partial match if needed)
        const dbPost = await prisma.post.findFirst({
            where: {
                content: {
                    contains: parsed.content.substring(0, 50) // Match first 50 chars as a proxy
                },
                firstComment: null
            }
        });

        if (dbPost) {
            await prisma.post.update({
                where: { id: dbPost.id },
                data: { firstComment: parsed.firstComment }
            });
            updatedCount++;
        }
    }

    console.log(`Successfully recovered ${updatedCount} first comments in DB.`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => prisma.$disconnect());
