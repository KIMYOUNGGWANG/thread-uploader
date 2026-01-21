import * as XLSX from "xlsx";
import matter from "gray-matter";

export interface ParsedPost {
    content: string;
    images: string[];
    scheduledAt: Date | null;
}

/**
 * Parse an Excel file (.xlsx) into an array of Posts
 * Expected columns: content, images (comma-separated), scheduledAt (YYYY-MM-DD HH:mm)
 */
export function parseExcelFile(buffer: ArrayBuffer): ParsedPost[] {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON array
    const rows = XLSX.utils.sheet_to_json<{
        content?: string;
        images?: string;
        scheduledAt?: string;
    }>(worksheet);

    return rows
        .filter((row) => row.content && row.content.trim())
        .map((row) => ({
            content: row.content!.trim(),
            images: row.images
                ? row.images.split(",").map((img) => img.trim()).filter(Boolean)
                : [],
            scheduledAt: row.scheduledAt ? parseScheduleDate(row.scheduledAt) : null,
        }));
}

/**
 * Parse a Markdown file (.md) with YAML frontmatter
 * 
 * Supports multiple formats:
 * 
 * Format 1 - Headers with frontmatter:
 * ### 포스트 1
 * ---
 * scheduledAt: 2026-01-20 10:00
 * ---
 * Content here
 * 
 * Format 2 - Standard frontmatter:
 * ---
 * scheduledAt: 2026-01-20 10:00
 * images:
 *   - /images/photo1.jpg
 * ---
 * Content here
 */
export function parseMarkdownFile(content: string): ParsedPost[] {
    const posts: ParsedPost[] = [];

    // Normalize newlines
    const normalized = content.replace(/\r\n/g, '\n');

    // Split by "### " headers to separate posts
    // We ignore the first chunk if it's before the first header (usually file title)
    const chunks = normalized.split(/\n### |^### /);

    for (const chunk of chunks) {
        if (!chunk.trim()) continue;

        // Skip if it looks like the title block (e.g. "# Title")
        if (chunk.trim().startsWith('# ')) continue;

        // Try to identify frontmatter and content
        // Pattern 1: Header line \n --- \n Frontmatter \n --- \n Content
        // Pattern 2: Header line \n --- \n Content \n --- (My simplify format)
        // Pattern 3: Header line \n Content

        const firstLineEnd = chunk.indexOf('\n');
        if (firstLineEnd === -1) continue;

        const _header = chunk.substring(0, firstLineEnd).trim();
        const body = chunk.substring(firstLineEnd).trim();

        if (!body) continue;

        // Check for --- separators
        const matches = body.match(/^---\n([\s\S]*?)\n---/);

        if (matches) {
            const part1 = matches[1].trim(); // Content inside --- ... ---
            const rest = body.replace(matches[0], '').trim(); // Content after second ---

            // Logic:
            // If 'part1' has metadata keys (scheduledAt/images), treat it as frontmatter.
            // If 'part1' DOES NOT have keys, treat it as CONTENT (our case).

            if (part1.includes('scheduledAt:') || part1.includes('images:')) {
                // Standard: part1 is frontmatter, rest is content
                const parsed = parseFrontmatter(part1, rest || " "); // Pass empty string if no content
                if (parsed) posts.push(parsed);
            } else {
                // Simplified: part1 is CONTENT (enveloped in negatives)
                // In this case, 'rest' should be empty or ignored
                posts.push({
                    content: part1,
                    images: [],
                    scheduledAt: null
                });
            }
        } else {
            // No separators found, treat entire body as content
            // Remove any trailing --- if present
            const cleanContent = body.replace(/---$/, '').trim();
            if (cleanContent) {
                posts.push({
                    content: cleanContent,
                    images: [],
                    scheduledAt: null
                });
            }
        }
    }

    // If absolutely no posts found yet, try legacy single-post matter parsing
    if (posts.length === 0) {
        try {
            const parsed = matter(content);
            if (parsed.content.trim()) {
                posts.push({
                    content: parsed.content.trim(),
                    images: (parsed.data as any).images || [],
                    scheduledAt: (parsed.data as any).scheduledAt ? parseScheduleDate((parsed.data as any).scheduledAt) : null,
                });
            }
        } catch { }
    }

    return posts;
}

/**
 * Parse frontmatter and content into a ParsedPost
 */
function parseFrontmatter(frontmatterStr: string, postContent: string): ParsedPost | null {
    try {
        // Parse YAML-like frontmatter manually
        const lines = frontmatterStr.split('\n');
        let scheduledAt: string | null = null;
        const images: string[] = [];
        let inImages = false;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check for scheduledAt
            if (trimmedLine.startsWith('scheduledAt:')) {
                scheduledAt = trimmedLine.replace('scheduledAt:', '').trim();
                inImages = false;
            }
            // Check for images array start
            else if (trimmedLine.startsWith('images:')) {
                inImages = true;
            }
            // Parse image list items
            else if (inImages && trimmedLine.startsWith('-')) {
                const imageUrl = trimmedLine.replace('-', '').trim();
                if (imageUrl) {
                    images.push(imageUrl);
                }
            }
            // End images parsing on other keys
            else if (trimmedLine.includes(':') && !trimmedLine.startsWith('-')) {
                inImages = false;
            }
        }

        // Remove any trailing markdown artifacts from content
        let cleanContent = postContent;
        // Remove trailing "---" if it exists (artifact from splitting)
        cleanContent = cleanContent.replace(/\n---\s*$/, '').trim();
        // Remove header markers that might have leaked in
        cleanContent = cleanContent.replace(/^###[^\n]*\n/, '').trim();

        if (!cleanContent) return null;

        return {
            content: cleanContent,
            images,
            scheduledAt: scheduledAt ? parseScheduleDate(scheduledAt) : null,
        };
    } catch {
        return null;
    }
}

/**
 * Parse a date string in format "YYYY-MM-DD HH:mm" or ISO format
 */
function parseScheduleDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try parsing as "YYYY-MM-DD HH:mm"
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (match) {
        const [, year, month, day, hour, minute] = match;
        return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
        );
    }

    // Try parsing as ISO date
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Validate a post before submission
 */
export function validatePost(post: ParsedPost): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Content is required
    if (!post.content || !post.content.trim()) {
        errors.push("Content is required");
    }

    // Threads has a 500 character limit
    if (post.content && post.content.length > 500) {
        errors.push(`Content exceeds 500 characters (${post.content.length})`);
    }

    // Validate image URLs
    for (const img of post.images) {
        if (!img.startsWith("http://") && !img.startsWith("https://") && !img.startsWith("/")) {
            errors.push(`Invalid image path: ${img}`);
        }
    }

    // Note: scheduledAt validation removed - we use FIFO order, not time-based scheduling

    return {
        valid: errors.length === 0,
        errors,
    };
}
