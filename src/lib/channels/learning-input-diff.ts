const FIELDS = ["views", "likes", "replies", "reposts"] as const;
type Metrics = Record<(typeof FIELDS)[number], number | null>;

export interface LearningInputPost extends Metrics {
  id: string;
  publications?: (Metrics & { metricsAt: Date | null })[];
}

// Compares what learning reads from Post against the mirrored Threads Publication.
// metricsAt is skipped on purpose: learning reads it from the Post.
export function diffLearningInputs(posts: LearningInputPost[]): { missing: string[]; changed: { postId: string; fields: string[] }[] } {
  const missing: string[] = [];
  const changed: { postId: string; fields: string[] }[] = [];
  for (const post of posts) {
    const pub = Array.isArray(post.publications) ? post.publications[0] : undefined;
    if (!pub || pub.metricsAt == null) {
      missing.push(post.id);
      continue;
    }
    const fields = FIELDS.filter((field) => pub[field] !== post[field]);
    if (fields.length > 0) changed.push({ postId: post.id, fields });
  }
  return { missing, changed };
}
