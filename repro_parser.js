const fs = require('fs');

function processPostContent(rawBody) {
    // Strip HTML comments (formula/stunt metadata)
    const body = rawBody.replace(/<!--[\s\S]*?-->\s*\n?/g, '').trim();

    // Find the 💬 first comment blockquote
    const commentStart = body.search(/\n>\s*\*\*💬/);
    console.log('commentStart:', commentStart);
    if (commentStart === -1) {
        return { content: body, firstComment: null };
    }

    const mainContent = body.substring(0, commentStart).trim();
    const commentSection = body.substring(commentStart);
    console.log('commentSection preview:', JSON.stringify(commentSection.substring(0, 50)));

    // Extract text lines after the 💬 header line
    const commentLines = [];
    let pastHeader = false;
    for (const line of commentSection.split('\n')) {
        console.log('Processing line:', JSON.stringify(line));
        if (!pastHeader) {
            if (/^>\s*\*\*💬/.test(line)) {
                pastHeader = true;
                console.log('Found header!');
            }
            continue;
        }
        if (line.startsWith('>')) {
            const text = line.replace(/^>\s?/, '').trim();
            console.log('Text extracted:', JSON.stringify(text));
            if (text) commentLines.push(text);
        } else {
            console.log('Stopping at line:', JSON.stringify(line));
            break;
        }
    }

    return {
        content: mainContent,
        firstComment: commentLines.join('\n') || null,
    };
}

const content = fs.readFileSync('output/batch-2026-04-05.md', 'utf8');
const normalized = content.replace(/\r\n/g, '\n');
const chunks = normalized.split(/\n#{2,} |^#{2,} /);
for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.includes('포스트 1\n')) {
        const firstLineEnd = chunk.indexOf('\n');
        const body = chunk.substring(firstLineEnd).trim();
        const rawBody = body.replace(/---$/, '').trim();
        console.log('--- Post 1 Parsing ---');
        console.log(processPostContent(rawBody));
    }
}
